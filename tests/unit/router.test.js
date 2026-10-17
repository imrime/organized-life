// @ts-check
import { describe, it, expect } from '../harness.js';
import { parseHash, buildHash, systemTarget, windowFromTarget } from '../../js/core/router.js';

describe('router', () => {
  it('parses hash routes', () => {
    expect(parseHash('#/kitchen/refrigerator')).toEqual({ locationId: 'kitchen', target: 'refrigerator', page: null, pageId: null });
    expect(parseHash('')).toEqual({ locationId: null, target: null, page: null, pageId: null });
    expect(parseHash('#/bedroom/desk-notebook/task/9f')).toEqual({ locationId: 'bedroom', target: 'desk-notebook', page: 'task', pageId: '9f' });
  });
  it('builds hashes and stops at the first empty part', () => {
    expect(buildHash({ locationId: 'bedroom' })).toBe('#/bedroom');
    expect(buildHash({ locationId: 'bedroom', target: '~settings' })).toBe('#/bedroom/~settings');
    expect(buildHash({ locationId: 'bedroom', target: null, page: 'x' })).toBe('#/bedroom');
  });
  it('maps system windows to targets and back', () => {
    expect(systemTarget('settings.main')).toBe('~settings');
    expect(windowFromTarget('~settings')).toBe('settings.main');
    expect(windowFromTarget('~alarms.main')).toBe('alarms.main');
    expect(windowFromTarget('refrigerator')).toBe(null);
  });
});
