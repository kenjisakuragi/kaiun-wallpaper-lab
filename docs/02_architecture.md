# 02 アーキテクチャ

## 1. 全体像
```
[データ]                [バッチ apps/batch]
calendar/*.csv  ──┐
birthdays.yaml  ──┼─> generate-images ─> R2(images/) ─┬─> publish-threads ───> Threads（画像付き投稿）
prompts/*.md    ──┘                                   ├─> render-videos ─> R2(videos/) ─> publish-instagram ─> Instagram リール
                                                      └─> LINE 返信用の画像URL

[Threads のリプ]  ユーザーが誕生日をリプ ─> apps/edge（Webhook、またはバッチでポーリング）
                  ─> 月日を解釈 ─> 返信文を生成・検査 ─> 承認キュー or 自動返信（上限あり）

[プロフィールリンク] /go/threads, /go/instagram（apps/edge）─> クリック記録 ─> LINE 友だち追加URLへリダイレクト

[LINE]  友だち追加・月日送信 ─> apps/edge ─> D1 ─> 返信（画像、A/B）

[集計]  fetch-metrics（Threads・Instagram Insights）+ D1 ─> weekly-report ─> out/reports/週.md
```

## 2. リポジトリ構成
```
apps/
  batch/              # CLI: 画像生成・動画化・投稿・返信承認・指標・レポート
  edge/               # Cloudflare Workers: LINE Webhook、Threads Webhook、/go リダイレクト
packages/
  clients/openai/     # 画像・テキスト生成
  clients/threads/    # Threads API
  clients/instagram/  # Instagram Graph API
  clients/line/       # LINE Messaging API
  clients/r2/
  core/               # 日付、月日パーサ、NGワード検査、類似度判定、A/B割り当て、型
  db/                 # D1 スキーマとマイグレーション、クエリ
data/                 # calendar/*.csv, birthdays.yaml, ng_words.txt, motif_en.yaml
prompts/              # 画像・投稿文・返信文・LINE文面
out/                  # 生成物（git管理外）
docs/
```

## 3. 実行環境
- バッチ：GitHub Actions のスケジュール実行、またはローカル cron。ffmpeg が必要。
- 画像生成：ローカルPCで手動実行（codex 経由、`docs/04` §1）。GitHub Actions では画像を生成しない。
- Edge：Cloudflare Workers（D1・R2 をバインド）。
- 生成物：R2 に保存し公開 URL を発行。公開パスにはランダム接頭辞を付ける。

## 4. A/B 割り当て（LINE）
- 単位：LINE userId。`sha256(userId + AB_SALT)` の先頭バイトの偶奇で決め、初回に `users.variant` に保存。以後は保存値を使う。
- タイミング：友だち追加（follow イベント）時。
- 割り当ては友だち追加の後なので「登録率」の A/B 比較はできない。比較するのは、月日の入力完了率、7日・30日ブロック率、壁紙パック購入率（`docs/06`）。

## 5. Threads の誕生日リプ返信フロー
1. 取得：Threads の Webhook（返信イベント）を受けるか、使えない場合は Cloudflare Workers の Cron Triggers で自分の投稿への返信を15分ごとにポーリング（`docs/09` #26。実装時に公式で可否を確認し `docs/04` に記録）。
2. 対象：**自分の投稿への直接のリプ**のみ。自分自身のリプ、すでに返信済みのリプ、投稿から72時間を過ぎたリプは対象外。
3. 解釈：本文から月日を解釈（LINE と同じパーサ）。解釈できなければ何もしない（案内の返信もしない）。
4. 生成：`prompts/threads_replies.md` のテンプレートと、その月日の `color_name`・`keyword` から返信文を作る（LLM は言い回しの揺らぎ付けのみ）。NG ワード検査（`NG_WORD_MODE` に従う。初期値 `warn` は記録のみ）と類似度検査（直近200件）を通す。
5. 送信：`THREADS_AUTO_REPLY_MODE`
   - `approve`：`threads_replies` に `pending` で保存し、人が `batch:threads-replies --approve` で送る。
   - `auto`：日次上限 `THREADS_AUTO_REPLY_DAILY_CAP` まで自動送信。超えた分は送らず `capped` で記録。
6. 保存：リプの ID、ユーザー名のハッシュ、解釈の成否、送信状態のみ。月日・本文・生のユーザー名は保存しない。

## 6. LINE のフロー
1. follow → `users` に作成、A/B 割り当て → あいさつ（月日の送り方を案内）を返信。
2. テキスト受信 → 月日として解釈（`0315`、`3/15`、`3月15日`、全角数字を許容）。
   - 成功：A なら該当日の画像、B なら共通画像を返信。`deliveries` に記録。
   - 失敗・存在しない日付：送り方の案内を返信（1日1回まで）。
3. unfollow → `users.blocked_at` を記録。
4. 開運日の案内は、ユーザーがリッチメニューから「開運日」を送ったときに返す（Reply API、通数に数えない。`docs/09` #27）。プッシュは壁紙パックの案内など要所だけ `apps/batch` から送る（通数上限チェックあり）。
返信は Reply API を使う（応答メッセージは通数にカウントされない。根拠は `docs/04`）。

## 7. プロフィールリンクの計測
- Threads・Instagram のプロフィールリンクは `https://{EDGE_HOST}/go/threads`、`/go/instagram`。
- Edge はクリックを `link_clicks` に記録（IP は保存しない。日時・媒体・User-Agent の種別のみ）して、LINE 友だち追加 URL に 302 リダイレクトする。
- LINE の友だち追加を媒体に正確に紐付けることはできないため、媒体別の評価はクリック数と、同時期の友だち純増の比で見る。

## 8. スケジュール（設定値で変更可）
- 毎日 07:00 JST：Threads に投稿
- 毎日 19:00 JST：Instagram にリールを投稿
- 15分ごと：Threads のリプ取得（Webhook が使えない場合。Cloudflare Workers の Cron Triggers）
- 毎日 08:00 JST：投稿後24時間・72時間・7日を迎えた投稿の指標取得（評価ループ、`docs/06` §6）
- 毎週月曜 08:00 JST：週次レポートと来週の変更案
