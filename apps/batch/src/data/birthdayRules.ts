// 誕生日別の題材（守護カラー・モチーフ・キーワード）を決める規則（docs/03 §1-1）。
// このプロジェクト独自の設定で、伝統・学説・宗教的権威を名乗らない（docs/08 §1）。
// 規則を変えたら birthdays.yaml を作り直し、人のレビュー（data/birthdays.reviewed）をやり直す。

export type BirthdayEntry = {
  date: string; // MM-DD
  color_name: string;
  color_hex: string;
  motif: string;
  keyword: string;
};

type ColorWord = { name: string; h: number; s: number; l: number };

/** 月ごとの基調色（3色ずつ、月をまたいで重複しない）。HSL は基準値で、日ごとに少し揺らす。 */
export const MONTH_COLORS: readonly (readonly [ColorWord, ColorWord, ColorWord])[] = [
  [
    { name: 'アイスブルー', h: 200, s: 60, l: 80 },
    { name: 'シルバーグレー', h: 210, s: 10, l: 76 },
    { name: 'スノーホワイト', h: 200, s: 30, l: 93 },
  ],
  [
    { name: 'ミルキーピンク', h: 345, s: 70, l: 87 },
    { name: 'プラムレッド', h: 340, s: 45, l: 58 },
    { name: 'ショコラブラウン', h: 20, s: 35, l: 45 },
  ],
  [
    { name: 'さくらピンク', h: 350, s: 65, l: 85 },
    { name: 'ラベンダー', h: 265, s: 45, l: 80 },
    { name: 'ピーチ', h: 20, s: 80, l: 82 },
  ],
  [
    { name: 'ミントグリーン', h: 150, s: 45, l: 80 },
    { name: 'レモンイエロー', h: 55, s: 85, l: 78 },
    { name: 'ライラック', h: 285, s: 35, l: 78 },
  ],
  [
    { name: 'ライトグリーン', h: 110, s: 40, l: 72 },
    { name: 'スカイブルー', h: 200, s: 70, l: 78 },
    { name: 'ローズピンク', h: 340, s: 55, l: 75 },
  ],
  [
    { name: 'アジサイブルー', h: 230, s: 45, l: 72 },
    { name: 'アジサイパープル', h: 275, s: 35, l: 70 },
    { name: 'レインシルバー', h: 205, s: 12, l: 72 },
  ],
  [
    { name: 'マリンブルー', h: 205, s: 65, l: 55 },
    { name: 'サンフラワーイエロー', h: 48, s: 90, l: 62 },
    { name: 'アクアグリーン', h: 170, s: 50, l: 65 },
  ],
  [
    { name: 'サンセットオレンジ', h: 25, s: 85, l: 65 },
    { name: 'トロピカルブルー', h: 190, s: 70, l: 55 },
    { name: 'コーラルピンク', h: 5, s: 75, l: 72 },
  ],
  [
    { name: 'ムーンイエロー', h: 50, s: 70, l: 80 },
    { name: 'ナイトブルー', h: 225, s: 45, l: 40 },
    { name: 'ススキゴールド', h: 42, s: 45, l: 65 },
  ],
  [
    { name: 'パンプキンオレンジ', h: 28, s: 75, l: 58 },
    { name: 'ワインレッド', h: 345, s: 50, l: 40 },
    { name: 'マロンブラウン', h: 22, s: 40, l: 42 },
  ],
  [
    { name: 'もみじレッド', h: 8, s: 65, l: 52 },
    { name: 'カーキ', h: 75, s: 25, l: 50 },
    { name: 'アンバー', h: 38, s: 70, l: 55 },
  ],
  [
    { name: 'ミッドナイトブルー', h: 230, s: 50, l: 32 },
    { name: 'シャンパンゴールド', h: 45, s: 45, l: 75 },
    { name: 'フォレストグリーン', h: 140, s: 35, l: 36 },
  ],
];

/** 日（1〜31）ごとの色名の前置き。同じ月の中で色名が重複しない。 */
export const DAY_PREFIXES = [
  '朝凪の', '木漏れ日の', '星降る', '月明かりの', '風薫る', '雨上がりの', '陽だまりの', '夜明けの',
  '夕映えの', '花咲く', '透きとおる', 'ささやく', 'ひかる', 'やすらぎの', 'ときめく', 'しずくの',
  'そよ風の', '光あふれる', 'まどろむ', 'きらめく', 'はじまりの', 'ほほえむ', '澄みわたる', 'ゆらめく',
  '灯りの', '渚の', '森の', '雲間の', '波音の', '羽ばたく', '宵の',
] as const;

