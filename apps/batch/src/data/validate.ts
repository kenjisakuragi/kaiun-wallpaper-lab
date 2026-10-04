// 題材データの検証（docs/07 M2：batch:validate-data）。

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { formatMonthDay, isValidMonthDay, isValidYmd } from '@kaiun/core';
import { parse } from 'yaml';
import { dataPaths } from '../paths.ts';
import { parseCsv } from './csv.ts';

export type Issue = { file: string; message: string };
export type ValidationResult = { errors: Issue[]; warnings: Issue[] };

export const KAIUNBI_TYPES = ['ichiryumanbaibi', 'tenshabi', 'toranohi', 'minohi', 'taian', 'shingetsu', 'mangetsu'] as const;
export const CALENDAR_HEADER = ['date', 'type', 'source_url', 'checked_by'] as const;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const MD_RE = /^(\d{2})-(\d{2})$/;
const AFFIRMATION_ID_RE = /^a\d{3}$/;
export const AFFIRMATION_MAX_CHARS = 40;

/** 2/29 を含む366日の MM-DD */
export function allMonthDays(): string[] {
  const out: string[] = [];
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= 31; d++) if (isValidMonthDay(m, d)) out.push(formatMonthDay(m, d));
  return out;
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown): string => (typeof x === 'string' ? x.trim() : '');
const charLen = (s: string) => Array.from(s).length;

function readYaml(path: string, file: string, res: ValidationResult): unknown {
  if (!existsSync(path)) {
    res.errors.push({ file, message: 'ファイルがありません' });
    return undefined;
  }
  try {
    return parse(readFileSync(path, 'utf8'));
  } catch (e) {
    res.errors.push({ file, message: `YAML として読めません：${(e as Error).message}` });
    return undefined;
  }
}

export function validateMotifEn(raw: unknown, res: ValidationResult, file = 'data/motif_en.yaml'): Map<string, string> {
  const map = new Map<string, string>();
  if (raw === undefined) return map;
  if (!isRecord(raw)) {
    res.errors.push({ file, message: '「日本語: 英語」の対応表になっていません' });
    return map;
  }
  for (const [ja, en] of Object.entries(raw)) {
    if (str(en) === '') res.errors.push({ file, message: `${ja}：英訳が空です` });
    else map.set(ja, str(en));
  }
  return map;
}

export function validateBirthdays(raw: unknown, motifEn: Map<string, string>, res: ValidationResult, file = 'data/birthdays.yaml'): void {
  if (raw === undefined) return;
  if (!Array.isArray(raw)) {
    res.errors.push({ file, message: '配列（- date: ...）になっていません' });
    return;
  }
  const seen = new Map<string, number>();
  const colorNames = new Map<string, string>();
  raw.forEach((entry, i) => {
    const at = `${i + 1}件目`;
    if (!isRecord(entry)) {
      res.errors.push({ file, message: `${at}：項目の形式が不正です` });
      return;
    }
    const date = str(entry.date);
    const label = date || at;
    const m = MD_RE.exec(date);
    if (!m || !isValidMonthDay(Number(m[1]), Number(m[2]))) {
      res.errors.push({ file, message: `${at}：date が MM-DD の実在する日付ではありません（${date || '空'}）` });
    } else {
      seen.set(date, (seen.get(date) ?? 0) + 1);
    }
    const colorName = str(entry.color_name);
    if (colorName === '') res.errors.push({ file, message: `${label}：color_name が空です` });
    else if (colorNames.has(colorName)) res.warnings.push({ file, message: `${label}：color_name「${colorName}」が ${colorNames.get(colorName)} と重複しています` });
    else colorNames.set(colorName, label);
    if (!HEX_RE.test(str(entry.color_hex))) res.errors.push({ file, message: `${label}：color_hex が #RRGGBB 形式ではありません（${str(entry.color_hex) || '空'}）` });
    const motif = str(entry.motif);
    if (motif === '') res.errors.push({ file, message: `${label}：motif が空です` });
    else if (!motifEn.has(motif)) res.errors.push({ file, message: `${label}：motif「${motif}」の英訳が data/motif_en.yaml にありません` });
    const keyword = str(entry.keyword);
    if (charLen(keyword) < 2 || charLen(keyword) > 6) res.errors.push({ file, message: `${label}：keyword は2〜6文字にしてください（${keyword || '空'}）` });
  });
  for (const [date, count] of seen) if (count > 1) res.errors.push({ file, message: `${date}：${count}件あります（重複）` });
  const missing = allMonthDays().filter((md) => !seen.has(md));
  if (missing.length > 0) res.errors.push({ file, message: `欠落している日付（${missing.length}件）：${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' ほか' : ''}` });
}

