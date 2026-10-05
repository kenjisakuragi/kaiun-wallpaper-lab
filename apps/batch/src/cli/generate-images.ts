// pnpm batch:generate-images --kind birthday|kaiunbi|affirmation|common [--from 01-01 --to 12-31] [--keys a001,a002]
//   [--limit 20] [--dry-run] [--force] [--generator codex|openai]
// docs/07 M3。dry-run は枚数と推定コスト（openai）／推定時間（codex）を表示するだけで、生成もアップロードもしない。

import { parseArgs } from 'node:util';
import { ESTIMATED_COST_USD } from '@kaiun/client-openai';
import { loadConfig } from '@kaiun/core';
import { ImageKind } from '@kaiun/db';
import { assertBirthdaysReviewed } from '../data/reviewGate.ts';
import { type ImageGenerator, planImages, runPlan } from '../images/generate.ts';
import { buildJobs } from '../images/prompts.ts';
import { writeReviewPage } from '../images/review.ts';
import { buildDb, buildGenerator, buildLogger, buildStorage, loadDotEnv, OUT_DIR } from '../runtime.ts';
import { join } from 'node:path';

const out = (s: string) => process.stdout.write(`${s}\n`);

/** dry-run 用：鍵や codex がなくても見積もりだけ出せる生成器 */
function estimateOnly(name: 'codex' | 'openai'): ImageGenerator {
  const unavailable = async (): Promise<never> => {
    throw new Error('dry-run');
  };
  // codex の1枚あたり時間は 2026-10-04 のサンプル3枚の実測（約75〜90秒）から
  if (name === 'codex') return { name, concurrency: 1, costUsdPerImage: 0, secondsPerImage: 90, generate: unavailable };
  const quality = (process.env.OPENAI_IMAGE_QUALITY ?? 'medium') as keyof typeof ESTIMATED_COST_USD;
  return {
    name,
    concurrency: Number(process.env.IMAGE_CONCURRENCY ?? 3),
    costUsdPerImage: ESTIMATED_COST_USD[quality] ?? ESTIMATED_COST_USD.medium,
    secondsPerImage: 40,
    generate: unavailable,
  };
}

async function main(): Promise<number> {
  loadDotEnv();
  const { values } = parseArgs({
    options: {
      kind: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      keys: { type: 'string' },
      limit: { type: 'string' },
      generator: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
    },
  });
  const kind = ImageKind.safeParse(values.kind);
  if (!kind.success) {
    out(`--kind は ${ImageKind.options.join(' / ')} のどれかを指定してください`);
    return 2;
  }
  const override = values.generator === 'codex' || values.generator === 'openai' ? values.generator : undefined;
  const filter = {
    ...(values.from ? { from: values.from } : {}),
    ...(values.to ? { to: values.to } : {}),
    ...(values.keys ? { keys: values.keys.split(',').map((k) => k.trim()) } : {}),
  };
  const jobs = buildJobs(kind.data, filter);
  const db = buildDb();
  const log = buildLogger();
  const dryRun = values['dry-run'];
  const genName = override ?? loadConfig(['imageGen']).imageGen.IMAGE_GENERATOR;
  const built = dryRun ? { generator: estimateOnly(genName) } : buildGenerator(override);
  const storage = dryRun ? { storage: { put: async () => {}, exists: async () => false, publicUrl: (k: string) => k }, randomPrefix: 'dry-run' } : buildStorage();
  const deps = {
    db,
    storage: storage.storage,
    randomPrefix: storage.randomPrefix,
    generator: built.generator,
    ...('budgetUsd' in built && built.budgetUsd !== undefined ? { budgetUsd: built.budgetUsd } : {}),
    localOutDir: join(OUT_DIR, 'images'),
    log,
  };
  const plan = await planImages(deps, jobs, { force: values.force, ...(values.limit ? { limit: Number(values.limit) } : {}) });

  out(`対象 ${jobs.length} 枚：生成 ${plan.toGenerate.length} 枚、スキップ ${plan.skipped.length} 枚（生成済み）`);
  if (built.generator.name === 'openai') out(`推定コスト：$${plan.estimatedCostUsd.toFixed(2)}（経路 openai）`);
  else out(`推定時間：約 ${plan.estimatedMinutes} 分（経路 codex、費用 0）`);
  if (dryRun) return 0;

  if (kind.data === 'birthday') assertBirthdaysReviewed();
  const result = await runPlan(deps, plan);
  const review = await writeReviewPage(db, join(OUT_DIR, 'review'), join(OUT_DIR, 'images'), new Map(jobs.map((j) => [`${j.kind}:${j.key}`, j.label])));
  out(`生成 ${result.generated.length} 枚、失敗 ${result.failed.length} 枚${result.aborted ? '（連続失敗のため途中で停止。再実行で続きから）' : ''}`);
  for (const f of result.failed) out(`  失敗：${f.kind} ${f.key}：${f.error}`);
  out(`承認待ち ${review.count} 枚：${review.htmlPath}`);
  return result.failed.length > 0 ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    out(`エラー：${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  },
);
