# CHANGELOG

- 2026-10-04 M1 土台：pnpm ワークスペース（TypeScript strict・ESLint・Vitest・zod）、`packages/core`（日付 Asia/Tokyo、月日パーサ、NG ワード検査＋`NG_WORD_MODE`、bigram Jaccard 類似度、A/B 割り当て、ULID、ハッシュ、JSON ログ、設定読み込み）、`packages/db`（docs/05 のスキーマ `0001_init.sql`、ローカル D1 適用）。テスト 98件成功。あわせて NG ワード検査を送信を止めない運用に変更（docs/09 #16）、引き寄せ（アファメーション）題材と LINE「今日のひと言」を仕様に追加（B 案）。
- 2026-10-04 M2 題材データ：`data/birthdays.yaml`（366日、規則は `apps/batch/src/data/birthdayRules.ts`、先頭コメントに設定ルール）、`data/motif_en.yaml`、`data/affirmations.yaml`（初版62件）、`data/calendar/2027.csv` テンプレート、`pnpm batch:generate-birthdays` と `pnpm batch:validate-data`（366日の重複・欠落、color_hex、motif の英訳、affirmations の重複・空欄・長さ、カレンダーの source_url 空欄など）、`data/birthdays.reviewed` が無いと本番生成を止めるゲート。検証エラー0、テスト127件成功。
