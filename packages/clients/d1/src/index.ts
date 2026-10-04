// D1 をバッチ（Node）から使うためのクライアント。
// - d1：Cloudflare REST API（本番）。https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/ （2026-10-04 確認）
// - local：node:sqlite のファイル／メモリ DB（開発・テスト）。マイグレーションを自動で当てる。

import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';

export type SqlValue = string | number | null;
export type Row = Record<string, unknown>;

export type SqlDb = {
  all<T extends Row = Row>(sql: string, params?: SqlValue[]): Promise<T[]>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
};

const D1ResponseSchema = z.object({
  success: z.boolean(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
  result: z
    .array(
      z.object({
        success: z.boolean(),
        results: z.array(z.record(z.string(), z.unknown())).default([]),
        meta: z.object({ changes: z.number().optional() }).passthrough().optional(),
      }),
    )
    .optional(),
});

export class D1Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'D1Error';
  }
}

export type D1HttpOptions = {
  accountId: string;
  databaseId: string;
  apiToken: string;
  fetch?: typeof fetch;
};

export function createD1HttpDb(opts: D1HttpOptions): SqlDb {
  const doFetch = opts.fetch ?? fetch;
  const url = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/d1/database/${opts.databaseId}/query`;
  async function query(sql: string, params: SqlValue[] = []) {
    const res = await doFetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiToken}`, 'Content-Type': 'application/json' },
      // REST API の params は文字列の配列（数値は SQLite 側で型変換される）
      body: JSON.stringify({ sql, params: params.map((p) => (p === null ? null : String(p))) }),
    });
    const parsed = D1ResponseSchema.safeParse(await res.json().catch(() => ({})));
    if (!res.ok || !parsed.success || !parsed.data.success) {
      const msg = parsed.success ? (parsed.data.errors ?? []).map((e) => e.message).join('; ') : 'unexpected response';
      throw new D1Error(`D1 query failed (${res.status}): ${msg}`);
    }
    const first = parsed.data.result?.[0];
    return { rows: first?.results ?? [], changes: first?.meta?.changes ?? 0 };
  }
  return {
    async all<T extends Row = Row>(sql: string, params?: SqlValue[]) {
      return (await query(sql, params)).rows as T[];
    },
    async run(sql, params) {
      return { changes: (await query(sql, params)).changes };
    },
  };
}

/** path に ':memory:' を渡すとメモリ DB。migrations は文の配列（packages/db の readMigrationStatements）。 */
export function createLocalDb(path: string, migrations: string[] = []): SqlDb & { close(): void } {
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE IF NOT EXISTS _local_migrations (stmt_hash TEXT PRIMARY KEY)');
  for (const stmt of migrations) {
    const key = String(stmt.length) + ':' + stmt.slice(0, 120);
    const done = db.prepare('SELECT 1 FROM _local_migrations WHERE stmt_hash = ?').get(key);
    if (done) continue;
    db.exec(stmt);
    db.prepare('INSERT INTO _local_migrations (stmt_hash) VALUES (?)').run(key);
  }
  return {
    async all<T extends Row = Row>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async run(sql, params = []) {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes) };
    },
    close() {
      db.close();
    },
  };
}

/** wrangler CLI を実行する関数（args を渡し、標準出力を返す）。runtime が本物を、テストがモックを渡す */
export type WranglerRunner = (args: string[]) => Promise<string>;

/** SQLite のリテラルに変換（wrangler d1 execute はバインド変数を受け付けないため） */
export function toSqlLiteral(v: SqlValue): string {
  if (v === null) return 'NULL';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new D1Error(`non-finite number: ${v}`);
    return String(v);
  }
  return `'${v.replace(/'/g, "''")}'`;
}

/** `?` を順にリテラルへ置き換える（文字列リテラル内の ? は置き換えない） */
export function inlineParams(sql: string, params: SqlValue[] = []): string {
  let i = 0;
  let out = '';
  let inQuote = false;
  for (const ch of sql) {
    if (ch === "'") inQuote = !inQuote;
    if (ch === '?' && !inQuote) {
      if (i >= params.length) throw new D1Error('not enough params for placeholders');
      out += toSqlLiteral(params[i++] as SqlValue);
    } else {
      out += ch;
    }
  }
  if (i !== params.length) throw new D1Error('too many params for placeholders');
  return out;
}

const WranglerD1Schema = z.array(
  z.object({
    success: z.boolean(),
    results: z.array(z.record(z.string(), z.unknown())).default([]),
    meta: z.object({ changes: z.number().optional() }).passthrough().optional(),
  }),
);

/**
 * 手元実行用：wrangler login の認証で本番 D1 を操作する（API トークン不要）。
 * binding は wrangler.toml の [[d1_databases]] の binding 名。
 */
export function createWranglerD1Db(run: WranglerRunner, binding = 'DB'): SqlDb {
  async function query(sql: string, params?: SqlValue[]) {
    const stdout = await run(['d1', 'execute', binding, '--remote', '--json', '--command', inlineParams(sql, params)]);
    const start = stdout.indexOf('[');
    const parsed = WranglerD1Schema.safeParse(JSON.parse(start >= 0 ? stdout.slice(start) : stdout));
    if (!parsed.success || !parsed.data[0]?.success) throw new D1Error('wrangler d1 execute failed');
    return { rows: parsed.data[0].results, changes: parsed.data[0].meta?.changes ?? 0 };
  }
  return {
    async all<T extends Row = Row>(sql: string, params?: SqlValue[]) {
      return (await query(sql, params)).rows as T[];
    },
    async run(sql, params) {
      return { changes: (await query(sql, params)).changes };
    },
  };
}
