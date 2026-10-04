// pnpm batch:generate-birthdays [--force]
// data/birthdays.yaml（366日分）を規則から作る（docs/03 §1-1）。レビュー済み・既存ファイルは --force なしで上書きしない。

import { writeBirthdays } from '../data/writeBirthdays.ts';
import { runValidateData } from '../data/runValidate.ts';

const force = process.argv.includes('--force');
const result = writeBirthdays({ force });
if (!result.written) {
  process.stdout.write(`書き出しませんでした：${result.reason ?? ''}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('data/birthdays.yaml を書き出しました（366日）。続けて検証します。\n');
  process.exitCode = runValidateData();
}
