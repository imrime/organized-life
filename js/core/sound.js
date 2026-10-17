// @ts-check
// Synthesised sounds (Web Audio, no files): alarm tones and a short chime.
// Browsers only allow audio after a user gesture, so the first tap anywhere unlocks the audio context.

/** @typedef {'chime'|'birds'|'beep'|'rising'} AlarmSound */

export const ALARM_SOUNDS = /** @type {AlarmSound[]} */ (['chime', 'birds', 'beep', 'rising']);

/** @type {AudioContext|null} */
let ctx = null;

function context() {
  if (!ctx) {
    const Ctor = globalThis.AudioContext ?? /** @type {any} */ (globalThis).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** Call from a user gesture (tap): resumes the context and plays a silent blip so later playback is allowed. */
export async function unlockAudio() {
  const audio = context();
  if (!audio) return false;
  try {
    if (audio.state !== 'running') await audio.resume();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.05);
  } catch {
    return false;
  }
  return audio.state === 'running';
}

/** Installs a one-time listener that unlocks audio on the first tap/keypress. */
export function unlockAudioOnFirstGesture() {
  const handler = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
  window.addEventListener('pointerdown', handler);
  window.addEventListener('keydown', handler);
}

/**
 * Schedules one note.
 * @param {AudioContext} audio
 * @param {AudioNode} out
 * @param {{ freq: number, to?: number, start: number, dur: number, type?: OscillatorType, peak?: number }} n
 */
function note(audio, out, { freq, to, start, dur, type = 'sine', peak = 1 }) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/**
 * One pattern cycle of an alarm sound starting at `t0`; returns its length in seconds.
 * @param {AlarmSound} sound
 * @param {AudioContext} audio
 * @param {AudioNode} out
 * @param {number} t0
 * @param {number} cycle cycle index (rising sound grows over time)
 */
function pattern(sound, audio, out, t0, cycle) {
  switch (sound) {
    case 'birds': {
      for (let i = 0; i < 4; i++) note(audio, out, { freq: 2400 + i * 180, to: 3600, start: t0 + i * 0.16, dur: 0.12, peak: 0.5 });
      note(audio, out, { freq: 3000, to: 2200, start: t0 + 0.9, dur: 0.25, peak: 0.45 });
      return 2.2;
    }
    case 'beep': {
      for (let i = 0; i < 4; i++) note(audio, out, { freq: 880, start: t0 + i * 0.25, dur: 0.14, type: 'square', peak: 0.35 });
      return 1.6;
    }
    case 'rising': {
      const peak = Math.min(1, 0.25 + cycle * 0.15);
      note(audio, out, { freq: 440, to: 880, start: t0, dur: 1.2, type: 'triangle', peak });
      return 1.8;
    }
    case 'chime':
    default: {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => note(audio, out, { freq, start: t0 + i * 0.22, dur: 1.4, peak: 0.6 }));
      return 2.6;
    }
  }
}

/**
 * Plays an alarm sound in a loop with a 3 s fade-in. Returns a stop function.
 * @param {AlarmSound} sound
 * @param {number} volume 0..1
 * @param {{ loop?: boolean }} [options]
 * @returns {() => void}
 */
export function playAlarm(sound, volume, { loop = true } = {}) {
  const audio = context();
  if (!audio) return () => undefined;
  if (audio.state !== 'running') audio.resume().catch(() => undefined);
  const master = audio.createGain();
  master.connect(audio.destination);
  const now = audio.currentTime;
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + (loop ? 3 : 0.05));
  let stopped = false;
  let cycle = 0;
  let next = now + 0.05;
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let timer;
  const schedule = () => {
    if (stopped) return;
    const length = pattern(sound, audio, master, next, cycle++);
    next += length;
    if (loop) timer = setTimeout(schedule, Math.max(50, (next - audio.currentTime - 0.3) * 1000));
  };
  schedule();
  return () => {
    stopped = true;
    clearTimeout(timer);
    const end = audio.currentTime;
    master.gain.cancelScheduledValues(end);
    master.gain.setValueAtTime(master.gain.value, end);
    master.gain.exponentialRampToValueAtTime(0.0001, end + 0.15);
    setTimeout(() => master.disconnect(), 300);
  };
}

/** Short "done" chime (focus end, laundry finished, reminders). */
export function playChime(volume = 0.6) {
  return playAlarm('chime', volume, { loop: false });
}
