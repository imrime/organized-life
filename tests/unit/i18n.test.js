// @ts-check
import { describe, it, expect } from '../harness.js';
import en from '../../js/i18n/en.js';
import ru from '../../js/i18n/ru.js';
import { leafKeys, setLanguage, t } from '../../js/core/i18n.js';

describe('i18n', () => {
  it('English and Russian dictionaries have identical keys', () => {
    const enKeys = leafKeys(en).sort();
    const ruKeys = leafKeys(ru).sort();
    const missingInRu = enKeys.filter((k) => !ruKeys.includes(k));
    const extraInRu = ruKeys.filter((k) => !enKeys.includes(k));
    expect({ missingInRu, extraInRu }).toEqual({ missingInRu: [], extraInRu: [] });
  });
  it('interpolates parameters and falls back to the key', () => {
    setLanguage('en');
    expect(t('app.updated', { version: '1.2.3' })).toBe('Updated to v1.2.3');
    expect(t('no.such.key')).toBe('no.such.key');
  });
  it('switches language', () => {
    setLanguage('ru');
    expect(t('common.save')).toBe('Сохранить');
    setLanguage('en');
    expect(t('common.save')).toBe('Save');
  });
});
