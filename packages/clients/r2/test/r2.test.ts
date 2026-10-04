import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { createMemoryStorage, createR2Storage } from '../src/index.ts';

describe('R2 ストレージ（S3 クライアントはモック）', () => {
  it('PutObject に Content-Type とキャッシュ設定を付けて送る', async () => {
    const sent: unknown[] = [];
    const s = createR2Storage({ accountId: 'acc', accessKeyId: 'k', secretAccessKey: 's', bucket: 'b', publicBaseUrl: 'https://img.example.com/', client: { send: async (c) => void sent.push(c) } });
    await s.put('images/p/birthday/03-01_v1.jpg', new Uint8Array([1, 2]), 'image/jpeg');
    const cmd = sent[0] as PutObjectCommand;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({ Bucket: 'b', Key: 'images/p/birthday/03-01_v1.jpg', ContentType: 'image/jpeg' });
    expect(cmd.input.CacheControl).toContain('immutable');
  });

  it('公開URLは公開ベースURL＋キー（末尾スラッシュを重ねない）', () => {
    const s = createR2Storage({ accountId: 'a', accessKeyId: 'k', secretAccessKey: 's', bucket: 'b', publicBaseUrl: 'https://img.example.com/', client: { send: async () => ({}) } });
    expect(s.publicUrl('images/p/kaiunbi/tenshabi_v1.jpg')).toBe('https://img.example.com/images/p/kaiunbi/tenshabi_v1.jpg');
  });

  it('exists：HeadObject が 404 なら false、成功なら true、それ以外は例外', async () => {
    const mk = (send: (c: unknown) => Promise<unknown>) => createR2Storage({ accountId: 'a', accessKeyId: 'k', secretAccessKey: 's', bucket: 'b', publicBaseUrl: 'https://x', client: { send } });
    expect(await mk(async (c) => (c instanceof HeadObjectCommand ? {} : undefined)).exists('k')).toBe(true);
    expect(await mk(async () => Promise.reject(Object.assign(new Error('nf'), { $metadata: { httpStatusCode: 404 } }))).exists('k')).toBe(false);
    await expect(mk(async () => Promise.reject(Object.assign(new Error('denied'), { $metadata: { httpStatusCode: 403 } }))).exists('k')).rejects.toThrow('denied');
  });

  it('メモリ版（開発・テスト用）', async () => {
    const m = createMemoryStorage('https://m');
    await m.put('a/b.jpg', new Uint8Array([9]), 'image/jpeg');
    expect(await m.exists('a/b.jpg')).toBe(true);
    expect(m.publicUrl('a/b.jpg')).toBe('https://m/a/b.jpg');
  });
});

describe('wrangler 経由の R2（手元実行用、wrangler はモック）', async () => {
  const { createWranglerR2Storage } = await import('../src/index.ts');

  it('一時ファイルに書いて r2 object put --remote を呼び、後片付けする', async () => {
    const calls: string[][] = [];
    let cleaned = false;
    const s = createWranglerR2Storage({
      run: async (args) => {
        calls.push(args);
        return '';
      },
      bucket: 'kaiun-wallpaper-images',
      publicBaseUrl: 'https://pub-x.r2.dev',
      writeTemp: async () => ({ path: '/tmp/obj', cleanup: () => (cleaned = true) }),
    });
    await s.put('images/p/kaiunbi/tenshabi_v1.jpg', new Uint8Array([1]), 'image/jpeg');
    expect(calls[0]?.slice(0, 6)).toEqual(['r2', 'object', 'put', 'kaiun-wallpaper-images/images/p/kaiunbi/tenshabi_v1.jpg', '--file', '/tmp/obj']);
    expect(calls[0]).toContain('--remote');
    expect(calls[0]).toContain('image/jpeg');
    expect(cleaned).toBe(true);
    expect(s.publicUrl('images/a.jpg')).toBe('https://pub-x.r2.dev/images/a.jpg');
  });

  it('アップロードが失敗しても一時ファイルは消す', async () => {
    let cleaned = false;
    const s = createWranglerR2Storage({
      run: async () => Promise.reject(new Error('upload failed')),
      bucket: 'b',
      publicBaseUrl: 'https://x',
      writeTemp: async () => ({ path: 'p', cleanup: () => (cleaned = true) }),
    });
    await expect(s.put('k', new Uint8Array(), 'image/jpeg')).rejects.toThrow('upload failed');
    expect(cleaned).toBe(true);
  });
});
