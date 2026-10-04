// マイグレーションをローカル D1（wrangler の getPlatformProxy = workerd の D1 実装）に適用して検証する。

import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readMigrationStatements, splitSqlStatements } from '../src/migrations.ts';
import { TABLES } from '../src/schema.ts';

// テストで使う D1 の最小限の型（@cloudflare/workers-types を入れずに済ませる）
type D1Stmt = {
  bind(...values: unknown[]): D1Stmt;
  run(): Promise<unknown>;
  all<T>(): Promise<{ results: T[] }>;
  first(): Promise<unknown>;
};
type D1 = { prepare(sql: string): D1Stmt; batch(stmts: D1Stmt[]): Promise<unknown> };

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1 }>>>;
let db: D1;

const NOW = '2026-10-10T07:00:00+09:00';

beforeAll(async () => {
  // persist: false でメモリ上の D1 を使う（毎回まっさらな状態から適用）
  proxy = await getPlatformProxy<{ DB: D1 }>({
    configPath: join(import.meta.dirname, '..', 'wrangler.toml'),
    persist: false,
    envFiles: [],
  });
  db = proxy.env.DB;
  for (const { statements } of readMigrationStatements()) {
    await db.batch(statements.map((s) => db.prepare(s)));
  }
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

describe('マイグレーション（docs/07 M1 完了条件：ローカル D1 で適用できる）', () => {
  it('docs/05 の全テーブルができる', async () => {
    const { results } = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")
      .all<{ name: string }>();
    expect(results.map((r) => r.name).sort()).toEqual([...TABLES].sort());
  });

  it('posts は媒体別の retry_count / error を持つ（docs/09 #14）', async () => {
    const { results } = await db.prepare('PRAGMA table_info(posts)').all<{ name: string }>();
    const cols = results.map((r) => r.name);
    expect(cols).toEqual(expect.arrayContaining(['threads_retry_count', 'ig_retry_count', 'threads_error', 'ig_error']));
    expect(cols).not.toContain('retry_count');
  });

  it('threads_replies.inbound_reply_id は一意（二重返信防止）', async () => {
    const insert = (id: string) =>
      db
        .prepare(
          'INSERT INTO threads_replies (id, inbound_reply_id, author_hash, parsed_ok, status, received_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(id, 'inbound-1', 'hash', 1, 'pending', NOW)
        .run();
    await insert('r1');
    await expect(insert('r2')).rejects.toThrow(/UNIQUE/);
  });

  it('images は (kind, key, version) で一意', async () => {
    const insert = (id: string) =>
      db
        .prepare('INSERT INTO images (id, kind, key, version, prompt_hash, model, quality, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, 'birthday', '03-15', 1, 'h', 'm', 'medium', NOW)
        .run();
    await insert('i1');
    await expect(insert('i2')).rejects.toThrow(/UNIQUE/);
  });

  it('posts は (scheduled_date, slot) で一意、status の初期値は planned', async () => {
    const insert = (id: string) =>
      db
        .prepare('INSERT INTO posts (id, scheduled_date, slot, theme, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, '2026-10-10', 1, 'affirmation', NOW, NOW)
        .run();
    await insert('p1');
    await expect(insert('p2')).rejects.toThrow(/UNIQUE/);
    const row = await db.prepare('SELECT threads_status, ig_status, threads_retry_count FROM posts WHERE id = ?').bind('p1').first();
    expect(row).toEqual({ threads_status: 'planned', ig_status: 'planned', threads_retry_count: 0 });
  });

  it('post_metrics は (post_id, platform, measured_at) が主キー', async () => {
    const insert = () =>
      db.prepare('INSERT INTO post_metrics (post_id, platform, measured_at, views) VALUES (?, ?, ?, ?)').bind('p1', 'threads', NOW, 10).run();
    await insert();
    await expect(insert()).rejects.toThrow(/UNIQUE|PRIMARY/);
  });

  it('月日・本文・生のユーザー名を持つ列がない（CLAUDE.md ルール2）', async () => {
    for (const table of ['threads_replies', 'inbound_messages']) {
      const { results } = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
      const cols = results.map((r) => r.name);
      for (const banned of ['birthday_md', 'month_day', 'body', 'text', 'username', 'user_id']) {
        expect(cols, `${table}.${banned}`).not.toContain(banned);
      }
    }
    const { results } = await db.prepare('PRAGMA table_info(users)').all<{ name: string }>();
    expect(results.map((r) => r.name)).not.toEqual(expect.arrayContaining(['birth_year', 'user_id']));
  });
});

describe('splitSqlStatements', () => {
  it('コメントを除いて文に分ける', () => {
    expect(splitSqlStatements('-- c\nCREATE TABLE a (x TEXT); -- d\n\nCREATE TABLE b (y TEXT);\n')).toEqual([
      'CREATE TABLE a (x TEXT)',
      'CREATE TABLE b (y TEXT)',
    ]);
  });
});
