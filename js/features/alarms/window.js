// @ts-check
// Alarm clock window (docs/spec/rooms/bedroom.md B1): list, edit page, how-alarms-work page, Nightstand entry.

import { html, useEffect, useState } from '../../ui/lib.js';
import { t, formatTime, formatIn, weekdayNames } from '../../core/i18n.js';
import { SheetHeader, SheetBody, SheetFooter, DoneFooter } from '../../ui/sheet.js';
import { Field, Segmented, Switch, Select, TextInput, DateTimeInput, DayToggles, useForm, useFieldId } from '../../ui/controls.js';
import { useCollection, useProfile } from '../../ui/hooks.js';
import { PROFILE } from '../../core/schema.js';
import { undoToast, toast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/dialog.js';
import { unlockAudio, playAlarm, ALARM_SOUNDS } from '../../core/sound.js';
import { startNightstand } from '../../ui/nightstand.js';
import { updateSettings } from '../settings/actions.js';
import { icon } from '../../ui/icons.js';
import { defaultAlarm, validateAlarm, nextAlarm, effectiveNext, repeatSummary, REPEAT_PRESETS, timeUntil } from './model.js';
import { saveAlarm, deleteAlarm, setAlarmEnabled } from './actions.js';

/** @typedef {import('./model.js').Alarm} Alarm */
/** @typedef {{ push: Function, pop: Function, close: Function }} Nav */

/** @param {{ page: { id: string, params?: Record<string, any> }|null, nav: Nav }} args */
export default function AlarmsWindow({ page, nav }) {
  if (page?.id === 'alarm') return html`<${AlarmPage} id=${page.params?.id ?? null} nav=${nav} />`;
  if (page?.id === 'how') return html`<${HowAlarmsWork} nav=${nav} />`;
  return html`<${AlarmList} nav=${nav} />`;
}

/** @param {number[]} days */
export function repeatText(days) {
  const summary = repeatSummary(days);
  if (!summary.days) return t(summary.key);
  const names = weekdayNames('short');
  return summary.days.map((d) => names[d]).join(', ');
}

/** Re-render every 30 s so "in 7 h 20 min" stays fresh. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** @param {{ nav: Nav }} props */
function AlarmList({ nav }) {
  const alarms = /** @type {Alarm[]} */ (/** @type {unknown} */ (useCollection('alarms')));
  const now = useNow();
  const next = nextAlarm(alarms, now);
  const sorted = [...alarms].sort((a, b) => a.time.localeCompare(b.time));
  const soon = next && next.at.getTime() - now.getTime() < 16 * 3_600_000;

  return html`
    <${SheetHeader} title=${t('objects.bedroom.alarmClock.name')} />
    <${SheetBody}>
      <div class="hero">
        ${next
          ? html`<div class="hero-big">${formatTime(next.alarm.time)}</div>
              <div class="hero-sub">${t('alarms.nextIn', { when: formatIn(timeUntil(next.at, now)) })}</div>`
          : html`<div class="hero-big dim">--:--</div>
              <div class="hero-sub">${t('alarms.none')}</div>`}
      </div>

      <button type="button" class=${`btn nightstand-btn${soon ? ' btn-primary' : ''}`} onClick=${() => startNightstand()}>
        ${icon('moon')} ${t('nightstand.start')}
      </button>

      ${sorted.length > 0 &&
      html`<section class="section">
        <div class="group">
          ${sorted.map((alarm) => {
            const upcoming = effectiveNext(alarm, now);
            const off = !alarm.enabled || !upcoming;
            return html`<div class="row alarm-row" key=${alarm.id}>
              <button type="button" class="row-hit" onClick=${() => nav.push('alarm', { id: alarm.id })} aria-label=${t('alarms.editAlarm', { time: formatTime(alarm.time) })}>
                <span class=${`alarm-time${off ? ' dim' : ''}`}>${formatTime(alarm.time)}</span>
                <span class="main">
                  <span class="title">${alarm.label || t('alarms.defaultLabel')}</span>
                  <span class="subtitle" style="display:block">${repeatText(alarm.repeatDays)}</span>
                </span>
              </button>
              <${Switch}
                label=${t('alarms.enabledFor', { time: formatTime(alarm.time) })}
                checked=${alarm.enabled && Boolean(upcoming)}
                onChange=${(/** @type {boolean} */ on) => setAlarmEnabled(alarm.id, on)}
              />
            </div>`;
          })}
        </div>
      </section>`}

      ${!sorted.length &&
      html`<div class="empty">
        <div class="art" aria-hidden="true">⏰</div>
        <p>${t('alarms.empty')}</p>
      </div>`}

      <button type="button" class="row link-row" onClick=${() => nav.push('how')}>
        <span class="lead" aria-hidden="true">💡</span>
        <span class="main"><span class="title">${t('alarms.howTitle')}</span>
          <span class="subtitle" style="display:block">${t('alarms.howShort')}</span></span>
        <span class="chev">${icon('chevron')}</span>
      </button>
    <//>
    <${SheetFooter}>
      <button type="button" class="btn" onClick=${() => nav.push('alarm', { id: null })}>${icon('plus', { size: 20 })} ${t('alarms.add')}</button>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${() => nav.close()}>${t('common.done')}</button>
    <//>
  `;
}

/** @param {{ id: string|null, nav: Nav }} props */
function AlarmPage({ id, nav }) {
  const alarms = /** @type {Alarm[]} */ (/** @type {unknown} */ (useCollection('alarms')));
  const settings = useProfile(PROFILE.settings);
  const existing = id ? alarms.find((a) => a.id === id) : undefined;
  const base = existing ?? defaultAlarm(alarms);
  const [form, update, markSaved] = useForm({
    time: base.time,
    repeatDays: [...base.repeatDays],
    label: base.label,
    sound: base.sound,
    vibrate: base.vibrate,
    snoozeMin: base.snoozeMin,
    enabled: existing ? existing.enabled : true,
  });
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const ids = { time: useFieldId('alarm-time'), label: useFieldId('alarm-label'), sound: useFieldId('alarm-sound') };
  const preset = Object.entries(REPEAT_PRESETS).find(([, days]) => days.join() === [...form.repeatDays].sort().join())?.[0] ?? 'custom';
  const canVibrate = 'vibrate' in navigator;

  const onSave = async () => {
    const found = validateAlarm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    const { result } = await saveAlarm(form, id);
    markSaved();
    const at = effectiveNext(/** @type {Alarm} */ (result), new Date());
    toast(at ? t('alarms.setFor', { time: formatTime(form.time), when: formatIn(timeUntil(at, new Date())) }) : t('common.saved'));
    await nav.pop();
    if (!settings.alarmExplainerSeen) {
      updateSettings({ alarmExplainerSeen: true });
      nav.push('how');
    }
  };

  const onDelete = async () => {
    if (!id) return;
    const ok = await confirmDialog({ title: t('alarms.deleteTitle'), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    const { token } = await deleteAlarm(id);
    markSaved();
    await nav.pop();
    undoToast(t('alarms.deleted'), token);
  };

  const preview = async () => {
    await unlockAudio();
    playAlarm(form.sound, settings.alarmVolume ?? 0.8, { loop: false });
  };

  return html`
    <${SheetHeader} title=${id ? t('alarms.edit') : t('alarms.new')} back />
    <${SheetBody}>
      <${Field} label=${t('alarms.time')} htmlFor=${ids.time} error=${errors.time && t(errors.time)}>
        <${DateTimeInput} id=${ids.time} type="time" big value=${form.time} invalid=${Boolean(errors.time)} onInput=${(/** @type {string} */ time) => update({ time })} />
      <//>
      <${Field} label=${t('alarms.repeatLabel')}>
        <${Segmented}
          label=${t('alarms.repeatLabel')}
          value=${preset}
          options=${[
            { value: 'once', label: t('alarms.repeat.once') },
            { value: 'everyDay', label: t('alarms.repeat.everyDay') },
            { value: 'weekdays', label: t('alarms.repeat.weekdays') },
          ]}
          onChange=${(/** @type {keyof typeof REPEAT_PRESETS} */ key) => update({ repeatDays: [...REPEAT_PRESETS[key]] })}
        />
        <${DayToggles}
          label=${t('alarms.repeatDays')}
          value=${form.repeatDays}
          weekStart=${settings.weekStart ?? 1}
          names=${weekdayNames('short')}
          onChange=${(/** @type {number[]} */ repeatDays) => update({ repeatDays })}
        />
      <//>
      <${Field} label=${t('alarms.label')} htmlFor=${ids.label} optional error=${errors.label && t(errors.label, { max: 40 })}>
        <${TextInput} id=${ids.label} value=${form.label} maxLength=${40} placeholder=${t('alarms.defaultLabel')} onInput=${(/** @type {string} */ label) => update({ label })} />
      <//>
      <${Field} label=${t('alarms.sound')} htmlFor=${ids.sound}>
        <div class="inline">
          <${Select}
            id=${ids.sound}
            value=${form.sound}
            options=${ALARM_SOUNDS.map((value) => ({ value, label: t(`alarms.sounds.${value}`) }))}
            onChange=${(/** @type {any} */ sound) => update({ sound })}
          />
          <button type="button" class="btn" onClick=${preview}>▶ ${t('alarms.preview')}</button>
        </div>
      <//>
      <div class="group" style="margin-top: 16px">
        ${canVibrate &&
        html`<div class="row"><span class="main title">${t('alarms.vibrate')}</span>
          <${Switch} label=${t('alarms.vibrate')} checked=${form.vibrate} onChange=${(/** @type {boolean} */ vibrate) => update({ vibrate })} /></div>`}
        <div class="row" style="flex-direction:column;align-items:stretch">
          <span class="title">${t('alarms.snoozeLength')}</span>
          <${Segmented}
            label=${t('alarms.snoozeLength')}
            value=${form.snoozeMin}
            options=${[5, 10, 15].map((m) => ({ value: m, label: t('time.minutesShort', { minutes: m }) }))}
            onChange=${(/** @type {5|10|15} */ snoozeMin) => update({ snoozeMin })}
          />
        </div>
        <div class="row"><span class="main title">${t('alarms.enabled')}</span>
          <${Switch} label=${t('alarms.enabled')} checked=${form.enabled} onChange=${(/** @type {boolean} */ enabled) => update({ enabled })} /></div>
      </div>
    <//>
    <${SheetFooter}>
      ${id && html`<button type="button" class="btn btn-danger" onClick=${onDelete}>${t('common.delete')}</button>`}
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" onClick=${onSave}>${t('common.save')}</button>
    <//>
  `;
}

/** @param {{ nav: Nav }} props */
function HowAlarmsWork({ nav }) {
  return html`
    <${SheetHeader} title=${t('alarms.howTitle')} back />
    <${SheetBody}>
      <div class="prose">
        <p>${t('alarms.how1')}</p>
        <p>${t('alarms.how2')}</p>
        <p>${t('alarms.how3')}</p>
      </div>
      <button type="button" class="btn btn-primary" style="width:100%;margin-top:16px" onClick=${() => startNightstand()}>
        ${icon('moon')} ${t('nightstand.start')}
      </button>
    <//>
    <${DoneFooter} />
  `;
}
