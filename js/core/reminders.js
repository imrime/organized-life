// @ts-check
// Reminder engine (docs/spec/02-architecture.md §9, docs/spec/05-cross-system.md §3).
// Features register sources that turn data into instances; the engine fires due ones while the app is open.

/**
 * @typedef {{
 *   key: string,              // stable: <source>:<recordId>:<YYYY-MM-DD>T<HH:MM>
 *   source: string,
 *   kind: 'alarm'|'reminder',
 *   at: Date,
 *   title: string,
 *   window?: string,
 *   objectId?: string,
 *   data?: Record<string, any>,
 * }} ReminderInstance
 * @typedef {{ id: string, firedAt?: string|null, snoozedUntil?: string|null, ackAt?: string|null }} ReminderStateRecord
 * @typedef {{ inst: ReminderInstance, effectiveAt: Date }} Pending
 */

/** Alarms older than this are not rung any more but reported as missed. */
export const ALARM_LATE_MS = 2 * 60_000;
/** Other reminders older than this are reported as missed instead of shown. */
export const REMINDER_LATE_MS = 30 * 60_000;
/** A ringing alarm stops by itself after this long. */
export const ALARM_RING_MS = 5 * 60_000;
export const LOOKBACK_MS = 12 * 3_600_000;
export const LOOKAHEAD_MS = 24 * 3_600_000;

/** @type {Map<string, (from: Date, to: Date) => ReminderInstance[]>} */
const sources = new Map();

/**
 * @param {string} name
 * @param {(from: Date, to: Date) => ReminderInstance[]} collect
 */
export function registerReminderSource(name, collect) {
  sources.set(name, collect);
}

/**
 * @param {Date} from
 * @param {Date} to
 * @returns {ReminderInstance[]}
 */
export function collectInstances(from, to) {
  return [...sources.entries()].flatMap(([name, collect]) => {
    try {
      return collect(from, to);
    } catch (err) {
      console.error(`reminder source ${name} failed`, err);
      return [];
    }
  });
}

/**
 * When an instance is (still) pending: its original time, or the end of a snooze that hasn't fired yet.
 * @param {ReminderInstance} inst
 * @param {ReminderStateRecord|undefined} state
 * @returns {Date|null} null when handled
 */
export function effectiveTime(inst, state) {
  if (state?.ackAt) return null;
  if (state?.snoozedUntil && (!state.firedAt || state.firedAt < state.snoozedUntil)) return new Date(state.snoozedUntil);
  if (state?.firedAt) return null;
  return inst.at;
}

/**
 * Pure classification used by the engine and the next-task strip.
 * @param {ReminderInstance[]} instances
 * @param {(key: string) => ReminderStateRecord|undefined} stateOf
 * @param {Date} now
 * @param {{ kinds?: ('alarm'|'reminder')[] }} [options]
 */
export function classify(instances, stateOf, now, { kinds = ['alarm', 'reminder'] } = {}) {
  /** @type {Pending[]} */ const due = [];
  /** @type {Pending[]} */ const upcoming = [];
  /** @type {Pending[]} */ const missed = [];
  const t = now.getTime();
  for (const inst of instances) {
    if (!kinds.includes(inst.kind)) continue;
    const state = stateOf(inst.key);
    const effectiveAt = effectiveTime(inst, state);
    if (!effectiveAt) {
      // Fired alarm that was never dismissed and has stopped ringing → missed.
      if (inst.kind === 'alarm' && state?.firedAt && !state.ackAt && t - new Date(state.firedAt).getTime() > ALARM_RING_MS) {
        missed.push({ inst, effectiveAt: inst.at });
      }
      continue;
    }
    const age = t - effectiveAt.getTime();
    const late = inst.kind === 'alarm' ? ALARM_LATE_MS : REMINDER_LATE_MS;
    if (age < 0) upcoming.push({ inst, effectiveAt });
    else if (age <= late) due.push({ inst, effectiveAt });
    else missed.push({ inst, effectiveAt });
  }
  const byTime = (/** @type {Pending} */ a, /** @type {Pending} */ b) => a.effectiveAt.getTime() - b.effectiveAt.getTime();
  return { due: due.sort(byTime), upcoming: upcoming.sort(byTime), missed: missed.sort(byTime) };
}

// ---------------------------------------------------------------------------
// Engine (browser only)

/**
 * @typedef {{
 *   stateOf: (key: string) => ReminderStateRecord|undefined,
 *   markFired: (keys: string[]) => Promise<unknown>,
 *   onAlarm: (instances: ReminderInstance[]) => void,
 *   onReminder: (inst: ReminderInstance) => void,
 *   subscribe: (listener: () => void) => () => void,
 * }} EngineDeps
 */

/** @type {'normal'|'nightstand'} */
let mode = 'normal';
/** @type {ReturnType<typeof setTimeout>|undefined} */
let timer;
/** @type {EngineDeps|null} */
let deps = null;
let scheduled = false;

/** @param {EngineDeps} engineDeps */
export function startReminderEngine(engineDeps) {
  deps = engineDeps;
  engineDeps.subscribe(() => requestTick());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestTick();
  });
  requestTick();
}

/** Nightstand mode keeps only alarms, other reminders wait until morning. */
/** @param {'normal'|'nightstand'} next */
export function setEngineMode(next) {
  mode = next;
  requestTick();
}

/** Coalesces several triggers into one tick. */
export function requestTick() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    tick();
  });
}

function tick() {
  if (!deps) return;
  clearTimeout(timer);
  const now = new Date();
  const instances = collectInstances(new Date(now.getTime() - LOOKBACK_MS), new Date(now.getTime() + LOOKAHEAD_MS));
  const kinds = /** @type {('alarm'|'reminder')[]} */ (mode === 'nightstand' ? ['alarm'] : ['alarm', 'reminder']);
  const { due, upcoming } = classify(instances, deps.stateOf, now, { kinds });

  if (due.length) {
    const alarms = due.filter((p) => p.inst.kind === 'alarm').map((p) => p.inst);
    const others = due.filter((p) => p.inst.kind !== 'alarm').map((p) => p.inst);
    deps.markFired(due.map((p) => p.inst.key)).catch((err) => console.error('markFired failed', err));
    if (alarms.length) deps.onAlarm(alarms);
    for (const inst of others) deps.onReminder(inst);
  }

  // Sleep until the next instance, but wake at least once a minute (timers can be throttled).
  const next = upcoming[0]?.effectiveAt.getTime() ?? Infinity;
  const delay = Math.max(250, Math.min(next - Date.now() + 50, 60_000));
  timer = setTimeout(tick, delay);
}
