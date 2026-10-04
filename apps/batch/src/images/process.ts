// 生成画像を配布・投稿用（1080×1920 JPEG 品質90）と LINE プレビュー用（長辺480 JPEG）に整える（docs/03 §1）。
// 生成サイズは経路によってばらつくため、中央を基準に 9:16 に切り抜いてから縮小する。

import sharp from 'sharp';

export const FULL_SIZE = { width: 1080, height: 1920 } as const;
export const PREVIEW_SIZE = { width: 270, height: 480 } as const;

export type ProcessedImage = { full: Uint8Array; preview: Uint8Array };

export async function processImage(input: Uint8Array): Promise<ProcessedImage> {
  const base = sharp(input).rotate().flatten({ background: '#ffffff' });
  const full = await base
    .clone()
    .resize(FULL_SIZE.width, FULL_SIZE.height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  const preview = await sharp(full).resize(PREVIEW_SIZE.width, PREVIEW_SIZE.height).jpeg({ quality: 80 }).toBuffer();
  return { full: new Uint8Array(full), preview: new Uint8Array(preview) };
}
