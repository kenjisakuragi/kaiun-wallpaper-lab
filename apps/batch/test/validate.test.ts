import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { generateBirthdays } from '../src/data/birthdayRules.ts';
import { assertBirthdaysReviewed, BirthdaysNotReviewedError } from '../src/data/reviewGate.ts';
import { runValidateData } from '../src/data/runValidate.ts';
import {
  type ValidationResult,
  validateAffirmations,
  validateBirthdays,
  validateCalendarCsv,
  validateData,
} from '../src/data/validate.ts';
import { writeBirthdays } from '../src/data/writeBirthdays.ts';
import { DATA_DIR } from '../src/paths.ts';

const fresh = (): ValidationResult => ({ errors: [], warnings: [] });
const motifEn = new Map(generateBirthdays().map((e) => [e.motif, 'x']));
const msgs = (r: ValidationResult) => r.errors.map((e) => e.message).join('\n');

describe('リポジトリの data/ 一式（docs/07 M2 完了条件：検証エラー0）', () => {
  it('検証エラー0', () => {
    const r = validateData();
    expect(r.errors, msgs(r)).toEqual([]);
  });

  it('CLI も終了コード0で「検証エラー 0 件」と出す', () => {
    let out = '';
    expect(runValidateData(undefined, (s) => (out += s))).toBe(0);
    expect(out).toContain('検証エラー 0 件');
  });
});

describe('birthdays の検証', () => {
  const base = generateBirthdays();

  it('重複と欠落を検出', () => {
    const data = [...base.slice(1), { ...base[5] }];
    const r = fresh();
    validateBirthdays(data, motifEn, r);
    expect(msgs(r)).toMatch(/01-06：2件あります/);
    expect(msgs(r)).toMatch(/欠落している日付（1件）：01-01/);
  });

  it('color_hex の形式、存在しない日付、keyword の長さ、英訳のないモチーフを検出', () => {
    const data = base.map((e) => ({ ...e }));
    Object.assign(data[0] as object, { color_hex: 'A2D1E7' });
    Object.assign(data[1] as object, { keyword: 'あ' });
    Object.assign(data[2] as object, { motif: '未知のモチーフ' });
    data.push({ ...(base[0] as (typeof base)[number]), date: '02-30' });
    const r = fresh();
    validateBirthdays(data, motifEn, r);
    const m = msgs(r);
    expect(m).toMatch(/01-01：color_hex/);
    expect(m).toMatch(/01-02：keyword/);
    expect(m).toMatch(/01-03：motif「未知のモチーフ」/);
    expect(m).toMatch(/02-30/);
  });

  it('配列でなければエラー', () => {
    const r = fresh();
    validateBirthdays({ a: 1 }, motifEn, r);
    expect(r.errors).toHaveLength(1);
  });
});

describe('affirmations の検証', () => {
  it('id の形式・重複、空・長すぎ・重複した text を検出', () => {
    const r = fresh();
    validateAffirmations(
      [
        { id: 'a001', text: 'ひとつめ' },
        { id: 'a001', text: 'ふたつめ' },
        { id: 'x9', text: 'みっつめ' },
        { id: 'a004', text: '' },
        { id: 'a005', text: 'あ'.repeat(41) },
        { id: 'a006', text: 'ひとつめ' },
      ],
      r,
    );
    const m = msgs(r);
    expect(m).toMatch(/a001：id が重複/);
    expect(m).toMatch(/id は a001 形式/);
    expect(m).toMatch(/a004：text が空/);
    expect(m).toMatch(/a005：text が40文字を超えて/);
    expect(m).toMatch(/a006：text が a001 と重複/);
  });
});

