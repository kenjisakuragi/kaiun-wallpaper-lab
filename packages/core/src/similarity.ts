// 文面の類似度：文字 bigram の Jaccard（docs/03 §4）。

import { normalizeForMatch } from './normalize.ts';

export function charBigrams(text: string): Set<string> {
  const chars = Array.from(normalizeForMatch(text));
  if (chars.length === 1) return new Set(chars);
  const set = new Set<string>();
  for (let i = 0; i < chars.length - 1; i++) set.add(`${chars[i]}${chars[i + 1]}`);
  return set;
}

export function jaccard(a: string, b: string): number {
  const sa = charBigrams(a);
  const sb = charBigrams(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  return inter / (sa.size + sb.size - inter);
}

export type SimilarityCheck = {
  tooSimilar: boolean;
  exact: boolean;
  maxScore: number;
  /** 最も似ていた過去文面の位置（なければ -1） */
  index: number;
};

/** 過去の文面と比べ、完全一致または閾値以上なら tooSimilar */
export function checkSimilarity(text: string, recent: readonly string[], threshold: number): SimilarityCheck {
  const target = normalizeForMatch(text);
  let maxScore = 0;
  let index = -1;
  for (let i = 0; i < recent.length; i++) {
    const prev = recent[i] as string;
    if (normalizeForMatch(prev) === target) {
      return { tooSimilar: true, exact: true, maxScore: 1, index: i };
    }
    const score = jaccard(text, prev);
    if (score > maxScore) {
      maxScore = score;
      index = i;
    }
  }
  return { tooSimilar: maxScore >= threshold, exact: false, maxScore, index };
}
