// pnpm batch:validate-data
// 題材データ（birthdays / motif_en / affirmations / calendar）を検証し、エラーがあれば終了コード1。

import { runValidateData } from '../data/runValidate.ts';

process.exitCode = runValidateData();
