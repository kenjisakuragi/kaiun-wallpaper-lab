import { describe, expect, it } from 'vitest';
import { parseMonthDay } from '../src/monthDay.ts';

describe('parseMonthDay（docs/07 M1 完了条件）', () => {
  it.each(['0315', '3/15', '3月15日', '０３１５', ' 3 / 15 ', '誕生日は0315です！'])('%j を 03-15 と解釈する', (input) => {
    const r = parseMonthDay(input);
    expect(r).toEqual({ ok: true, month: 3, day: 15, md: '03-15' });
  });

  it.each(['0230', '1301', 'abc', '20260315'])('%j は失敗する', (input) => {
    expect(parseMonthDay(input).ok).toBe(false);
  });

  it('0229 は成功する', () => {
    expect(parseMonthDay('0229')).toEqual({ ok: true, month: 2, day: 29, md: '02-29' });
  });
});

describe('parseMonthDay（追加の境界）', () => {
  it.each([
    ['３／１５', '03-15'],
    ['3月15', '03-15'],
    ['12/31', '12-31'],
    ['1231', '12-31'],
    ['1月1日生まれです', '01-01'],
    ['0101', '01-01'],
  ])('%j → %s', (input, md) => {
    const r = parseMonthDay(input);
    expect(r.ok && r.md).toBe(md);
  });

  // docs/09 #12 の仮の安全側：年を含む・候補が複数ある入力は失敗
  it.each([
    ['1990年3月15日', 'has_year'],
    ['1990/3/15', 'has_year'],
    ['2026/03/15', 'has_year'],
    ['0315と0316', 'ambiguous'],
    ['3/15か0316', 'ambiguous'],
    ['0431', 'invalid_date'],
    ['0000', 'invalid_date'],
    ['13/1', 'invalid_date'],
    ['', 'no_candidate'],
    ['よろしくお願いします', 'no_candidate'],
    ['031', 'no_candidate'],
  ])('%j は失敗（%s）', (input, reason) => {
    expect(parseMonthDay(input)).toEqual({ ok: false, reason });
  });
});
