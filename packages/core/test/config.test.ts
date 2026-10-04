import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, configSections, loadConfig } from '../src/config.ts';

const SECRET = 'sk-this-must-not-appear';

describe('設定読み込み（zod 検証、不足キーで失敗）', () => {
  it('不足キーがあると ConfigError。メッセージにキー名は出るが値は出ない', () => {
    const env = { OPENAI_API_KEY: SECRET };
    let err: unknown;
    try {
      loadConfig(['openaiImage', 'openaiText'], env);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConfigError);
    const ce = err as ConfigError;
    expect(ce.keys).toEqual(['OPENAI_IMAGE_MODEL', 'OPENAI_TEXT_MODEL']);
    expect(ce.message).not.toContain(SECRET);
    expect(JSON.stringify(ce)).not.toContain(SECRET);
  });

  it('空文字（.env.example をコピーしただけ）は不足とみなす', () => {
    expect(() => loadConfig(['identity'], { AB_SALT: '', USER_HASH_SALT: 'x', USER_ID_ENC_KEY: 'y' })).toThrow(/AB_SALT/);
  });

  it('不正な値も失敗（列挙・URL・数値）', () => {
    expect(() => loadConfig(['ops'], { NG_WORD_MODE: 'maybe' })).toThrow(/NG_WORD_MODE/);
    expect(() => loadConfig(['ops'], { TIMEZONE: 'UTC' })).toThrow(/TIMEZONE/);
    expect(() =>
      loadConfig(['line'], {
        LINE_CHANNEL_SECRET: 's',
        LINE_CHANNEL_ACCESS_TOKEN: 't',
        LINE_ADD_FRIEND_URL: 'not a url',
        PRIVACY_POLICY_URL: 'https://example.com/privacy',
      }),
    ).toThrow(/LINE_ADD_FRIEND_URL/);
  });

  it('初期値が入る（安全側：承認モード、上限50、NG は warn）', () => {
    const cfg = loadConfig(['threads', 'ops'], {
      THREADS_USER_ID: '1',
      THREADS_ACCESS_TOKEN: 't',
      THREADS_APP_ID: 'a',
      THREADS_APP_SECRET: 's',
    });
    expect(cfg.threads.THREADS_AUTO_REPLY_MODE).toBe('approve');
    expect(cfg.threads.THREADS_AUTO_REPLY_DAILY_CAP).toBe(50);
    expect(cfg.threads.THREADS_REPLY_WINDOW_HOURS).toBe(72);
    expect(cfg.ops).toEqual({
      TIMEZONE: 'Asia/Tokyo',
      POST_TIME_THREADS: '07:00',
      POST_TIME_INSTAGRAM: '19:00',
      TEXT_SIMILARITY_THRESHOLD: 0.8,
      NG_WORD_MODE: 'warn',
    });
  });

  it('数値は文字列から変換される', () => {
    const cfg = loadConfig(['ops'], { TEXT_SIMILARITY_THRESHOLD: '0.75' });
    expect(cfg.ops.TEXT_SIMILARITY_THRESHOLD).toBe(0.75);
  });

  it('画像生成は codex が初期値、DB は local が初期値（外部に書かない安全側）', () => {
    const cfg = loadConfig(['imageGen', 'db'], {});
    expect(cfg.imageGen.IMAGE_GENERATOR).toBe('codex');
    expect(cfg.db).toEqual({ DB_MODE: 'local', LOCAL_DB_PATH: 'out/local.db' });
  });

  it('R2 の公開パスのランダム接頭辞は8文字以上', () => {
    const base = {
      CLOUDFLARE_ACCOUNT_ID: 'a',
      R2_ACCESS_KEY_ID: 'k',
      R2_SECRET_ACCESS_KEY: 's',
      R2_BUCKET: 'b',
      R2_PUBLIC_BASE_URL: 'https://img.example.com',
    };
    expect(() => loadConfig(['r2'], { ...base, R2_RANDOM_PREFIX: 'abc' })).toThrow(/R2_RANDOM_PREFIX/);
    expect(loadConfig(['r2'], { ...base, R2_RANDOM_PREFIX: 'k3x9q2m7' }).r2.R2_RANDOM_PREFIX).toBe('k3x9q2m7');
  });

  it('要求したセクションだけ検証する', () => {
    expect(() => loadConfig(['ops'], {})).not.toThrow();
  });

  it('.env.example に全キーが書かれ、値は空か安全な初期値だけ', () => {
    const example = readFileSync(join(import.meta.dirname, '..', '..', '..', '.env.example'), 'utf8');
    const keys = new Map(
      example
        .split(/\r?\n/)
        .filter((l) => /^[A-Z0-9_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as const),
    );
    const allKeys = Object.values(configSections).flatMap((s) => Object.keys(s.shape));
    for (const k of allKeys) expect(keys.has(k), k).toBe(true);
    // 秘密情報のキーは空であること
    for (const [k, v] of keys) {
      if (/(KEY|TOKEN|SECRET|SALT)$/.test(k)) expect(v, k).toBe('');
    }
  });
});
