import { describe, expect, it } from 'vitest';
import { addDays, isValidYmd, isoWeek, isoWeekRange, jstDateTime, toJstIso, toJstYmd } from '../src/date.ts';

describe('日付（Asia/Tokyo）', () => {
  it('UTC の瞬間を JST の ISO8601（+09:00）にする', () => {
    expect(toJstIso(new Date('2026-10-09T22:00:00Z'))).toBe('2026-10-10T07:00:00+09:00');
  });

  it('JST の日付は UTC と日付がずれる時間帯でも正しい', () => {
    expect(toJstYmd(new Date('2026-12-31T15:30:00Z'))).toBe('2027-01-01');
    expect(toJstYmd(new Date('2026-12-31T14:59:59Z'))).toBe('2026-12-31');
  });

  it('JST の日時から瞬間を作る', () => {
    expect(jstDateTime('2026-10-10', '07:00').toISOString()).toBe('2026-10-09T22:00:00.000Z');
    expect(toJstIso(jstDateTime('2026-10-10', '19:00'))).toBe('2026-10-10T19:00:00+09:00');
  });

  it('日付の加算（月・年またぎ、うるう年）', () => {
    expect(addDays('2026-10-10', 7)).toBe('2026-10-17');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('日付の妥当性', () => {
    expect(isValidYmd('2028-02-29')).toBe(true);
    expect(isValidYmd('2026-02-29')).toBe(false);
    expect(isValidYmd('2026-1-1')).toBe(false);
  });

  it('ISO 週番号（CLAUDE.md の例：2026-10-10 は 2026-W41）', () => {
    expect(isoWeek('2026-10-10')).toBe('2026-W41');
    expect(isoWeekRange('2026-W41')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
    expect(isoWeek('2026-01-01')).toBe('2026-W01');
    expect(isoWeekRange('2026-W01').from).toBe('2025-12-29');
  });

  it('不正な週は例外', () => {
    expect(() => isoWeekRange('2026-W54')).toThrow();
    expect(() => isoWeekRange('2026-41')).toThrow();
  });
});
