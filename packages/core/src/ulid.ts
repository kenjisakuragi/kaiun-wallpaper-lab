// ID は ULID（docs/05）。同一ミリ秒内でも順序が保たれるよう monotonic を使う。

import { monotonicFactory } from 'ulidx';

const next = monotonicFactory();

export function newId(now: number = Date.now()): string {
  return next(now);
}
