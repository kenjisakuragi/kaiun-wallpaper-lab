import { describe, expect, it, vi } from 'vitest';
import { createOpenAIImageClient, ESTIMATED_COST_USD, OpenAIImageError } from '../src/images.ts';

const PNG_B64 = Buffer.from('fake-png').toString('base64');
const ok = () => new Response(JSON.stringify({ data: [{ b64_json: PNG_B64 }] }), { status: 200 });
const err = (status: number) => new Response('{"error":"x"}', { status });

describe('OpenAI Images クライアント（モック）', () => {
  it('縦長・PNG・1枚で依頼し、画像と推定コストを返す', async () => {
    const fetch = vi.fn(async () => ok());
    const c = createOpenAIImageClient({ apiKey: 'sk-test', model: 'gpt-image-2', quality: 'medium', fetch: fetch as unknown as typeof globalThis.fetch });
    const r = await c.generate('a prompt');
    expect(Buffer.from(r.png).toString()).toBe('fake-png');
    expect(r).toMatchObject({ model: 'gpt-image-2', quality: 'medium', costUsd: ESTIMATED_COST_USD.medium });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    expect(JSON.parse(init.body as string)).toEqual({ model: 'gpt-image-2', prompt: 'a prompt', n: 1, size: '1024x1536', quality: 'medium', output_format: 'png' });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
  });

  it('429・5xx は指数バックオフで最大2回まで再試行', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(err(429)).mockResolvedValueOnce(err(503)).mockResolvedValueOnce(ok());
    const sleep = vi.fn(async () => {});
    const c = createOpenAIImageClient({ apiKey: 'k', model: 'm', quality: 'low', fetch, sleep, backoffMs: 100 });
    await c.generate('p');
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((x) => (x as unknown as [number])[0])).toEqual([100, 200]);
  });

  it('3回目も失敗なら例外。4xx は再試行しない', async () => {
    const f1 = vi.fn(async () => err(500));
    const c1 = createOpenAIImageClient({ apiKey: 'k', model: 'm', quality: 'low', fetch: f1, sleep: async () => {} });
    await expect(c1.generate('p')).rejects.toBeInstanceOf(OpenAIImageError);
    expect(f1).toHaveBeenCalledTimes(3);

    const f2 = vi.fn(async () => err(400));
    const c2 = createOpenAIImageClient({ apiKey: 'k', model: 'm', quality: 'low', fetch: f2, sleep: async () => {} });
    await expect(c2.generate('p')).rejects.toThrow(/400/);
    expect(f2).toHaveBeenCalledTimes(1);
  });

  it('レスポンスの形が違えば例外（zod で検証）', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const c = createOpenAIImageClient({ apiKey: 'k', model: 'm', quality: 'low', fetch });
    await expect(c.generate('p')).rejects.toThrow(/unexpected response/);
  });

  it('エラーメッセージに API キーを含めない', async () => {
    const fetch = vi.fn(async () => err(401));
    const c = createOpenAIImageClient({ apiKey: 'sk-secret-123', model: 'm', quality: 'low', fetch });
    await expect(c.generate('p')).rejects.not.toThrow(/sk-secret-123/);
  });
});
