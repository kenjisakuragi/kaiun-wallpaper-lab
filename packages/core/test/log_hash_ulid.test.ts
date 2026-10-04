import { describe, expect, it } from 'vitest';
import { hashIdentifier, sha256Hex } from '../src/hash.ts';
import { createLogger } from '../src/log.ts';
import { newId } from '../src/ulid.ts';

describe('sha256', () => {
  it('既知のハッシュ値と一致', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('ソルトで値が変わり、空ソルトは例外', () => {
    expect(hashIdentifier('U1', 's1')).not.toBe(hashIdentifier('U1', 's2'));
    expect(() => hashIdentifier('U1', '')).toThrow();
  });
});

describe('ログ（JSON 1行、ID はハッシュ、秘密は伏せる）', () => {
  const lines: string[] = [];
  const log = createLogger({ hashSalt: 'salt', sink: (l) => lines.push(l), now: () => new Date('2026-10-09T22:00:00Z') });

  it('LINE userId と Threads ユーザー名はハッシュで出す', () => {
    log.info('line.follow', { lineUserId: 'U1234567890', threadsUsername: 'someone', count: 3 });
    const line = lines.at(-1) as string;
    expect(line).not.toContain('\n');
    expect(line).not.toContain('U1234567890');
    expect(line).not.toContain('someone');
    const obj = JSON.parse(line);
    expect(obj).toMatchObject({
      ts: '2026-10-10T07:00:00+09:00',
      level: 'info',
      event: 'line.follow',
      lineUserIdHash: hashIdentifier('U1234567890', 'salt'),
      threadsUsernameHash: hashIdentifier('someone', 'salt'),
      count: 3,
    });
  });

  it('トークンなど秘密らしいキーは値を出さない', () => {
    log.warn('x', { accessToken: 'tok-secret', apiKey: 'k-secret', channelSecret: 'c-secret' });
    const line = lines.at(-1) as string;
    for (const s of ['tok-secret', 'k-secret', 'c-secret']) expect(line).not.toContain(s);
  });

  it('Error はメッセージだけ出す', () => {
    log.error('fail', { err: new Error('boom') });
    expect(JSON.parse(lines.at(-1) as string).err).toEqual({ name: 'Error', message: 'boom' });
  });
});

describe('ULID', () => {
  it('26文字・単調増加・重複なし', () => {
    const ids = Array.from({ length: 1000 }, () => newId(1_760_000_000_000));
    expect(ids.every((id) => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });
});
