// images テーブルの読み書き（docs/05）。

import type { SqlDb } from '@kaiun/client-d1';
import type { ImageKind, ImageStatus } from '@kaiun/db';

export type ImageRow = {
  id: string;
  kind: ImageKind;
  key: string;
  version: number;
  prompt_hash: string;
  model: string;
  quality: string;
  r2_url_full: string | null;
  r2_url_preview: string | null;
  cost_usd: number;
  status: ImageStatus;
  created_at: string;
};

export async function latestImage(db: SqlDb, kind: ImageKind, key: string): Promise<ImageRow | undefined> {
  const rows = await db.all<ImageRow>('SELECT * FROM images WHERE kind = ? AND key = ? ORDER BY version DESC LIMIT 1', [kind, key]);
  return rows[0];
}

/** kind の全行を1回で読み、key ごとの最新版を返す（1件ずつ問い合わせると wrangler 経由で遅いため） */
export async function latestImagesByKind(db: SqlDb, kind: ImageKind): Promise<Map<string, ImageRow>> {
  const rows = await db.all<ImageRow>('SELECT * FROM images WHERE kind = ? ORDER BY key, version', [kind]);
  const map = new Map<string, ImageRow>();
  for (const r of rows) map.set(r.key, r);
  return map;
}

export async function insertImage(db: SqlDb, row: ImageRow): Promise<void> {
  await db.run(
    `INSERT INTO images (id, kind, key, version, prompt_hash, model, quality, r2_url_full, r2_url_preview, cost_usd, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.kind, row.key, row.version, row.prompt_hash, row.model, row.quality, row.r2_url_full, row.r2_url_preview, row.cost_usd, row.status, row.created_at],
  );
}

export async function totalCostUsd(db: SqlDb): Promise<number> {
  const rows = await db.all<{ total: number | null }>('SELECT SUM(cost_usd) AS total FROM images');
  return Number(rows[0]?.total ?? 0);
}

export async function imagesByStatus(db: SqlDb, status: ImageStatus): Promise<ImageRow[]> {
  return db.all<ImageRow>('SELECT * FROM images WHERE status = ? ORDER BY kind, key, version', [status]);
}

/** 承認の反映。generated の行だけを変える（approved / rejected から戻さない） */
export async function setStatusFromGenerated(db: SqlDb, kind: string, key: string, version: number, status: 'approved' | 'rejected'): Promise<boolean> {
  const r = await db.run("UPDATE images SET status = ? WHERE kind = ? AND key = ? AND version = ? AND status = 'generated'", [status, kind, key, version]);
  return r.changes > 0;
}

/** 投稿・返信に使う画像：approved の最新 version（docs/05） */
export async function approvedImage(db: SqlDb, kind: ImageKind, key: string): Promise<ImageRow | undefined> {
  const rows = await db.all<ImageRow>("SELECT * FROM images WHERE kind = ? AND key = ? AND status = 'approved' ORDER BY version DESC LIMIT 1", [kind, key]);
  return rows[0];
}
