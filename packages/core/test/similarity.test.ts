import { describe, expect, it } from 'vitest';
import { charBigrams, checkSimilarity, jaccard } from '../src/similarity.ts';

describe('文字 bigram Jaccard', () => {
  it('bigram を作る', () => {
    expect(charBigrams('あいう')).toEqual(new Set(['あい', 'いう']));
    expect(charBigrams('あ')).toEqual(new Set(['あ']));
  });

  it('同一文は 1、共通 bigram なしは 0', () => {
    expect(jaccard('守護カラー', '守護カラー')).toBe(1);
    expect(jaccard('あいう', 'かきく')).toBe(0);
    expect(jaccard('', '')).toBe(1);
  });

  it('部分一致の値', () => {
    // あい,いう,うえ vs あい,いう,うお → 2 / 4
    expect(jaccard('あいうえ', 'あいうお')).toBeCloseTo(0.5);
  });

  it('全角半角・カタカナの揺れは同一扱い', () => {
    expect(jaccard('ＡＩで作成', 'AIで作成')).toBe(1);
    expect(jaccard('カラー', 'からー')).toBe(1);
  });
});

describe('checkSimilarity', () => {
  const recent = [
    'その日生まれさんの守護カラーは「あけぼのピンク」。キーワードは「はじまり」です。',
    'あなたの守護カラーは「春霞のラベンダー」。「ひらめき」の一日になりますように。',
  ];

  it('完全一致は exact', () => {
    const r = checkSimilarity(recent[0] as string, recent, 0.8);
    expect(r).toMatchObject({ tooSimilar: true, exact: true, index: 0 });
  });

  it('閾値以上は tooSimilar', () => {
    const r = checkSimilarity('その日生まれさんの守護カラーは「あけぼのピンク」。キーワードは「はじまり」だよ。', recent, 0.8);
    expect(r.exact).toBe(false);
    expect(r.tooSimilar).toBe(true);
  });

  it('違う文は通る', () => {
    const r = checkSimilarity('今日のアファメーション：私は私のペースで進む。', recent, 0.8);
    expect(r.tooSimilar).toBe(false);
  });

  it('過去文がなければ通る', () => {
    expect(checkSimilarity('何か', [], 0.8)).toEqual({ tooSimilar: false, exact: false, maxScore: 0, index: -1 });
  });
});
