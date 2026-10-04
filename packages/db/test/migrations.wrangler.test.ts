// `wrangler d1 migrations apply --local` で実際に適用できることを確認する（外部通信なし、ローカルのみ）。
// 手順の根拠：https://developers.cloudflare.com/workers/wrangler/commands/d1/ （2026-10-04 確認）

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { TABLES } from '../src/schema.ts';

const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const persistTo = mkdtempSync(join(tmpdir(), 'kaiun-d1-'));
// Windows でシェル経由にすると引数の空白が分割されるため、wrangler の JS を node で直接起動する
const WRANGLER_BIN = join(dirname(createRequire(join(PKG_DIR, 'package.json')).resolve('wrangler/package.json')), 'bin', 'wrangler.js');

function wrangler(args: string[]) {
  const r = spawnSync(process.execPath, [WRANGLER_BIN, ...args, '--local', '--persist-to', persistTo], {
    cwd: PKG_DIR,
    encoding: 'utf8',
    // CI=true で確認プロンプトを自動でスキップし、テレメトリも送らない
    env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
    timeout: 120_000,
  });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

afterAll(() => {
  rmSync(persistTo, { recursive: true, force: true });
});

describe('wrangler d1 migrations apply --local', () => {
  it('適用でき、全テーブルが作られ、再実行しても変化しない', () => {
    const apply = wrangler(['d1', 'migrations', 'apply', 'DB']);
    expect(apply.code, apply.out).toBe(0);
    expect(apply.out).toContain('0001_init.sql');

    const q = wrangler([
      'd1',
      'execute',
      'DB',
      '--json',
      '--command',
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ]);
    expect(q.code, q.out).toBe(0);
    for (const t of TABLES) expect(q.out).toContain(`"${t}"`);
    expect(q.out).toContain('"d1_migrations"');

    const again = wrangler(['d1', 'migrations', 'apply', 'DB']);
    expect(again.code, again.out).toBe(0);
    expect(again.out).toMatch(/No migrations to apply/i);
  }, 180_000);
});
