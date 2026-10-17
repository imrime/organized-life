// @ts-check
import { describe, it, expect } from '../harness.js';
import { currencyForLocales, fractionDigits, parseMoney, formatMoney, splitProportionally } from '../../js/core/money.js';

describe('money', () => {
  it('derives the currency from the locale region', () => {
    expect(currencyForLocales(['uk-UA'])).toBe('UAH');
    expect(currencyForLocales(['ru-UA'])).toBe('UAH');
    expect(currencyForLocales(['de-DE'])).toBe('EUR');
    expect(currencyForLocales(['en-US'])).toBe('USD');
    expect(currencyForLocales(['en'])).toBe('EUR');
    expect(currencyForLocales(['ru', 'en-GB'])).toBe('GBP');
  });
  it('knows fraction digits', () => {
    expect(fractionDigits('EUR')).toBe(2);
    expect(fractionDigits('JPY')).toBe(0);
  });
  it('parses user input into minor units', () => {
    expect(parseMoney('12,50', 'EUR')).toBe(1250);
    expect(parseMoney('12.5', 'EUR')).toBe(1250);
    expect(parseMoney('1 234.56', 'EUR')).toBe(123456);
    expect(parseMoney('1.234', 'EUR')).toBe(123400);
    expect(parseMoney('€ 3', 'EUR')).toBe(300);
    expect(parseMoney('1,234', 'JPY')).toBe(1234);
    expect(parseMoney('abc', 'EUR')).toBe(null);
  });
  it('adds without floating-point errors', () => {
    const sum = /** @type {number} */ (parseMoney('0.10', 'EUR')) + /** @type {number} */ (parseMoney('0.20', 'EUR'));
    expect(sum).toBe(30);
    expect(formatMoney(sum, 'EUR', 'en-GB')).toBe('€0.30');
  });
  it('splits proportionally and keeps the remainder', () => {
    const parts = splitProportionally(1000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(splitProportionally(1001, [300, 700])).toEqual([300, 701]);
  });
});