describe('カレンダー CSV の検証', () => {
  const header = 'date,type,source_url,checked_by\n';
  const check = (body: string, file = '2026.csv') => {
    const r = fresh();
    validateCalendarCsv(header + body, file, r);
    return r;
  };

  it('ヘッダーだけのテンプレートはエラーなし', () => {
    expect(check('').errors).toEqual([]);
  });

  it('正しい行はエラーなし（クォート・CRLF も可）', () => {
    expect(check('2026-10-10,ichiryumanbaibi,"https://example.com/koyomi?a=1,2",KY\r\n').errors).toEqual([]);
  });

  it('source_url の空欄を検出', () => {
    expect(msgs(check('2026-10-10,ichiryumanbaibi,,KY\n'))).toMatch(/source_url が空/);
  });

  it('日付・年・type・checked_by・重複を検出', () => {
    const m = msgs(
      check(
        [
          '2026-02-30,taian,https://example.com,KY',
          '2027-01-01,taian,https://example.com,KY',
          '2026-10-11,butsumetsu,https://example.com,KY',
          '2026-10-12,taian,https://example.com,',
          '2026-10-13,taian,https://example.com,KY',
          '2026-10-13,taian,https://example.com,KY',
          '2026-10-14,taian,not-a-url,KY',
        ].join('\n'),
      ),
    );
    expect(m).toMatch(/2行目：date/);
    expect(m).toMatch(/2027-01-01 は 2026 年/);
    expect(m).toMatch(/type「butsumetsu」/);
    expect(m).toMatch(/checked_by が空/);
    expect(m).toMatch(/2026-10-13 の taian が重複/);
    expect(m).toMatch(/URL ではありません/);
  });

  it('Excel が付ける BOM 付きでも読める', () => {
    const r = fresh();
    validateCalendarCsv(`${String.fromCharCode(0xfeff)}${header}2026-10-10,taian,https://example.com,KY\n`, '2026.csv', r);
    expect(r.errors).toEqual([]);
  });

  it('ヘッダー違いを検出', () => {
    const r = fresh();
    validateCalendarCsv('date,type\n', '2026.csv', r);
    expect(msgs(r)).toMatch(/1行目/);
  });
});

describe('レビューのゲートと書き出し（docs/07 M2：birthdays.reviewed が置かれるまで M3 本番生成は不可）', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kaiun-data-'));
    cpSync(DATA_DIR, dir, { recursive: true });
    rmSync(join(dir, 'birthdays.reviewed'), { force: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('birthdays.reviewed がなければ例外、置けば通る', () => {
    expect(() => assertBirthdaysReviewed(dir)).toThrow(BirthdaysNotReviewedError);
    writeFileSync(join(dir, 'birthdays.reviewed'), '');
    expect(() => assertBirthdaysReviewed(dir)).not.toThrow();
  });

  it('未レビューは警告として出る', () => {
    expect(validateData(dir).warnings.map((w) => w.file)).toContain('data/birthdays.reviewed');
  });

  it('既存の birthdays.yaml とレビュー済みは --force なしで上書きしない', () => {
    expect(writeBirthdays({ dataDir: dir }).written).toBe(false);
    writeFileSync(join(dir, 'birthdays.reviewed'), '');
    const r = writeBirthdays({ dataDir: dir });
    expect(r).toMatchObject({ written: false });
    expect(r.reason).toMatch(/レビュー済み/);
    expect(writeBirthdays({ dataDir: dir, force: true }).written).toBe(true);
  });

  it('ファイルがなければ書き出せる', () => {
    rmSync(join(dir, 'birthdays.yaml'));
    expect(writeBirthdays({ dataDir: dir }).written).toBe(true);
    expect(existsSync(join(dir, 'birthdays.yaml'))).toBe(true);
    expect(validateData(dir).errors).toEqual([]);
  });

  it('壊れた YAML・ファイル欠落はエラー', () => {
    writeFileSync(join(dir, 'affirmations.yaml'), 'a: [\n');
    rmSync(join(dir, 'motif_en.yaml'));
    const m = msgs(validateData(dir));
    expect(m).toMatch(/YAML として読めません/);
    expect(m).toMatch(/ファイルがありません/);
  });

  it('カレンダーに出典なしの行があると検出', () => {
    writeFileSync(join(dir, 'calendar', '2026.csv'), 'date,type,source_url,checked_by\n2026-10-10,taian,,KY\n');
    expect(msgs(validateData(dir))).toMatch(/source_url が空/);
  });

  it('yaml の書式例（stringify）でも読める', () => {
    writeFileSync(join(dir, 'affirmations.yaml'), stringify([{ id: 'a001', text: 'テスト' }]));
    expect(validateData(dir).errors).toEqual([]);
  });
});
