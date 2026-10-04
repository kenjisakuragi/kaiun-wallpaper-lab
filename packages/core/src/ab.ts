// A/B 割り当て（docs/02 §4）：sha256(userId + AB_SALT) の先頭バイトの偶奇。
// 初回に users.variant に保存し、以後は保存値を使う（保存は呼び出し側）。

import { sha256Bytes } from './hash.ts';

export type Variant = 'A' | 'B';

export function assignVariant(userId: string, abSalt: string): Variant {
  if (abSalt === '') throw new Error('AB_SALT is empty');
  const first = sha256Bytes(userId + abSalt)[0] as number;
  return first % 2 === 0 ? 'A' : 'B';
}
