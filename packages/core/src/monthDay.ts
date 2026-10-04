// 月日パーサ。LINE と Threads のリプで共通に使う（docs/02 §5・§6）。
// 生年は受け取らない（CLAUDE.md ルール2）。年を含む入力・候補が複数ある入力は失敗にする
// （docs/09 #12 の仮の安全側。決定したらここを見直す）。

export type MonthDay = { month: number; day: number; md: string };

export type MonthDayResult =
  | ({ ok: true } & MonthDay)
  | { ok: false; reason: 'no_candidate' | 'ambiguous' | 'has_year' | 'invalid_date' };

// 2/29 を含む各月の日数
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function isValidMonthDay(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= (DAYS_IN_MONTH[month - 1] ?? 0);
}

export function formatMonthDay(month: number, day: number): string {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

type Candidate = { start: number; month: number; day: number };

const PATTERNS: RegExp[] = [
  /(?<!\d)(\d{2})(\d{2})(?!\d)/g, // 0315
  /(?<![\d/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/g, // 3/15
  /(?<!\d)(\d{1,2})\s*月\s*(\d{1,2})(?!\d)\s*日?/g, // 3月15日
];

// 生年が含まれていそうな形：5けた以上の数字、「◯年」、2つ以上のスラッシュ区切り
const YEAR_HINTS: RegExp[] = [/\d{5,}/, /\d+\s*年/, /\d+\s*\/\s*\d+\s*\/\s*\d+/];

export function parseMonthDay(input: string): MonthDayResult {
  const text = input.normalize('NFKC');

  if (YEAR_HINTS.some((re) => re.test(text))) return { ok: false, reason: 'has_year' };

  const candidates: Candidate[] = [];
  for (const re of PATTERNS) {
    for (const m of text.matchAll(re)) {
      candidates.push({ start: m.index, month: Number(m[1]), day: Number(m[2]) });
    }
  }

  if (candidates.length === 0) return { ok: false, reason: 'no_candidate' };
  if (candidates.length > 1) return { ok: false, reason: 'ambiguous' };

  const [c] = candidates as [Candidate];
  if (!isValidMonthDay(c.month, c.day)) return { ok: false, reason: 'invalid_date' };
  return { ok: true, month: c.month, day: c.day, md: formatMonthDay(c.month, c.day) };
}
