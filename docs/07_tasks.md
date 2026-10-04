# 07 実装タスク（マイルストーン）

各マイルストーンは「完了条件」をすべて満たしてから次へ進む。完了時に `CHANGELOG.md` に1行追記する。

## M1 土台
- pnpm ワークスペース、TypeScript strict、ESLint、Vitest、zod。
- `packages/core`：日付（Asia/Tokyo）、月日パーサ、NG ワード検査、文面類似度（文字 bigram Jaccard）、A/B 割り当て、ULID。
- `packages/db`：`docs/05` のスキーマとマイグレーション。
- `.env.example` と設定読み込み（zod で検証、不足キーで起動失敗）。
**完了条件**
- 月日パーサ：`0315`、`3/15`、`3月15日`、`０３１５`、` 3 / 15 `、`誕生日は0315です！` を 03-15 と解釈。`0230`、`1301`、`abc`、`20260315`（8けた）は失敗。`0229` は成功。
- NG ワード検査：`data/ng_words.txt` の語（全角半角・かなの揺れを正規化）を含む文を検出する。`NG_WORD_MODE=block` なら reject、`warn` なら該当語を返して通す、`off` なら検査しない（2026-10-04 決定、`docs/09` #16）。
- A/B 割り当て：同じ userId は常に同じ群、擬似ID1万件で比率 48〜52%。
- マイグレーションがローカル D1 で適用できる。

## M2 題材データ
- `data/birthdays.yaml` を `docs/03` §1-1 の規則で366日分生成するスクリプト。先頭コメントに設定ルール。
- `data/calendar/2026.csv`・`2027.csv` のテンプレート（中身は人が入力）。
- `data/affirmations.yaml`（アファメーションの短い言葉、初期60件以上）の初版を作る。人がレビューする。
- `batch:validate-data`：366日の重複・欠落、color_hex 形式、カレンダー CSV の source_url 空欄、affirmations.yaml の重複・空欄を検出。
**完了条件**：検証エラー0。`data/birthdays.reviewed` が置かれるまで M3 の本番生成は実行できない。

## M3 画像生成と承認
- `packages/clients/openai`、`packages/clients/codex`（`codex exec` を呼ぶ画像生成。テストではモック）、`packages/clients/r2`。画像生成は共通のインターフェースにし、`IMAGE_GENERATOR=codex|openai` で切り替える（`docs/04` §1-1）。
- `batch:generate-images`：kind/範囲指定、`--dry-run`、予算上限（openai 経路）、冪等、並列（openai 経路。codex は1枚ずつ）、リトライ、コスト記録、R2 アップロード、配布用とプレビュー用の2サイズ（生成サイズのばらつきを縮小・切り抜きで吸収）。
- 初回の枚数は `docs/03` §1-5（386枚）。量産前に10〜20枚を試作する。
- 承認：`out/review/index.html`（一覧）を出力 → 人が `data/approvals.csv` に approved/rejected → `batch:apply-approvals`。
**完了条件**：`--dry-run` で枚数と推定コスト（openai）または推定時間（codex）を表示。3枚の実生成（live テスト、codex はローカルで実行）で R2 公開URLから取得できる。2回実行しても再生成されない。生成サイズが違う画像でも 1080×1920 とプレビュー用が作られるテスト。

## M4 投稿計画・文面・動画
- `batch:plan --from --days`：`docs/03` §6 に沿って `posts` に予定を登録（題材は birthday / kaiunbi / affirmation、比率は `docs/09` #15）。
- 文面生成：Threads 本文（`prompts/threads_post.md`）と Instagram キャプション（`prompts/caption_instagram.md`）。NG ワード検査（`NG_WORD_MODE`）→ 類似度検査 → 不合格なら最大3回再生成 → だめなら `skipped`。
- `batch:render-videos`：`docs/03` §3 の仕様で ffmpeg 合成（Instagram 用）。
- 評価ループの記録（`docs/06` §6）：マイグレーション0002で `posts` に `prompt_version`・`hook_type`・`style_version`・`post_time`・`ng_hits` を追加し、計画・文面生成時に記録する。
**完了条件**：7日分の計画・文面・動画が作れる。評価ループ用の列が記録されることのテスト。動画が 1080×1920・30fps・12〜15秒であることを ffprobe で検証。`NG_WORD_MODE=block` のとき NG ワードを含む文面が予定に入らず、`warn` のとき記録されたうえで入ることのテスト。Threads 本文が500文字以内であることのテスト。

