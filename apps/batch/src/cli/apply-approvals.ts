// pnpm batch:apply-approvals
// data/approvals.csv（kind,key,version,decision）を images に反映する（docs/07 M3）。

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyApprovals, writeReviewPage } from '../images/review.ts';
import { DATA_DIR } from '../paths.ts';
import { buildDb, loadDotEnv, OUT_DIR } from '../runtime.ts';

const out = (s: string) => process.stdout.write(`${s}\n`);

async function main(): Promise<number> {
  loadDotEnv();
  const path = join(DATA_DIR, 'approvals.csv');
  if (!existsSync(path)) {
    out('data/approvals.csv がありません（out/review/approvals_template.csv をコピーして記入してください）');
    return 1;
  }
  const db = buildDb();
  const r = await applyApprovals(db, readFileSync(path, 'utf8'));
  out(`反映 ${r.applied} 件、変更なし ${r.unchanged.length} 件、エラー ${r.errors.length} 件`);
  for (const u of r.unchanged) out(`  変更なし：${u}`);
  for (const e of r.errors) out(`  エラー：${e}`);
  const review = await writeReviewPage(db, join(OUT_DIR, 'review'), join(OUT_DIR, 'images'));
  out(`残りの承認待ち ${review.count} 枚`);
  return r.errors.length > 0 ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    out(`エラー：${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  },
);
