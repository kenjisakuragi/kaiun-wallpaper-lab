// OpenAI Images API（予備経路。docs/04 §1）。
// 仕様確認：https://developers.openai.com/api/docs/guides/image-generation （2026-10-04）

import { z } from 'zod';

export type ImageQuality = 'low' | 'medium' | 'high';

/**
 * 1枚あたりの推定コスト（USD、1024×1536）。公式の料金表に1枚単価がないため、
 * 出力トークン単価（gpt-image-2：$30 / 100万トークン）と、縦長サイズの出力トークン数の目安から出した推計値。
 * M3 で実測して見直す（docs/04 §1）。
 */
export const ESTIMATED_COST_USD: Record<ImageQuality, number> = {
  low: 0.012,
  medium: 0.048,
  high: 0.187,
};

const ResponseSchema = z.object({
  data: z.array(z.object({ b64_json: z.string().min(1) })).min(1),
});

export class OpenAIImageError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OpenAIImageError';
    this.status = status;
  }
}

export type OpenAIImageClientOptions = {
  apiKey: string;
  model: string;
  quality: ImageQuality;
  fetch?: typeof fetch;
  /** 429/5xx の再試行回数（CLAUDE.md ルール8：最大2回） */
  maxRetries?: number;
  /** 再試行の待ち時間の基準（ミリ秒）。指数で伸ばす。 */
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

export type GeneratedImage = { png: Uint8Array; model: string; quality: string; costUsd: number };

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createOpenAIImageClient(opts: OpenAIImageClientOptions) {
  const doFetch = opts.fetch ?? fetch;
  const maxRetries = opts.maxRetries ?? 2;
  const backoffMs = opts.backoffMs ?? 2000;
  const sleep = opts.sleep ?? defaultSleep;

  async function generate(prompt: string): Promise<GeneratedImage> {
    for (let attempt = 0; ; attempt++) {
      const res = await doFetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: opts.model,
          prompt,
          n: 1,
          size: '1024x1536',
          quality: opts.quality,
          output_format: 'png',
        }),
      });
      if (res.ok) {
        const parsed = ResponseSchema.safeParse(await res.json());
        if (!parsed.success) throw new OpenAIImageError('unexpected response shape from images API');
        const b64 = (parsed.data.data[0] as { b64_json: string }).b64_json;
        return {
          png: Uint8Array.from(Buffer.from(b64, 'base64')),
          model: opts.model,
          quality: opts.quality,
          costUsd: ESTIMATED_COST_USD[opts.quality],
        };
      }
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxRetries) {
        // 本文にはプロンプトや鍵は含まれないが、長さだけ抑えて残す
        const body = (await res.text()).slice(0, 300);
        throw new OpenAIImageError(`images API failed: ${res.status} ${body}`, res.status);
      }
      await sleep(backoffMs * 2 ** attempt);
    }
  }

  return { generate, costUsdPerImage: ESTIMATED_COST_USD[opts.quality] };
}
