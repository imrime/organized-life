// @ts-check
import { describe, it, expect } from '../harness.js';
import { statusPatch, nextEpisode, randomPick, nowWatching, progressText, matchesMoods, isValidLink, validateMedia, defaultStatus } from '../../js/features/media/model.js';
import { columnOf, projectStatusPatch, missingMaterials, creativeSuggestions } from '../../js/features/creative/model.js';
import { ACHIEVEMENTS, longestRun, goalWeeks, newlyEarned, nextNoWaste, trophyState } from '../../js/features/achievements/model.js';

/** @param {Record<string, any[]>} data @param {Record<string, any>} [profiles] */
const snap = (data, profiles = {}) => ({
  all: (/** @type {string} */ c) => data[c] ?? [],
  allWithDeleted: (/** @type {string} */ c) => data[c] ?? [],
  profile: (/** @type {string} */ id) => profiles[id],
  today: '2026-10-18',
  visibleLocationIds: ['bedroom', 'kitchen'],
});

describe('media', () => {
  it('sets start and finish dates on status changes', () => {
    expect(statusPatch({}, 'watching', '2026-10-18')).toEqual({ status: 'watching', startedAt: '2026-10-18', finishedAt: null });
    expect(statusPatch({ startedAt: '2026-10-01' }, 'watched', '2026-10-18')).toEqual({ status: 'watched', finishedAt: '2026-10-18' });
    expect(statusPatch({ startedAt: '2026-10-01', finishedAt: '2026-10-05' }, 'read', '2026-10-18').finishedAt).toBe('2026-10-05');
    expect(statusPatch({ startedAt: '2026-10-01', finishedAt: '2026-10-05' }, 'reading', '2026-10-18').finishedAt).toBe(null);
    expect(defaultStatus('game')).toBe('backlog');
    expect(defaultStatus('book')).toBe('to_read');
  });
  it('counts episodes and formats progress', () => {
    expect(nextEpisode(/** @type {any} */ ({ progress: { season: 2, episode: 4 } }))).toEqual({ season: 2, episode: 5 });
    expect(nextEpisode(/** @type {any} */ ({}))).toEqual({ season: 1, episode: 1 });
    expect(progressText(/** @type {any} */ ({ kind: 'series', progress: { season: 2, episode: 5 } }))).toBe('S2 · E5');
    expect(progressText(/** @type {any} */ ({ kind: 'book', progress: { page: 120, totalPages: 380 } }))).toBe('p. 120 / 380');
  });
  it('picks randomly and finds what is on TV', () => {
    expect(randomPick(['a', 'b', 'c'], () => 0.99)).toBe('c');
    expect(randomPick([], () => 0.5)).toBe(undefined);
    const items = /** @type {any[]} */ ([
      { id: '1', kind: 'film', status: 'watching', updatedAt: '2026-10-10' },
      { id: '2', kind: 'series', status: 'watching', updatedAt: '2026-10-12' },
      { id: '3', kind: 'game', status: 'playing', updatedAt: '2026-10-15' },
    ]);
    expect(nowWatching(items)?.id).toBe('2');
  });
  it('filters by mood and validates links and years', () => {
    expect(matchesMoods({ tags: ['calm'] }, ['calm', 'focus'])).toBe(true);
    expect(matchesMoods({ moodTags: ['party'] }, ['calm'])).toBe(false);
    expect(matchesMoods({ tags: [] }, [])).toBe(true);
    expect(isValidLink('https://example.com')).toBe(true);
    expect(isValidLink('javascript:alert(1)')).toBe(false);
    expect(validateMedia({ title: ' ', year: '1700', link: 'ftp://x' }, 2026)).toEqual({ title: 'form.errors.required', year: 'media.errors.year', link: 'media.errors.link' });
    expect(validateMedia({ title: 'Dune', year: '2021', link: '' }, 2026)).toEqual({});
  });
});

describe('creative', () => {
  it('keeps paused projects in progress and dates status changes', () => {
    expect(columnOf('paused')).toBe('in_progress');
    expect(projectStatusPatch({}, 'in_progress', '2026-10-18')).toEqual({ status: 'in_progress', startedAt: '2026-10-18', finishedAt: null });
    expect(projectStatusPatch({ startedAt: '2026-10-01' }, 'done', '2026-10-18')).toEqual({ status: 'done', finishedAt: '2026-10-18' });
  });
  it('suggests missing materials not already on the list', () => {
    const project = /** @type {any} */ ({ id: 'p', status: 'in_progress', materials: [{ id: 'a', name: 'Canvas', have: false }, { id: 'b', name: 'Brush', have: true }, { id: 'c', name: 'Oil paint', have: false }] });
    expect(missingMaterials(project).map((m) => m.name)).toEqual(['Canvas', 'Oil paint']);
    const listed = [{ id: 's', name: 'canvas', checked: false }];
    expect(creativeSuggestions([project], listed).map((e) => e.name)).toEqual(['Oil paint']);
    expect(creativeSuggestions([{ ...project, status: 'done' }], [])).toEqual([]);
    expect(creativeSuggestions([project], [])[0].shopCategory).toBe('hobby');
  });
});

describe('achievements', () => {
  it('measures runs of consecutive days', () => {
    expect(longestRun(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06'])).toBe(3);
    expect(longestRun([])).toBe(0);
  });
  it('counts consecutive weeks meeting a goal', () => {
    // Weeks starting Mon 2026-09-28, 10-05, 10-12; current week 10-12 met.
    const dates = ['2026-09-28', '2026-09-30', '2026-10-05', '2026-10-07', '2026-10-12', '2026-10-13'];
    expect(goalWeeks(dates, 2, '2026-10-18', 1)).toBe(3);
    expect(goalWeeks(dates.slice(0, 5), 2, '2026-10-18', 1)).toBe(2);
    expect(goalWeeks(dates, 0, '2026-10-18', 1)).toBe(0);
  });
  it('unlocks only what the data earns', () => {
    const d = snap(
      { alarms: [{ id: 'a' }], media: Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, kind: 'film', status: 'watched' })), walks: [] },
      { settings: { onboarding: { done: true }, visited: ['bedroom', 'kitchen'] } },
    );
    const ids = newlyEarned(/** @type {any} */ (d), new Set(['on_time'])).map((a) => a.id);
    expect(ids).toEqual(['settled_in', 'cinephile', 'wanderer']);
    expect(ACHIEVEMENTS.length).toBe(29);
  });
  it('advances the no-waste counter once a day', () => {
    expect(nextNoWaste(undefined, '2026-10-18', { tracked: 6, expired: 0 })).toEqual({ date: '2026-10-18', run: 1 });
    expect(nextNoWaste({ date: '2026-10-17', run: 3 }, '2026-10-18', { tracked: 6, expired: 0 })).toEqual({ date: '2026-10-18', run: 4 });
    expect(nextNoWaste({ date: '2026-10-15', run: 3 }, '2026-10-18', { tracked: 6, expired: 0 }).run).toBe(1);
    expect(nextNoWaste({ date: '2026-10-17', run: 3 }, '2026-10-18', { tracked: 6, expired: 1 }).run).toBe(0);
    expect(nextNoWaste({ date: '2026-10-18', run: 3 }, '2026-10-18', { tracked: 0, expired: 5 }).run).toBe(3);
  });
  it('maps unlock counts to shelf states', () => {
    expect(trophyState(0)).toBe('trophies-none');
    expect(trophyState(4)).toBe('trophies-some');
    expect(trophyState(5)).toBe('trophies-many');
  });
});