## M5 Threads 投稿
- `packages/clients/threads`：コンテナ作成（IMAGE）→ 30秒以上待機 → 公開、トークン更新、インサイト取得。
- `batch:publish-threads --date`：`threads_status` の状態遷移で冪等。
**完了条件**：自分のアカウントに1本公開できる。公開済みに再実行しても二重投稿しない（状態遷移のテスト）。

## M6 Threads 誕生日リプ返信
- 取得：Webhook（`apps/edge`）が使えるか公式で確認し、使えなければ Cloudflare Workers の Cron Triggers（15分ごと）で自分の投稿への返信を取得（`docs/09` #26）。
- 対象判定（`docs/02` §5）→ 月日解釈 → 返信文生成（`prompts/threads_replies.md`）→ NG（`NG_WORD_MODE`）・類似度検査 → `THREADS_AUTO_REPLY_MODE` に従い承認キューか自動送信（日次上限）。
- `batch:threads-replies`：承認キューの一覧表示、`--approve <id>`、`--approve-all`、`--reject <id>`。
**完了条件**
- 同じリプに二重返信しないテスト（`inbound_reply_id` の一意制約）。
- 自分のリプ・72時間超のリプ・月日を解釈できないリプには返信しないテスト。
- 日次上限を超えた分が `capped` になるテスト。
- 返信文にURL・ハッシュタグ・月日の数字が含まれないテスト。
- `approve` モードでは API を呼ばないテスト。

## M7 Instagram 投稿・リダイレクト・LINE
- `packages/clients/instagram`：コンテナ作成 → `FINISHED` 待ち → 公開、インサイト取得、トークン更新。`batch:publish-instagram --date`（冪等）。
- `apps/edge`：
  - `/go/{platform}`：クリック記録（IP・Cookie を保存しない）→ LINE 友だち追加 URL へ 302。
  - LINE Webhook：署名検証、follow/unfollow/message、A/B 割り当て、月日解釈、画像返信（Reply API）、エラー案内（1日1回まで）、受信記録（本文は保存しない）、「今日のひと言」の返信（`docs/03` §5-1）。
- `batch:weekly-push`：壁紙パックの案内など要所のプッシュだけ（開運日の案内は返信方式、`docs/03` §5-0）。月間通数チェック。
- `batch:fetch-metrics`：Threads・Instagram の投稿別指標を `post_metrics` に保存。
**完了条件**
- Instagram に1本公開でき、再実行で二重投稿しない。
- `/go/threads` が 302 を返しクリックが記録される。
- LINE：署名不正で 401。A 群には誕生日画像、B 群には共通画像。未承認画像は返さない。通数上限を超える場合は送信しない。「ひと言」には A/B 両群に同じ言葉を返し、`counted=0` で記録する。

## M8 週次レポート
- `batch:weekly-report`（`docs/06` §4）と、題材別・変更点別の集計、来週の変更案（`docs/06` §6）。
**完了条件**：テストデータで全項目が出力され、各群100人未満のとき「判断不能」と表示される。題材別・変更点別の集計で件数が少ないときも「判断不能」と表示される。

## 実装順の注意
M2 の題材レビューと M3 の画像承認は人の作業が入る。待ち時間の間に M4 以降のコードとテストを進めてよいが、本番データでの実行は承認後に限る。M6 の自動返信は、最初の2週間は `approve` モードで運用する。
