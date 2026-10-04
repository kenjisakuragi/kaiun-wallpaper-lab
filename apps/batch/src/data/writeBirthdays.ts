import { existsSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { dataPaths } from '../paths.ts';
import { BIRTHDAYS_HEADER, generateBirthdays } from './birthdayRules.ts';

export function renderBirthdaysYaml(): string {
  // date を文字列のまま保つため、値はすべてダブルクォートで出す
  return `${BIRTHDAYS_HEADER}\n${stringify(generateBirthdays(), { defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' })}`;
}

export type WriteResult = { written: boolean; reason?: string };

/**
 * birthdays.yaml を書き出す。レビュー済み（birthdays.reviewed あり）や既存ファイルは、--force なしでは上書きしない。
 */
export function writeBirthdays(opts: { dataDir?: string; force?: boolean } = {}): WriteResult {
  const p = dataPaths(opts.dataDir);
  if (!opts.force) {
    if (existsSync(p.birthdaysReviewed)) return { written: false, reason: 'レビュー済み（birthdays.reviewed あり）のため上書きしません。作り直す場合は --force（レビューもやり直し）' };
    if (existsSync(p.birthdays)) return { written: false, reason: 'birthdays.yaml がすでにあります。作り直す場合は --force' };
  }
  writeFileSync(p.birthdays, renderBirthdaysYaml(), 'utf8');
  return { written: true };
}
