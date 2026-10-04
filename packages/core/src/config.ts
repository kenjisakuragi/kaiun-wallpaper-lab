// 設定の読み込み。用途ごとのセクションを zod で検証し、足りないキーがあれば例外で起動を止める。
// エラーにはキー名だけを出し、値は出さない（CLAUDE.md ルール1）。

import { z } from 'zod';
import { NG_WORD_MODES } from './ngWords.ts';

const required = z.string().trim().min(1, 'required');
const url = z.url();
const int = (def: number) => z.coerce.number().int().min(0).default(def);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

export const configSections = {
  /** 画像の生成方法（docs/04 §1-1）。codex はローカルPC専用。 */
  imageGen: z.object({
    IMAGE_GENERATOR: z.enum(['codex', 'openai']).default('codex'),
    CODEX_BIN: z.string().trim().optional(),
  }),
  openaiImage: z.object({
    OPENAI_API_KEY: required,
    OPENAI_IMAGE_MODEL: required,
    OPENAI_IMAGE_QUALITY: z.enum(['low', 'medium', 'high']).default('medium'),
    IMAGE_BUDGET_USD: z.coerce.number().positive().default(80),
    IMAGE_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3),
  }),
  openaiText: z.object({
    OPENAI_API_KEY: required,
    OPENAI_TEXT_MODEL: required,
  }),
  r2: z.object({
    CLOUDFLARE_ACCOUNT_ID: required,
    R2_ACCESS_KEY_ID: required,
    R2_SECRET_ACCESS_KEY: required,
    R2_BUCKET: required,
    R2_PUBLIC_BASE_URL: url,
    R2_RANDOM_PREFIX: z.string().regex(/^[A-Za-z0-9_-]{8,}$/, 'random prefix (8+ chars of A-Za-z0-9_-)'),
  }),
  /** バッチが使う DB。local は node:sqlite（開発・テスト）、d1 は Cloudflare REST API（本番） */
  db: z.object({
    DB_MODE: z.enum(['local', 'd1']).default('local'),
    LOCAL_DB_PATH: z.string().default('out/local.db'),
  }),
  d1: z.object({
    CLOUDFLARE_ACCOUNT_ID: required,
    CLOUDFLARE_API_TOKEN: required,
    D1_DATABASE_ID: required,
  }),
  edge: z.object({
    EDGE_HOST: required,
  }),
  threads: z.object({
    THREADS_USER_ID: required,
    THREADS_ACCESS_TOKEN: required,
    THREADS_APP_ID: required,
    THREADS_APP_SECRET: required,
    THREADS_AUTO_REPLY_MODE: z.enum(['approve', 'auto']).default('approve'),
    THREADS_AUTO_REPLY_DAILY_CAP: int(50),
    THREADS_REPLY_WINDOW_HOURS: int(72),
  }),
  instagram: z.object({
    IG_USER_ID: required,
    IG_ACCESS_TOKEN: required,
    META_APP_ID: required,
    META_APP_SECRET: required,
  }),
  line: z.object({
    LINE_CHANNEL_SECRET: required,
    LINE_CHANNEL_ACCESS_TOKEN: required,
    LINE_ADD_FRIEND_URL: url,
    LINE_MONTHLY_PUSH_LIMIT: int(200),
    PRIVACY_POLICY_URL: url,
  }),
  identity: z.object({
    AB_SALT: required,
    USER_HASH_SALT: required,
    USER_ID_ENC_KEY: required,
  }),
  ops: z.object({
    TIMEZONE: z.literal('Asia/Tokyo').default('Asia/Tokyo'),
    POST_TIME_THREADS: hhmm.default('07:00'),
    POST_TIME_INSTAGRAM: hhmm.default('19:00'),
    TEXT_SIMILARITY_THRESHOLD: z.coerce.number().gt(0).lte(1).default(0.8),
    NG_WORD_MODE: z.enum(NG_WORD_MODES).default('warn'),
  }),
} as const;

export type ConfigSectionName = keyof typeof configSections;
export type ConfigSection<K extends ConfigSectionName> = z.infer<(typeof configSections)[K]>;
export type Config<K extends ConfigSectionName> = { [P in K]: ConfigSection<P> };

export class ConfigError extends Error {
  readonly keys: string[];
  constructor(keys: string[]) {
    super(`invalid or missing config keys: ${keys.join(', ')}`);
    this.name = 'ConfigError';
    this.keys = keys;
  }
}

type Env = Record<string, string | undefined>;

/** 空文字は未設定として扱う（.env.example をコピーしただけの状態を不足とみなす） */
function pickEnv(env: Env): Env {
  const out: Env = {};
  for (const [k, v] of Object.entries(env)) out[k] = v === '' ? undefined : v;
  return out;
}

/**
 * 必要なセクションだけ検証して返す。例：`loadConfig(['threads', 'ops'])`
 * edge（Workers）では `env` に Workers の env を渡す。
 */
export function loadConfig<K extends ConfigSectionName>(sections: readonly K[], env: Env = process.env): Config<K> {
  const source = pickEnv(env);
  const result: Partial<Record<ConfigSectionName, unknown>> = {};
  const badKeys = new Set<string>();
  for (const name of sections) {
    const parsed = configSections[name].safeParse(source);
    if (parsed.success) {
      result[name] = parsed.data;
    } else {
      for (const issue of parsed.error.issues) badKeys.add(String(issue.path[0] ?? name));
    }
  }
  if (badKeys.size > 0) throw new ConfigError([...badKeys].sort());
  return result as Config<K>;
}
