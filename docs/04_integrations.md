# 04 外部連携仕様

**実装前に必ず公式ドキュメントで最新仕様を確認し、各節の「確認記録」に日付と URL を追記すること。** 以下は 2026-10-04 時点の調査メモで、二次情報を含む。

## 1. OpenAI（画像・テキスト）
- 用途：誕生日版366枚、共通版1〜4枚、開運日版、投稿文と返信文の言い回し生成。
- モデル・品質は環境変数で切り替え（`OPENAI_IMAGE_MODEL`、`OPENAI_IMAGE_QUALITY`、`OPENAI_TEXT_MODEL`）。
- 画像料金メモ（二次情報、縦長 1024×1536、1枚あたり）：GPT Image 2 は low $0.005 / medium $0.041 / high $0.165。366枚で medium 約$15、high 約$60。
- 実装要件：冪等（`images` の `(kind, key, version)`）、並列数は設定値（初期3）、429/5xx は指数バックオフで最大2回、推定コストを記録し `IMAGE_BUDGET_USD` を超える場合は開始前に停止。
- 確認記録：
  - 2026-10-04（M3）`POST https://api.openai.com/v1/images/generations`。size は `1024x1536` 等（カスタムは16の倍数・縦横比1:3〜3:1）、quality は low / medium / high / xhigh / max / auto、output_format は png（既定）/ jpeg / webp、応答は `data[].b64_json`。https://developers.openai.com/api/docs/guides/image-generation
  - 2026-10-04（M3）料金：gpt-image-2 は出力 $30 / 100万トークン、gpt-image-1-mini は出力 $8 / 100万トークン。1枚単価は公式表になく、`packages/clients/openai` の `ESTIMATED_COST_USD` は推計値。https://developers.openai.com/api/docs/pricing
  - 実装：再試行は `batch:generate-images` 側でまとめて最大2回（クライアント内の再試行は0回）。

### 1-1. codex 経由の画像生成（2026-10-04 決定、主経路）
- 仕組み：Claude Code から `codex exec` を呼び、ChatGPT ログインの codex に画像を1枚ずつ生成させて PNG を保存する（ユーザーのスキル `codex-imagegen` と同じ方式）。1枚あたり約2.5〜3.5分、1枚ずつ頼む、PNG の有無で再開、1枚15分で打ち切り。
- 実行場所：**ローカルPCのみ**。GitHub Actions など共有環境には ChatGPT の認証情報（`~/.codex/auth.json`）を置かない。
- 生成物のサイズは指示文で 9:16 を頼むが保証されないため、必ず 1080×1920 とプレビュー用に縮小・切り抜きしてから R2 に上げる。
- 冪等・承認・R2 の扱いは Images API と共通（`images` の `(kind, key, version)`）。`IMAGE_BUDGET_USD` の予算チェックは openai 経路のときだけ効く。
- M3 の最初に20枚を試作し、1枚あたりの時間・利用上限に当たる頻度・サイズのばらつき・画風のそろい方を測ってから量産する。上限に当たりすぎる場合は残りを Images API（予備経路）に切り替える。
- 確認記録：
  - 2026-10-04 画像生成は Codex の利用枠に含まれ、画像なしの同程度のやり取りより平均3〜5倍速く枠を消費する。5時間ごとの上限と週の上限がある。Free プランでは画像生成不可。https://learn.chatgpt.com/docs/pricing
  - 2026-10-04 CI など自動化の共有環境では API キー認証が推奨。`auth.json` はパスワード同様に扱い、共有しない。https://learn.chatgpt.com/docs/auth
  - 2026-10-04 OpenAI 利用規約（https://openai.com/policies/row-terms-of-use/ ）は 403 で本文を確認できず（`docs/09` #25）。

## 2. Cloudflare R2 / D1 / Workers
- R2：`images/{random_prefix}/{kind}/{key}_v{version}.jpg`（プレビューは `_v{version}_preview.jpg`。作り直しで URL が変わるよう版を入れる）、`videos/{random_prefix}/{date}_{post_id}.mp4`。Threads・Instagram・LINE が取得できる公開 URL が必要。
- D1：スキーマは `docs/05`。マイグレーションは `packages/db/migrations/`。
- Workers（`apps/edge`）：LINE Webhook、Threads Webhook（使える場合）、`/go/{platform}` リダイレクト。シークレットは `wrangler secret`。
- 確認記録：
  - 2026-10-04（M3）R2 の S3 互換 API：エンドポイント `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`、region は `auto`、PutObject / HeadObject 対応。認証は R2 の API トークン画面で発行するアクセスキー（`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`）。https://developers.cloudflare.com/r2/api/s3/api/
  - 2026-10-04（M3）R2 の公開：`r2.dev` サブドメインは速度制限があり開発用、本番は独自ドメインを推奨（`docs/09` #30）。https://developers.cloudflare.com/r2/buckets/public-buckets/
  - 2026-10-04（M3）D1 の REST API：`POST /client/v4/accounts/{account_id}/d1/database/{database_id}/query`、本文 `{ sql, params }`、`Authorization: Bearer <API トークン>`、応答は `result[].results` と `meta.changes`。バッチは `DB_MODE=d1` でこれを使う。https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
  - 2026-10-04（M1）D1 マイグレーション：番号付きの `.sql` を順に適用し、適用済みは `d1_migrations` テーブルで管理。置き場所は D1 バインディングの `migrations_dir` で指定（本リポジトリは `packages/db/migrations`）。https://developers.cloudflare.com/d1/reference/migrations/
  - 2026-10-04（M1）`wrangler d1 migrations apply <DB> --local [--persist-to <dir>]` で適用。CI・非対話環境では確認プロンプトを自動でスキップ。`wrangler d1 execute` は `--command` / `--file` / `--json` / `--yes`。https://developers.cloudflare.com/workers/wrangler/commands/d1/
  - 2026-10-04（M1）使用バージョン：wrangler 4.147.0。テストのローカル D1 は wrangler の `getPlatformProxy`（`persist: false`）で起動。