export function validateAffirmations(raw: unknown, res: ValidationResult, file = 'data/affirmations.yaml'): void {
  if (raw === undefined) return;
  if (!Array.isArray(raw)) {
    res.errors.push({ file, message: '配列（- id: ...）になっていません' });
    return;
  }
  const ids = new Set<string>();
  const texts = new Map<string, string>();
  raw.forEach((entry, i) => {
    const at = `${i + 1}件目`;
    if (!isRecord(entry)) {
      res.errors.push({ file, message: `${at}：項目の形式が不正です` });
      return;
    }
    const id = str(entry.id);
    const label = id || at;
    if (!AFFIRMATION_ID_RE.test(id)) res.errors.push({ file, message: `${at}：id は a001 形式にしてください（${id || '空'}）` });
    else if (ids.has(id)) res.errors.push({ file, message: `${id}：id が重複しています` });
    else ids.add(id);
    const text = str(entry.text);
    if (text === '') res.errors.push({ file, message: `${label}：text が空です` });
    else if (charLen(text) > AFFIRMATION_MAX_CHARS) res.errors.push({ file, message: `${label}：text が${AFFIRMATION_MAX_CHARS}文字を超えています（${charLen(text)}文字）` });
    else if (texts.has(text)) res.errors.push({ file, message: `${label}：text が ${texts.get(text)} と重複しています` });
    else texts.set(text, label);
  });
  if (raw.length === 0) res.errors.push({ file, message: '1件もありません' });
}

export function validateCalendarCsv(content: string, fileName: string, res: ValidationResult): void {
  const file = `data/calendar/${fileName}`;
  const year = basename(fileName, '.csv');
  const rows = parseCsv(content);
  const header = rows[0];
  if (!header || header.map((h) => h.trim()).join(',') !== CALENDAR_HEADER.join(',')) {
    res.errors.push({ file, message: `1行目は「${CALENDAR_HEADER.join(',')}」にしてください` });
    return;
  }
  const seen = new Set<string>();
  rows.slice(1).forEach((cols, i) => {
    const line = `${i + 2}行目`;
    if (cols.length !== CALENDAR_HEADER.length) {
      res.errors.push({ file, message: `${line}：列の数が${CALENDAR_HEADER.length}ではありません` });
      return;
    }
    const [date, type, sourceUrl, checkedBy] = cols.map((c) => c.trim()) as [string, string, string, string];
    if (!isValidYmd(date)) res.errors.push({ file, message: `${line}：date が YYYY-MM-DD の実在する日付ではありません（${date || '空'}）` });
    else if (!date.startsWith(`${year}-`)) res.errors.push({ file, message: `${line}：${date} は ${year} 年のファイルに入っています` });
    if (!(KAIUNBI_TYPES as readonly string[]).includes(type)) res.errors.push({ file, message: `${line}：type「${type}」は使えません（${KAIUNBI_TYPES.join(' / ')}）` });
    if (sourceUrl === '') res.errors.push({ file, message: `${line}：source_url が空です（出典を入れてください）` });
    else if (!/^https?:\/\/\S+$/.test(sourceUrl)) res.errors.push({ file, message: `${line}：source_url が URL ではありません` });
    if (checkedBy === '') res.errors.push({ file, message: `${line}：checked_by が空です` });
    const key = `${date},${type}`;
    if (seen.has(key)) res.errors.push({ file, message: `${line}：${date} の ${type} が重複しています` });
    seen.add(key);
  });
}

/** data/ 一式を検証する */
export function validateData(dataDir?: string): ValidationResult {
  const p = dataPaths(dataDir);
  const res: ValidationResult = { errors: [], warnings: [] };
  const motifEn = validateMotifEn(readYaml(p.motifEn, 'data/motif_en.yaml', res), res);
  validateBirthdays(readYaml(p.birthdays, 'data/birthdays.yaml', res), motifEn, res);
  validateAffirmations(readYaml(p.affirmations, 'data/affirmations.yaml', res), res);
  if (!existsSync(p.calendarDir)) {
    res.errors.push({ file: 'data/calendar', message: 'フォルダがありません' });
  } else {
    const files = readdirSync(p.calendarDir).filter((f) => /^\d{4}\.csv$/.test(f));
    if (files.length === 0) res.errors.push({ file: 'data/calendar', message: 'YYYY.csv がありません' });
    for (const f of files.sort()) validateCalendarCsv(readFileSync(join(p.calendarDir, f), 'utf8'), f, res);
  }
  if (!existsSync(p.birthdaysReviewed)) {
    res.warnings.push({ file: 'data/birthdays.reviewed', message: 'まだ置かれていません（人のレビュー後に置くまで、本番の画像生成は動きません）' });
  }
  return res;
}
