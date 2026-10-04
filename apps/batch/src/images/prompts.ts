// 画像の指示文を組み立てる（prompts/image_*.md のテンプレート＋data/ の題材）。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256Hex } from '@kaiun/core';
import type { ImageKind } from '@kaiun/db';
import { parse } from 'yaml';
import { dataPaths, REPO_ROOT } from '../paths.ts';

export type ImageJob = {
  kind: ImageKind;
  key: string;
  prompt: string;
  promptHash: string;
  /** レビュー画面に出す説明 */
  label: string;
};

const PROMPTS_DIR = join(REPO_ROOT, 'prompts');

/** md の「## 見出し」直後の最初の ``` ブロックを取り出す */
export function extractBlock(md: string, heading: string): string {
  const start = md.indexOf(`## ${heading}`);
  if (start < 0) throw new Error(`heading not found: ${heading}`);
  const m = /```[^\n]*\n([\s\S]*?)```/.exec(md.slice(start));
  if (!m) throw new Error(`code block not found under: ${heading}`);
  return (m[1] as string).trim();
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  const out = template.replace(/\{([A-Za-z_]+)\}/g, (whole, name: string) => {
    const v = vars[name];
    if (v === undefined) throw new Error(`template variable missing: ${name}`);
    return v;
  });
  return out;
}

type Templates = { birthday: string; kaiunbi: string; affirmation: string; common: string; styleWords: string };

export function loadTemplates(promptsDir: string = PROMPTS_DIR): Templates {
  const read = (f: string) => readFileSync(join(promptsDir, f), 'utf8');
  const birthdayMd = read('image_birthday.md');
  return {
    birthday: extractBlock(birthdayMd, 'テンプレート'),
    styleWords: extractBlock(birthdayMd, 'STYLE_WORDS'),
    kaiunbi: extractBlock(read('image_kaiunbi.md'), 'テンプレート'),
    affirmation: extractBlock(read('image_affirmation.md'), 'テンプレート'),
    common: extractBlock(read('image_common.md'), 'テンプレート'),
  };
}

const asList = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? (x as Record<string, unknown>[]) : []);
const s = (x: unknown) => (typeof x === 'string' ? x : '');

function job(kind: ImageKind, key: string, prompt: string, label: string): ImageJob {
  return { kind, key, prompt, promptHash: sha256Hex(prompt), label };
}

export type JobFilter = { from?: string; to?: string; keys?: string[] };

/** kind ごとの生成対象。birthday は --from/--to（MM-DD）、ほかは --keys で絞れる。 */
export function buildJobs(kind: ImageKind, filter: JobFilter = {}, dataDir?: string, promptsDir?: string): ImageJob[] {
  const t = loadTemplates(promptsDir);
  const p = dataPaths(dataDir);
  const readYaml = (path: string) => parse(readFileSync(path, 'utf8')) as unknown;
  let jobs: ImageJob[];
  if (kind === 'birthday') {
    const motifEn = (readYaml(p.motifEn) ?? {}) as Record<string, string>;
    jobs = asList(readYaml(p.birthdays))
      .filter((e) => (!filter.from || s(e.date) >= filter.from) && (!filter.to || s(e.date) <= filter.to))
      .map((e) => {
        const motif = s(e.motif);
        const en = motifEn[motif];
        if (!en) throw new Error(`motif_en missing for ${motif}`);
        const prompt = fillTemplate(t.birthday, {
          color_hex: s(e.color_hex),
          color_name: s(e.color_name),
          motif_en: en,
          STYLE_WORDS: t.styleWords,
        });
        return job('birthday', s(e.date), prompt, `${s(e.date)} ${s(e.color_name)}×${motif}（${s(e.keyword)}）`);
      });
  } else if (kind === 'kaiunbi') {
    jobs = asList(readYaml(join(p.root, 'kaiunbi_images.yaml'))).map((e) =>
      job('kaiunbi', s(e.key), fillTemplate(t.kaiunbi, { motif_en: s(e.motif_en), base_color_en: s(e.base_color_en), STYLE_WORDS: t.styleWords }), s(e.key)),
    );
  } else if (kind === 'affirmation') {
    jobs = asList(readYaml(join(p.root, 'affirmation_images.yaml'))).map((e) =>
      job('affirmation', s(e.key), fillTemplate(t.affirmation, { scene_en: s(e.scene_en), color_hex: s(e.color_hex), STYLE_WORDS: t.styleWords }), `${s(e.key)} ${s(e.scene_en)}`),
    );
  } else {
    jobs = [job('common', 'v1', fillTemplate(t.common, { STYLE_WORDS: t.styleWords }), '共通版 v1')];
  }
  if (filter.keys && filter.keys.length > 0) {
    const want = new Set(filter.keys);
    jobs = jobs.filter((j) => want.has(j.key));
  }
  return jobs;
}
