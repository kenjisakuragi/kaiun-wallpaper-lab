// CLI が使う依存（DB・ストレージ・画像生成・ログ）を設定から組み立てる。

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { createCodexImageClient } from '@kaiun/client-codex';
import { createD1HttpDb, createLocalDb, createWranglerD1Db, type SqlDb } from '@kaiun/client-d1';
import { createOpenAIImageClient } from '@kaiun/client-openai';
import { createR2Storage, createWranglerR2Storage, type ObjectStorage } from '@kaiun/client-r2';
import { createLogger, loadConfig, type Logger } from '@kaiun/core';
import { readMigrationStatements } from '@kaiun/db';
import type { ImageGenerator } from './images/generate.ts';
import { REPO_ROOT } from './paths.ts';

/** リポジトリ直下の .env があれば読む（値はログに出さない） */
export function loadDotEnv(): void {
  const path = join(REPO_ROOT, '.env');
  if (existsSync(path)) process.loadEnvFile(path);
}

const resolveRepo = (p: string) => (isAbsolute(p) ? p : join(REPO_ROOT, p));

/** packages/db の wrangler（wrangler.toml もそこにある）を node で直接起動する */
const DB_PKG_DIR = join(REPO_ROOT, 'packages', 'db');
export function wranglerRunner(): (args: string[]) => Promise<string> {
  const bin = join(dirname(createRequire(join(DB_PKG_DIR, 'package.json')).resolve('wrangler/package.json')), 'bin', 'wrangler.js');
  return (args) =>
    new Promise((resolve, reject) => {
      execFile(
        process.execPath,
        [bin, ...args],
        { cwd: DB_PKG_DIR, env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' }, maxBuffer: 64 * 1024 * 1024, windowsHide: true },
        (err, stdout, stderr) => (err ? reject(new Error(`wrangler ${args.slice(0, 3).join(' ')} failed: ${String(stderr).slice(-500)}`)) : resolve(String(stdout))),
      );
    });
}

export function buildDb(): SqlDb {
  const { db } = loadConfig(['db']);
  if (db.DB_MODE === 'wrangler') return createWranglerD1Db(wranglerRunner());
  if (db.DB_MODE === 'd1') {
    const { d1 } = loadConfig(['d1']);
    return createD1HttpDb({ accountId: d1.CLOUDFLARE_ACCOUNT_ID, databaseId: d1.D1_DATABASE_ID, apiToken: d1.CLOUDFLARE_API_TOKEN });
  }
  const path = resolveRepo(db.LOCAL_DB_PATH);
  mkdirSync(dirname(path), { recursive: true });
  return createLocalDb(path, readMigrationStatements().flatMap((m) => m.statements));
}

export function buildStorage(): { storage: ObjectStorage; randomPrefix: string } {
  const { r2 } = loadConfig(['r2']);
  if (r2.STORAGE_MODE === 'wrangler') {
    return {
      storage: createWranglerR2Storage({
        run: wranglerRunner(),
        bucket: r2.R2_BUCKET,
        publicBaseUrl: r2.R2_PUBLIC_BASE_URL,
        writeTemp: async (body) => {
          const dir = mkdtempSync(join(tmpdir(), 'kaiun-r2-'));
          const path = join(dir, 'object');
          writeFileSync(path, body);
          return { path, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
        },
      }),
      randomPrefix: r2.R2_RANDOM_PREFIX,
    };
  }
  const { r2S3 } = loadConfig(['r2S3']);
  return {
    storage: createR2Storage({
      accountId: r2S3.CLOUDFLARE_ACCOUNT_ID,
      accessKeyId: r2S3.R2_ACCESS_KEY_ID,
      secretAccessKey: r2S3.R2_SECRET_ACCESS_KEY,
      bucket: r2.R2_BUCKET,
      publicBaseUrl: r2.R2_PUBLIC_BASE_URL,
    }),
    randomPrefix: r2.R2_RANDOM_PREFIX,
  };
}

/** 画像生成の経路。codex は1枚ずつ・費用0、openai は並列・推定費用あり（docs/04 §1） */
export function buildGenerator(override?: 'codex' | 'openai'): { generator: ImageGenerator; budgetUsd?: number } {
  const { imageGen } = loadConfig(['imageGen']);
  const kind = override ?? imageGen.IMAGE_GENERATOR;
  if (kind === 'codex') {
    if (!imageGen.CODEX_BIN) throw new Error('CODEX_BIN が未設定です（IMAGE_GENERATOR=codex のとき必須）');
    const client = createCodexImageClient({ codexBin: imageGen.CODEX_BIN, workDir: join(REPO_ROOT, 'out', 'codex-work') });
    return {
      generator: { name: 'codex', concurrency: 1, costUsdPerImage: 0, secondsPerImage: 90, generate: client.generate },
    };
  }
  const { openaiImage } = loadConfig(['openaiImage']);
  // 再試行は generate 側（最大2回）でまとめて行うため、クライアント内では再試行しない
  const client = createOpenAIImageClient({ apiKey: openaiImage.OPENAI_API_KEY, model: openaiImage.OPENAI_IMAGE_MODEL, quality: openaiImage.OPENAI_IMAGE_QUALITY, maxRetries: 0 });
  return {
    generator: {
      name: 'openai',
      concurrency: openaiImage.IMAGE_CONCURRENCY,
      costUsdPerImage: client.costUsdPerImage,
      secondsPerImage: 40,
      generate: (prompt) => client.generate(prompt),
    },
    budgetUsd: openaiImage.IMAGE_BUDGET_USD,
  };
}

export function buildLogger(): Logger {
  // USER_HASH_SALT が未設定でもバッチは動かす（ハッシュ化する項目を出すコマンドでは identity を必須にする）
  return createLogger({ hashSalt: process.env.USER_HASH_SALT || 'unset-salt' });
}

export const OUT_DIR = join(REPO_ROOT, 'out');
