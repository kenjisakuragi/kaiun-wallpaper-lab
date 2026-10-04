// 文字の揺れをそろえる。NG ワード検査と類似度判定で共通に使う。

/** カタカナ（ァ〜ヶ）をひらがなにする */
export function katakanaToHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/**
 * 照合用の正規化：NFKC（全角英数→半角、半角カナ→全角）→ カタカナ→ひらがな → 小文字 → 空白除去。
 */
export function normalizeForMatch(text: string): string {
  return katakanaToHiragana(text.normalize('NFKC')).toLowerCase().replace(/\s+/g, '');
}
