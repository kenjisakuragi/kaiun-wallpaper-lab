// 日付は Asia/Tokyo で扱う（CLAUDE.md コード規約）。
// 日本は夏時間がないため、UTC+09:00 の固定オフセットで計算する。

export const TIMEZONE = 'Asia/Tokyo';
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEK_RE = /^(\d{4})-W(\d{2})$/;

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/** Date を JST の壁時計として読むための Date（getUTC* で JST の値が取れる） */
function shiftToJst(date: Date): Date {
  return new Date(date.getTime() + JST_OFFSET_MS);
}

/** DB 保存用の ISO8601（例 `2026-10-10T07:00:00+09:00`） */
export function toJstIso(date: Date): string {
  const j = shiftToJst(date);
  return (
    `${j.getUTCFullYear()}-${pad(j.getUTCMonth() + 1)}-${pad(j.getUTCDate())}` +
    `T${pad(j.getUTCHours())}:${pad(j.getUTCMinutes())}:${pad(j.getUTCSeconds())}+09:00`
  );
}

export function nowJstIso(now: Date = new Date()): string {
  return toJstIso(now);
}

/** JST での日付 `YYYY-MM-DD` */
export function toJstYmd(date: Date): string {
  return toJstIso(date).slice(0, 10);
}

export function isValidYmd(ymd: string): boolean {
  const m = YMD_RE.exec(ymd);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function ymdToUtcDate(ymd: string): Date {
  if (!isValidYmd(ymd)) throw new Error(`invalid date: ${ymd}`);
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function utcDateToYmd(dt: Date): string {
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addDays(ymd: string, days: number): string {
  const dt = ymdToUtcDate(ymd);
  dt.setUTCDate(dt.getUTCDate() + days);
  return utcDateToYmd(dt);
}

/** JST の日付と時刻（`HH:mm`）から、その瞬間の Date を作る */
export function jstDateTime(ymd: string, hhmm: string): Date {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`invalid time: ${hhmm}`);
  const base = ymdToUtcDate(ymd).getTime();
  return new Date(base + (Number(m[1]) * 60 + Number(m[2])) * 60_000 - JST_OFFSET_MS);
}

/** ISO 週番号（例 `2026-W41`）。週は月曜始まり。 */
export function isoWeek(ymd: string): string {
  const dt = ymdToUtcDate(ymd);
  const dayNum = (dt.getUTCDay() + 6) % 7; // 月曜=0
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3); // その週の木曜
  const weekYear = dt.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((dt.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${weekYear}-W${pad(week)}`;
}

/** ISO 週の月曜〜日曜（両端を含む） */
export function isoWeekRange(week: string): { from: string; to: string } {
  const m = WEEK_RE.exec(week);
  if (!m) throw new Error(`invalid week: ${week}`);
  const year = Number(m[1]);
  const w = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (w - 1) * 7);
  const from = utcDateToYmd(monday);
  if (w < 1 || isoWeek(from) !== week) throw new Error(`invalid week: ${week}`);
  return { from, to: addDays(from, 6) };
}
