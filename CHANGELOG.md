# CHANGELOG

- 2026-10-04 M1 土台：pnpm ワークスペース（TypeScript strict・ESLint・Vitest・zod）、`packages/core`（日付 Asia/Tokyo、月日パーサ、NG ワード検査＋`NG_WORD_MODE`、bigram Jaccard 類似度、A/B 割り当て、ULID、ハッシュ、JSON ログ、設定読み込み）、`packages/db`（docs/05 のスキーマ `0001_init.sql`、ローカル D1 適用）。テスト 98件成功。あわせて NG ワード検査を送信を止めない運用に変更（docs/09 #16）、引き寄せ（アファメーション）題材と LINE「今日のひと言」を仕様に追加（B 案）。
