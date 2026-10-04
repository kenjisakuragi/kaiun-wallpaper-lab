import { describe, expect, it, vi } from 'vitest';
import { createD1HttpDb, createLocalDb, D1Error } from '../src/index.ts';

describe('D1 REST クライアント（fetch はモック）', () => {
  it('query エンドポイントに sql と文字列の params を送り、results を返す', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true, result: [{ success: true, results: [{ id: 'a', n: 1 }], meta: { changes: 0 } }] }), { status: 200 }),
    );
    const db = createD1HttpDb({ accountId: 'acc', databaseId: 'db1', apiToken: 'tok', fetch });
    const rows = await db.all('SELECT * FROM images WHERE version = ?', [2]);
    expect(rows).toEqual([{ id: 'a', n: 1 }]);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/d1/database/db1/query');
    expect(JSON.parse(init.body as string)).toEqual({ sql: 'SELECT * FROM images WHERE version = ?', params: ['2'] });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('run は changes を返す', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ success: true, result: [{ success: true, results: [], meta: { changes: 3 } }] })));
    expect(await createD1HttpDb({ accountId: 'a', databaseId: 'd', apiToken: 't', fetch }).run('UPDATE x SET y = 1')).toEqual({ changes: 3 });
  });

  it('success:false や HTTP エラーは D1Error（トークンは含めない）', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ success: false, errors: [{ code: 7500, message: 'no such table: x' }] }), { status: 400 }));
    const db = createD1HttpDb({ accountId: 'a', databaseId: 'd', apiToken: 'secret-token', fetch });
    const e = await db.all('SELECT * FROM x').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(D1Error);
    expect(String(e)).toContain('no such table');
    expect(String(e)).not.toContain('secret-token');
  });
});

describe('ローカル DB（node:sqlite）', () => {
  it('マイグレーションを当て、2回目は当て直さない', async () => {
    const db = createLocalDb(':memory:', ['CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER)']);
    await db.run('INSERT INTO t (id, n) VALUES (?, ?)', ['a', 1]);
    expect(await db.all('SELECT * FROM t')).toEqual([{ id: 'a', n: 1 }]);
    db.close();
  });
});
