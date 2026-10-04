// 承認の流れ（docs/07 M3）：out/review/index.html を出す → 人が data/approvals.csv に approved/rejected → apply-approvals。

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { SqlDb } from '@kaiun/client-d1';
import { parseCsv } from '../data/csv.ts';
import { imagesByStatus, setStatusFromGenerated } from './repo.ts';

export const APPROVALS_HEADER = ['kind', 'key', 'version', 'decision'] as const;

const esc = (x: string) => x.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** status=generated の画像一覧（承認待ち）を HTML と記入用 CSV に書き出す */
export async function writeReviewPage(db: SqlDb, reviewDir: string, localImagesDir?: string, labels: Map<string, string> = new Map()): Promise<{ count: number; htmlPath: string }> {
  const rows = await imagesByStatus(db, 'generated');
  mkdirSync(reviewDir, { recursive: true });
  const cards = rows
    .map((r) => {
      const local = localImagesDir ? join(localImagesDir, r.kind, `${r.key}_v${r.version}_preview.jpg`) : undefined;
      const src = local && existsSync(local) ? relative(reviewDir, local).replace(/\\/g, '/') : (r.r2_url_preview ?? '');
      const label = labels.get(`${r.kind}:${r.key}`) ?? '';
      return `<figure><img src="${esc(src)}" alt="${esc(`${r.kind} ${r.key}`)}" loading="lazy"><figcaption><b>${esc(r.kind)} ${esc(r.key)}</b> v${r.version}<br>${esc(label)}</figcaption></figure>`;
    })
    .join('\n');
  const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>画像レビュー</title>
<style>
body{font-family:system-ui,sans-serif;margin:16px;background:#faf9f7;color:#222}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
figure{margin:0;background:#fff;border-radius:8px;padding:6px;box-shadow:0 1px 3px #0002}
img{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:4px}
figcaption{font-size:12px;line-height:1.4;margin-top:4px}
.overlay{position:relative}
</style></head><body>
<h1>承認待ち ${rows.length} 枚</h1>
<p>問題なければ data/approvals.csv に approved、作り直すものは rejected を書いて <code>pnpm batch:apply-approvals</code>。記入用の CSV は同じフォルダの approvals_template.csv。</p>
<div class="grid">
${cards}
</div></body></html>
`;
  const htmlPath = join(reviewDir, 'index.html');
  writeFileSync(htmlPath, html, 'utf8');
  const csv = [APPROVALS_HEADER.join(','), ...rows.map((r) => `${r.kind},${r.key},${r.version},approved`)].join('\n') + '\n';
  writeFileSync(join(reviewDir, 'approvals_template.csv'), csv, 'utf8');
  return { count: rows.length, htmlPath };
}

export type ApplyResult = { applied: number; unchanged: string[]; errors: string[] };

/** data/approvals.csv を反映。generated の行だけを approved / rejected にする */
export async function applyApprovals(db: SqlDb, csvContent: string): Promise<ApplyResult> {
  const rows = parseCsv(csvContent);
  const result: ApplyResult = { applied: 0, unchanged: [], errors: [] };
  if (rows[0]?.map((h) => h.trim()).join(',') !== APPROVALS_HEADER.join(',')) {
    result.errors.push(`1行目は「${APPROVALS_HEADER.join(',')}」にしてください`);
    return result;
  }
  for (const [i, cols] of rows.slice(1).entries()) {
    const line = `${i + 2}行目`;
    const [kind, key, versionStr, decision] = cols.map((c) => c.trim());
    const version = Number(versionStr);
    if (!kind || !key || !Number.isInteger(version) || version < 1) {
      result.errors.push(`${line}：kind / key / version が不正です`);
      continue;
    }
    if (decision !== 'approved' && decision !== 'rejected') {
      result.errors.push(`${line}：decision は approved か rejected にしてください（${decision ?? '空'}）`);
      continue;
    }
    if (await setStatusFromGenerated(db, kind, key, version, decision)) result.applied++;
    else result.unchanged.push(`${kind} ${key} v${version}（承認待ちではないか、存在しません）`);
  }
  return result;
}
