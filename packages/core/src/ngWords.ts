// NG ワード検査（docs/08 §2）。
// 2026-10-04 決定（docs/09 #16）：送信を止めるかは NG_WORD_MODE で決める。初期値 warn は記録のみ。

import { katakanaToHiragana, normalizeForMatch } from './normalize.ts';

export const NG_WORD_MODES = ['off', 'warn', 'block'] as const;
export type NgWordMode = (typeof NG_WORD_MODES)[number];

export type NgEntry =
  | { kind: 'word'; source: string; normalized: string }
  | { kind: 'regex'; source: string; regex: RegExp };

export type NgHit = { source: string; matched: string };

export type NgDecision = {
  action: 'pass' | 'reject';
  hits: NgHit[];
};

/** ng_words.txt の中身を読む。1行1語、`re:` 接頭辞は正規表現、空行と `#` 始まりは無視。 */
export function parseNgList(content: string): NgEntry[] {
  const entries: NgEntry[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (line.startsWith('re:')) {
      const pattern = line.slice(3);
      // 正規表現も本文と同じく NFKC とかな統一をかける。`\D` などを壊さないよう小文字化はせず i フラグで対応する。
      const normalizedPattern = katakanaToHiragana(pattern.normalize('NFKC'));
      entries.push({ kind: 'regex', source: line, regex: new RegExp(normalizedPattern, 'iu') });
    } else {
      entries.push({ kind: 'word', source: line, normalized: normalizeForMatch(line) });
    }
  }
  return entries;
}

/** 該当した NG ワードを全部返す */
export function findNgWords(text: string, entries: readonly NgEntry[]): NgHit[] {
  const normalized = normalizeForMatch(text);
  const hits: NgHit[] = [];
  for (const e of entries) {
    if (e.kind === 'word') {
      if (e.normalized !== '' && normalized.includes(e.normalized)) {
        hits.push({ source: e.source, matched: e.normalized });
      }
    } else {
      const m = e.regex.exec(normalized);
      if (m) hits.push({ source: e.source, matched: m[0] });
    }
  }
  return hits;
}

/** モードに従って送ってよいかを決める。warn は該当語を返すが pass。 */
export function checkNgWords(text: string, entries: readonly NgEntry[], mode: NgWordMode): NgDecision {
  if (mode === 'off') return { action: 'pass', hits: [] };
  const hits = findNgWords(text, entries);
  if (mode === 'block' && hits.length > 0) return { action: 'reject', hits };
  return { action: 'pass', hits };
}