## 3. Threads API
公式概要ページ（https://developers.facebook.com/docs/threads/overview ）で確認した事項：
- 投稿の種類：テキスト・画像・動画・カルーセル
- テキストの上限：500文字
- 上限：API での投稿は24時間の移動窓で250件、返信は1,000件
- 権限の例：`threads_basic`、`threads_content_publish`、`threads_manage_replies`

二次情報（要確認）：
- 投稿手順はコンテナ方式。`POST /{user-id}/threads`（`media_type=IMAGE`、`image_url`、`text`）でコンテナ作成 → 少なくとも30秒待つ → `POST /{user-id}/threads_publish`。
- 返信は、コンテナ作成時に `reply_to_id` を指定する。
- 画像：JPEG/PNG、8MB以下、幅320〜1440px。動画：MP4/MOV、H.264/HEVC、23〜60fps、5分以内。
- 長期トークンは60日有効で、期限内に更新できる。
- インサイト：投稿ごとに views、likes、replies、reposts、quotes、shares。権限 `threads_manage_insights`。
- 返信の読み取りは `threads_read_replies`。返信イベントの Webhook がある（2024年10月追加とされる）。
- 開発モードでは、アプリに登録したテスターのアカウントで審査なしに動かせる。本番公開には審査が必要とされる。本実験は自分のアカウントのみで使う。
実装要件：
- 投稿・返信とも、状態遷移で冪等（`posts.threads_status`、`threads_replies.status`）。
- 自動返信の日次上限 `THREADS_AUTO_REPLY_DAILY_CAP`（初期50）は、API上限1,000件よりかなり低く設定する。
- トークンの期限7日前にログで警告し、更新ジョブを用意する。
- 確認記録：（実装時に追記）

## 4. Instagram Graph API（リール）
- 前提：Instagram ビジネスまたはクリエイターアカウント、Facebook ページに紐付け。
- 自分のアカウントだけなら、アプリは開発モードで自分を管理者／テスターにすれば動く（二次情報）。
- 投稿上限：24時間あたり25投稿（リール・ストーリーズ含む、二次情報）。
- 手順：`media_type=REELS`、`video_url`、`caption` でコンテナ作成 → `status_code` が `FINISHED` になるまでポーリング（10秒間隔、最大10分）→ `media_publish`。
- 指標：投稿ごとのインサイト（再生・保存・リーチ等。リールで取得できるメトリクス名は要確認）を週次で取得。
- AIラベル：API で指定できるかは未確認。できなければ投稿後にアプリで確認する運用（`docs/10`）。
- 確認記録：（実装時に追記）

## 5. LINE Messaging API
- Webhook：署名検証（`X-Line-Signature`、チャネルシークレットで HMAC-SHA256）。失敗は 401。
- イベント：`follow`、`unfollow`、`message`（text）。それ以外は 200 を返して無視。
- 返信：Reply API で画像メッセージ（`originalContentUrl`、`previewImageUrl`、HTTPS）。画像の容量・サイズ上限は公式で要確認。
- 通数（LINE公式アカウントの料金ページ https://www.lycbiz.com/jp/service/line-official-account/plan/ ）：応答メッセージ・あいさつメッセージ・チャットはカウントされない。プッシュはカウントされる。
  - 無料プラン：月200通、追加不可
  - ライトプラン：月5,000円（税別）・5,000通、追加不可
  - スタンダードプラン：月15,000円（税別）・30,000通、追加可（2026年10月1日に追加メッセージ料金を改定）
- 週1プッシュの前に「今月の送信済み通数＋今回の送信数」を計算し、`LINE_MONTHLY_PUSH_LIMIT` を超える場合は送信せず停止して警告する。
- 確認記録：（実装時に追記）

## 6. このフェーズで使わないもの
- **TikTok**：Content Posting API は監査前のクライアントからの投稿が非公開表示に制限される（公式 Get Started）。Threads・Instagram の結果を見てから判断する。
- **note**：公式の投稿APIは確認できていない。壁紙パックの出品は手動、バッチは zip を書き出すだけ。

## 参考（2026-10-04 調査時）
- Threads API 概要（公式）: https://developers.facebook.com/docs/threads/overview
- Threads API（二次）: https://www.socialcrawl.dev/blog/threads-api
- Threads API 投稿手順（二次）: https://postproxy.dev/blog/how-to-post-to-threads-via-api/
- Instagram Graph API（二次）: https://zernio.com/blog/instagram-graph-api
- LINE公式アカウント 料金プラン: https://www.lycbiz.com/jp/service/line-official-account/plan/
- OpenAI 画像API料金（二次）: https://costgoat.com/pricing/openai-images
- TikTok Content Posting API Get Started: https://developers.tiktok.com/docs/en/content-posting-api-get-started
