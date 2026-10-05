// pnpm profit:audit [--file data/private/profit-assumptions.yaml]
// 利益モデルを同じ条件で再計算し、out/profit/report.md に書き出す（ハーネス：売上ではなく残る利益を見る）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { nowJstIso } from '@kaiun/core';
import { parse } from 'yaml';
import { z } from 'zod';
import { REPO_ROOT } from '../paths.ts';
import { AssumptionsSchema, evaluate, renderReport } from '../profit/model.ts';

const { values } = parseArgs({ options: { file: { type: 'string' } } });
const privateFile = join(REPO_ROOT, 'data', 'private', 'profit-assumptions.yaml');
const file = values.file ?? (existsSync(privateFile) ? privateFile : join(REPO_ROOT, 'data', 'profit-assumptions.example.yaml'));
const parsed = z.array(AssumptionsSchema).safeParse(parse(readFileSync(file, 'utf8')));
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n');
  process.stdout.write(`入力の形式が不正です（${relative(REPO_ROOT, file)}）：\n${issues}\n`);
  process.exitCode = 1;
} else {
  const report = renderReport(parsed.data.map(evaluate), { generatedAt: nowJstIso(), file: relative(REPO_ROOT, file).replace(/\\/g, '/') });
  const outDir = join(REPO_ROOT, 'out', 'profit');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'report.md'), report, 'utf8');
  process.stdout.write(report);
}
