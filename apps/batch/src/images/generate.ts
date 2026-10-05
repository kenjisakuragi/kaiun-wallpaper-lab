// 画像生成（docs/07 M3）：計画（dry-run）→ 生成 → 2サイズに整形 → R2 アップロード → images に記録。
// 冪等：approved / generated がある (kind, key) は作り直さない。rejected なら version+1 で作り直す。--force で version+1。

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SqlDb } from '@kaiun/client-d1';
import type { ObjectStorage } from '@kaiun/client-r2';
import { newId, nowJstIso } from '@kaiun/core';
import type { ImageJob } from './prompts.ts';
import { processImage } from './process.ts';
import { type ImageRow, insertImage, latestImagesByKind, totalCostUsd } from './repo.ts';

export type GeneratedImage = { png: Uint8Array; model: string; quality: string; costUsd: number };

export type ImageGenerator = {
  name: 'codex' | 'openai';
  /** 同時に生成する枚数（codex は1） */
  concurrency: number;
  costUsdPerImage: number;
  secondsPerImage: number;
  generate(prompt: string, name: string): Promise<GeneratedImage>;
};

export type GenLogger = {
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
};

export type GenerateDeps = {
  db: SqlDb;
  storage: ObjectStorage;
  generator: ImageGenerator;
  randomPrefix: string;
  /** IMAGE_BUDGET_USD（費用のかかる経路のときだけ効く） */
  budgetUsd?: number;
  /** レビュー用に整形済み画像を置く場所（例 out/images） */
  localOutDir?: string;
  log: GenLogger;
  now?: () => Date;
  /** CLAUDE.md ルール8：最大2回 */
  maxRetries?: number;
  /** 連続でこの枚数が失敗したら、残りに手を付けずに止める（生成環境そのものの不調で全件を失敗にしないため） */
  maxConsecutiveFailures?: number;
};

export type PlannedJob = ImageJob & { version: number };
export type Plan = {
  toGenerate: PlannedJob[];
  skipped: { job: ImageJob; reason: string }[];
  estimatedCostUsd: number;
  estimatedMinutes: number;
};

export class BudgetExceededError extends Error {
  constructor(spent: number, estimate: number, budget: number) {
    super(`画像生成の予算を超えるため開始しません（使用済み $${spent.toFixed(2)} ＋ 今回の推定 $${estimate.toFixed(2)} ＞ 予算 $${budget.toFixed(2)}）`);
    this.name = 'BudgetExceededError';
  }
}

export async function planImages(deps: GenerateDeps, jobs: ImageJob[], opts: { force?: boolean; limit?: number } = {}): Promise<Plan> {
  const toGenerate: PlannedJob[] = [];
  const skipped: Plan['skipped'] = [];
  const latestByKind = new Map<string, Map<string, ImageRow>>();
  for (const kind of new Set(jobs.map((j) => j.kind))) latestByKind.set(kind, await latestImagesByKind(deps.db, kind));
  for (const job of jobs) {
    const latest = latestByKind.get(job.kind)?.get(job.key);
    if (latest && latest.status !== 'rejected' && !opts.force) {
      skipped.push({ job, reason: `生成済み（v${latest.version}・${latest.status}）` });
      continue;
    }
    toGenerate.push({ ...job, version: (latest?.version ?? 0) + 1 });
  }
  const limited = opts.limit !== undefined ? toGenerate.slice(0, opts.limit) : toGenerate;
  const g = deps.generator;
  return {
    toGenerate: limited,
    skipped,
    estimatedCostUsd: limited.length * g.costUsdPerImage,
    estimatedMinutes: Math.ceil((limited.length * g.secondsPerImage) / g.concurrency / 60),
  };
}

export function storageKeys(prefix: string, job: PlannedJob) {
  const base = `images/${prefix}/${job.kind}/${job.key}_v${job.version}`;
  return { full: `${base}.jpg`, preview: `${base}_preview.jpg` };
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number, onRetry: (attempt: number, e: unknown) => void): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= maxRetries) throw e;
      onRetry(attempt + 1, e);
    }
  }
}

export type RunResult = {
  generated: ImageRow[];
  failed: { kind: string; key: string; error: string }[];
  /** 連続失敗で途中停止したか（停止後の残りは失敗にも生成にも数えない） */
  aborted: boolean;
};

export async function runPlan(deps: GenerateDeps, plan: Plan): Promise<RunResult> {
  const g = deps.generator;
  if (g.costUsdPerImage > 0 && deps.budgetUsd !== undefined) {
    const spent = await totalCostUsd(deps.db);
    if (spent + plan.estimatedCostUsd > deps.budgetUsd) throw new BudgetExceededError(spent, plan.estimatedCostUsd, deps.budgetUsd);
  }
  const now = deps.now ?? (() => new Date());
  const maxRetries = deps.maxRetries ?? 2;
  const result: RunResult = { generated: [], failed: [], aborted: false };
  const queue = [...plan.toGenerate];
  const maxConsecutive = deps.maxConsecutiveFailures ?? 3;
  let consecutive = 0;

  async function one(job: PlannedJob) {
    const name = `${job.kind}_${job.key}_v${job.version}`;
    try {
      const img = await withRetry(() => g.generate(job.prompt, name), maxRetries, (attempt, e) =>
        deps.log.warn('image.retry', { kind: job.kind, key: job.key, attempt, error: e instanceof Error ? e.message : String(e) }),
      );
      const { full, preview } = await processImage(img.png);
      const keys = storageKeys(deps.randomPrefix, job);
      await deps.storage.put(keys.full, full, 'image/jpeg');
      await deps.storage.put(keys.preview, preview, 'image/jpeg');
      if (deps.localOutDir) {
        const dir = join(deps.localOutDir, job.kind);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${job.key}_v${job.version}.jpg`), full);
        writeFileSync(join(dir, `${job.key}_v${job.version}_preview.jpg`), preview);
      }
      const row: ImageRow = {
        id: newId(),
        kind: job.kind,
        key: job.key,
        version: job.version,
        prompt_hash: job.promptHash,
        model: img.model,
        quality: img.quality,
        r2_url_full: deps.storage.publicUrl(keys.full),
        r2_url_preview: deps.storage.publicUrl(keys.preview),
        cost_usd: img.costUsd,
        status: 'generated',
        created_at: nowJstIso(now()),
      };
      await insertImage(deps.db, row);
      result.generated.push(row);
      consecutive = 0;
      deps.log.info('image.generated', { kind: job.kind, key: job.key, version: job.version, generator: g.name });
    } catch (e) {
      // 失敗はスキップして記録し、次へ進む（CLAUDE.md ルール8）
      const error = e instanceof Error ? e.message : String(e);
      result.failed.push({ kind: job.kind, key: job.key, error });
      deps.log.error('image.failed', { kind: job.kind, key: job.key, error });
      if (++consecutive >= maxConsecutive && !result.aborted) {
        result.aborted = true;
        queue.length = 0;
        deps.log.error('image.aborted', { reason: `${maxConsecutive} consecutive failures`, remainingSkipped: true });
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, g.concurrency) }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) await one(job);
  });
  await Promise.all(workers);
  return result;
}
