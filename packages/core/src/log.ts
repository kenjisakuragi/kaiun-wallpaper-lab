// ログは JSON 1行。LINE userId と Threads のユーザー名はハッシュ化して出す（CLAUDE.md コード規約）。
// 秘密情報らしいキーは値を出さない（CLAUDE.md ルール1）。

import { nowJstIso } from './date.ts';
import { hashIdentifier } from './hash.ts';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

/** 値をハッシュに置き換えるキー */
export const HASHED_KEYS = ['lineUserId', 'threadsUsername'] as const;
const SECRET_KEY_RE = /(token|secret|password|api_?key|authorization|enc_?key|salt)/i;

export type Logger = {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
};

export type LoggerOptions = {
  /** HASHED_KEYS のハッシュに使うソルト（USER_HASH_SALT） */
  hashSalt: string;
  sink?: (line: string) => void;
  now?: () => Date;
};

function redact(fields: LogFields, hashSalt: string): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if ((HASHED_KEYS as readonly string[]).includes(key)) {
      out[`${key}Hash`] = typeof value === 'string' ? hashIdentifier(value, hashSalt) : null;
    } else if (SECRET_KEY_RE.test(key)) {
      out[key] = '[REDACTED]';
    } else if (value instanceof Error) {
      out[key] = { name: value.name, message: value.message };
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function createLogger(options: LoggerOptions): Logger {
  // eslint-disable-next-line no-console -- ログの出力先そのもの
  const sink = options.sink ?? ((line: string) => console.log(line));
  const now = options.now ?? (() => new Date());
  const write = (level: LogLevel, event: string, fields: LogFields = {}) => {
    sink(JSON.stringify({ ts: nowJstIso(now()), level, event, ...redact(fields, options.hashSalt) }));
  };
  return {
    debug: (e, f) => write('debug', e, f),
    info: (e, f) => write('info', e, f),
    warn: (e, f) => write('warn', e, f),
    error: (e, f) => write('error', e, f),
  };
}
