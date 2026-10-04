// マイグレーション SQL を読み、文ごとに分ける（テストとツールで使う。本番適用は wrangler）。

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export function listMigrationFiles(dir: string = MIGRATIONS_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();
}

/** `--` コメントを除き、`;` で文に分ける（文字列リテラル内の `;` は使わない前提） */
export function splitSqlStatements(sql: string): string[] {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

export function readMigrationStatements(dir: string = MIGRATIONS_DIR): { file: string; statements: string[] }[] {
  return listMigrationFiles(dir).map((file) => ({
    file,
    statements: splitSqlStatements(readFileSync(join(dir, file), 'utf8')),
  }));
}
