// 実際に codex で3枚生成し、R2 に上げ、公開URLから取得できることを確かめる（docs/07 M3 完了条件）。
// CI では実行しない（vitest.config.ts で *.live.test.ts を除外）。手元で実行するとき：
//   pnpm vitest run --config vitest.live.config.ts
// 必要な環境変数：CODEX_BIN、R2 一式（docs/04 §2）。DB は DB_MODE に従う。

import { describe, expect, it } from 'vitest';
import { planImages, runPlan } from '../src/images/generate.ts';
import { buildJobs } from '../src/images/prompts.ts';
import { buildDb, buildGenerator, buildLogger, buildStorage, loadDotEnv } from '../src/runtime.ts';

loadDotEnv();

describe('live：codex で3枚生成 → R2 → 公開URLで取得', () => {
  it('3枚生成でき、公開URLから JPEG が取れ、2回目は再生成しない', async () => {
    const db = buildDb();
    const { storage, randomPrefix } = buildStorage();
    const { generator } = buildGenerator('codex');
    const deps = { db, storage, randomPrefix, generator, log: buildLogger() };
    const jobs = buildJobs('kaiunbi').slice(0, 3);
    const r = await runPlan(deps, await planImages(deps, jobs));
    expect(r.failed).toEqual([]);
    for (const row of r.generated) {
      const res = await fetch(row.r2_url_full as string);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('image/jpeg');
    }
    expect((await planImages(deps, jobs)).toGenerate).toEqual([]);
  }, 1_800_000);
});
