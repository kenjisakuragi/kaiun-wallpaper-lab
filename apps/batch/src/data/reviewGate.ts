// data/birthdays.reviewed が置かれるまで、本番の画像生成（M3）を動かさない（docs/07 M2 完了条件）。

import { existsSync } from 'node:fs';
import { dataPaths } from '../paths.ts';

export class BirthdaysNotReviewedError extends Error {
  constructor() {
    super('data/birthdays.reviewed がありません。data/birthdays.yaml を人がレビューしてから置いてください（--dry-run は実行できます）');
    this.name = 'BirthdaysNotReviewedError';
  }
}

export function isBirthdaysReviewed(dataDir?: string): boolean {
  return existsSync(dataPaths(dataDir).birthdaysReviewed);
}

/** 本番生成の入口で呼ぶ。dry-run では呼ばない。 */
export function assertBirthdaysReviewed(dataDir?: string): void {
  if (!isBirthdaysReviewed(dataDir)) throw new BirthdaysNotReviewedError();
}
