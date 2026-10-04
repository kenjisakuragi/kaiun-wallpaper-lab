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
