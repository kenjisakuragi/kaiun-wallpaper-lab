import { validateData } from './validate.ts';

/** 検証結果を人が読める形で出し、終了コード（エラーなし=0）を返す */
export function runValidateData(dataDir?: string, write: (s: string) => void = (s) => process.stdout.write(s)): number {
  const { errors, warnings } = validateData(dataDir);
  for (const w of warnings) write(`[warn]  ${w.file}: ${w.message}\n`);
  for (const e of errors) write(`[error] ${e.file}: ${e.message}\n`);
  write(`検証エラー ${errors.length} 件、警告 ${warnings.length} 件\n`);
  return errors.length === 0 ? 0 : 1;
}
