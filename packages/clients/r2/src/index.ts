// Cloudflare R2（S3 互換 API）。公開URLで Threads・Instagram・LINE に渡す（docs/04 §2）。
// 仕様確認：https://developers.cloudflare.com/r2/api/s3/api/ （2026-10-04。エンドポイント https://<ACCOUNT_ID>.r2.cloudflarestorage.com、region は auto）

import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type ObjectStorage = {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  publicUrl(key: string): string;
};

type Sender = { send(command: unknown): Promise<unknown> };

export type R2Options = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
  /** テスト用：S3Client の代わり */
  client?: Sender;
};

export function createR2Storage(opts: R2Options): ObjectStorage {
  const client: Sender =
    opts.client ??
    new S3Client({
      region: 'auto',
      endpoint: `https://${opts.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  const base = opts.publicBaseUrl.replace(/\/+$/, '');
  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: opts.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          // 同じキーは上書きしない運用（版を変える）なので長くキャッシュしてよい
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    },
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: opts.bucket, Key: key }));
        return true;
      } catch (e) {
        const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404 || (e as { name?: string }).name === 'NotFound') return false;
        throw e;
      }
    },
    publicUrl(key) {
      return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
    },
  };
}

/** ローカル開発・テスト用：メモリに置くだけ */
export function createMemoryStorage(publicBaseUrl = 'https://example.invalid'): ObjectStorage & { objects: Map<string, { body: Uint8Array; contentType: string }> } {
  const objects = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    objects,
    async put(key, body, contentType) {
      objects.set(key, { body, contentType });
    },
    async exists(key) {
      return objects.has(key);
    },
    publicUrl(key) {
      return `${publicBaseUrl}/${key}`;
    },
  };
}

/** wrangler CLI を実行する関数（args を渡し、標準出力を返す） */
export type WranglerRunner = (args: string[]) => Promise<string>;

/**
 * 手元実行用：wrangler login の認証で R2 に置く（アクセスキー不要）。
 * writeTemp は本文を一時ファイルに書いてパスを返す関数（runtime が用意）。
 */
export function createWranglerR2Storage(opts: {
  run: WranglerRunner;
  bucket: string;
  publicBaseUrl: string;
  writeTemp: (body: Uint8Array) => Promise<{ path: string; cleanup: () => void }>;
  fetch?: typeof fetch;
}): ObjectStorage {
  const base = opts.publicBaseUrl.replace(/\/+$/, '');
  const publicUrl = (key: string) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const doFetch = opts.fetch ?? fetch;
  return {
    async put(key, body, contentType) {
      const tmp = await opts.writeTemp(body);
      try {
        await opts.run([
          'r2', 'object', 'put', `${opts.bucket}/${key}`,
          '--file', tmp.path,
          '--content-type', contentType,
          '--cache-control', 'public, max-age=31536000, immutable',
          '--remote',
        ]);
      } finally {
        tmp.cleanup();
      }
    },
    async exists(key) {
      const res = await doFetch(publicUrl(key), { method: 'HEAD' });
      return res.status === 200;
    },
    publicUrl,
  };
}