/** モチーフ（実在の人物・建物・寺社・宗教のシンボル・キャラクターは使わない。docs/03 §1） */
export const MOTIFS = [
  '桜の花びら', '三日月', '満月', '星くず', '白い羽根', '四つ葉のクローバー', '水晶', 'しずく',
  '貝殻', 'アンティークの鍵', 'リボン', '小さな花束', '蝶', '小鳥', '雪の結晶', '虹',
  '紙飛行機', 'ガラスの小瓶', '真珠', 'たんぽぽの綿毛', 'ランタンの灯り', '流れ星', '花冠', '葉っぱ',
  'しゃぼん玉', '金色の砂時計', '朝顔', 'ひまわり', 'すずらん', '帆船', '気球', 'オーロラ',
] as const;

/** キーワード（2〜6文字の前向きな語。効果を断定する語は使わない。docs/08 §1） */
export const KEYWORDS = [
  'はじまり', 'ひらめき', 'やすらぎ', 'ときめき', 'しなやか', 'まっすぐ', 'ゆとり', 'よろこび',
  'つながり', 'ひかり', 'めぐり', 'かろやか', 'ほほえみ', 'たのしむ', 'ととのう', 'ひらく',
  'のびやか', 'きずな', 'あこがれ', 'みのり', 'ゆめ', 'こころ', 'かがやき', 'ぬくもり',
  '信頼', '勇気', '感謝', '好奇心', '自由', '調和', '前進', '素直',
] as const;

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/** 1/1 を 0 とする通し番号（2/29 を含む366日） */
export function dayIndex(month: number, day: number): number {
  let idx = 0;
  for (let m = 1; m < month; m++) idx += DAYS_IN_MONTH[m - 1] as number;
  return idx + day - 1;
}

export function birthdayEntry(month: number, day: number): BirthdayEntry {
  const colors = MONTH_COLORS[month - 1];
  if (!colors) throw new Error(`invalid month: ${month}`);
  const word = colors[(day - 1) % 3] as ColorWord;
  const prefix = DAY_PREFIXES[day - 1];
  if (!prefix) throw new Error(`invalid day: ${day}`);
  // 色相は ±6、彩度は ±8、明度は ±6 の範囲で日ごとに揺らす
  const h = (word.h + (((day * 5) % 13) - 6) + 360) % 360;
  const s = clamp(word.s + (((day * 7) % 17) - 8), 5, 95);
  const l = clamp(word.l + (((day * 3) % 13) - 6), 25, 95);
  const idx = dayIndex(month, day);
  return {
    date: `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    color_name: `${prefix}${word.name}`,
    color_hex: hslToHex(h, s, l),
    // 7・11 は各リストの長さ（32）と互いに素なので、隣り合う日で同じものが続かない
    motif: MOTIFS[(idx * 7) % MOTIFS.length] as string,
    keyword: KEYWORDS[(idx * 11 + 3) % KEYWORDS.length] as string,
  };
}

export function generateBirthdays(): BirthdayEntry[] {
  const out: BirthdayEntry[] = [];
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= (DAYS_IN_MONTH[m - 1] as number); d++) out.push(birthdayEntry(m, d));
  }
  return out;
}

/** birthdays.yaml の先頭コメント（設定ルール。docs/03 §1-1） */
export const BIRTHDAYS_HEADER = `# 誕生日別の題材（366日、2/29 を含む）
# 生成：pnpm batch:generate-birthdays（apps/batch/src/data/birthdayRules.ts の規則から作る）
#
# 設定ルール：
# - 守護カラーとモチーフは、このプロジェクト独自の設定。伝統・学説・宗教的権威を名乗らない。
# - 色：月ごとに基調色を3つ決め（月をまたいで重複しない）、日ごとに「前置き（31種）＋基調色」で色名を作る。
#   そのため366日の色名はすべて異なる。color_hex は基調色の HSL を日ごとに少し揺らした値。
# - モチーフ：32種を、1/1 からの通し番号 × 7 で順に割り当てる（隣り合う日で同じものが続かない）。
#   実在の人物・建物・寺社・宗教のシンボル・キャラクターは使わない。
# - keyword：2〜6文字の前向きな語32種を、通し番号 × 11 で割り当てる。効果を断定する語は使わない。
# - 人がレビューし、問題なければ data/birthdays.reviewed を置く（置くまで本番の画像生成は動かない）。
#   手で直した場合も pnpm batch:validate-data を通すこと。
`;
