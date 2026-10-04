import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { generateBirthdays, hslToHex, KEYWORDS, MONTH_COLORS, MOTIFS, SEASON_MOTIFS, seasonOf } from '../src/data/birthdayRules.ts';
import { allMonthDays } from '../src/data/validate.ts';
import { renderBirthdaysYaml } from '../src/data/writeBirthdays.ts';
import { dataPaths } from '../src/paths.ts';

const entries = generateBirthdays();

describe('誕生日データの生成規則（docs/03 §1-1）', () => {
  it('366日（2/29 を含む）を重複・欠落なく作る', () => {
    expect(entries).toHaveLength(366);
    expect(entries.map((e) => e.date)).toEqual(allMonthDays());
    expect(entries.some((e) => e.date === '02-29')).toBe(true);
  });

  it('色名は366日すべて異なる', () => {
    expect(new Set(entries.map((e) => e.color_name)).size).toBe(366);
  });

  it('月の基調色は月をまたいで重複しない', () => {
    const names = MONTH_COLORS.flat().map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('color_hex は #RRGGBB、keyword は2〜6文字', () => {
    for (const e of entries) {
      expect(e.color_hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(Array.from(e.keyword).length).toBeGreaterThanOrEqual(2);
      expect(Array.from(e.keyword).length).toBeLessThanOrEqual(6);
    }
  });

  it('隣り合う日でモチーフ・キーワードが続かない', () => {
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i]?.motif).not.toBe(entries[i - 1]?.motif);
      expect(entries[i]?.keyword).not.toBe(entries[i - 1]?.keyword);
    }
  });

  it('モチーフはその季節のものだけ', () => {
    for (const e of entries) {
      const month = Number(e.date.slice(0, 2));
      expect(SEASON_MOTIFS[seasonOf(month)] as readonly string[], e.date).toContain(e.motif);
    }
    expect(entries.find((e) => e.date === '01-01')?.motif).not.toBe('桜の花びら');
    expect(entries.filter((e) => e.motif === 'ひまわり').every((e) => ['06', '07', '08'].includes(e.date.slice(0, 2)))).toBe(true);
  });

  it('すべてのモチーフ・キーワードが使われる', () => {
    expect(new Set(entries.map((e) => e.motif))).toEqual(new Set(MOTIFS));
    expect(new Set(entries.map((e) => e.keyword))).toEqual(new Set(KEYWORDS));
  });

  it('同じ規則からは毎回同じ結果（再現できる）', () => {
    expect(generateBirthdays()).toEqual(entries);
  });

  it('hslToHex', () => {
    expect(hslToHex(0, 100, 50)).toBe('#FF0000');
    expect(hslToHex(120, 100, 50)).toBe('#00FF00');
    expect(hslToHex(0, 0, 100)).toBe('#FFFFFF');
  });
});

describe('birthdays.yaml', () => {
  it('先頭コメントに設定ルールがあり、date は文字列のまま読める', () => {
    const text = renderBirthdaysYaml();
    expect(text.startsWith('# 誕生日別の題材')).toBe(true);
    expect(text).toContain('設定ルール');
    expect(text).toContain('伝統・学説・宗教的権威を名乗らない');
    const parsed = parse(text) as { date: unknown }[];
    expect(parsed[0]?.date).toBe('01-01');
  });

  it('リポジトリの data/birthdays.yaml は規則どおり（手で直したら規則か検証を更新すること）', () => {
    expect(readFileSync(dataPaths().birthdays, 'utf8').replace(/\r\n/g, '\n')).toBe(renderBirthdaysYaml());
  });
});
