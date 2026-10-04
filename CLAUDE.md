# CLAUDE.md — 開運待ち受け 実証実験（kaiun-wallpaper-lab）

このリポジトリは「誕生日別の開運待ち受け画像を **Threads と Instagram** で配信し、LINE でリストを獲得する」実証実験の実装です。
実装を始める前に `docs/` を番号順に読んでください。仕様の正は `docs/` で、このファイルは作業ルールです。

## 目的（1行）
初期投資と運用工数を最小にして、「待ち受け配布型」を Threads・Instagram で行ったときに LINE リストが月に何人増えるか、個別化（誕生日ごとの専用画像）が効くかを、媒体ごと100本の投稿で測る。

## 媒体（決定事項）
- **Threads**：画像付きの投稿を毎日。誕生日を4けたでリプしてくれた人に、守護カラーを自動で返信する（上限・承認モードあり）。
- **Instagram**：リール（15秒の縦動画）を毎日。
- TikTok・X・note への自動投稿はこのフェーズでは実装しない（`docs/04` §6）。

## 作業の進め方
- `docs/07_tasks.md` のマイルストーン順に実装する。1マイルストーン＝1つのまとまった変更。各マイルストーンの「完了条件」を満たしたことをテストまたは手順で示してから次へ進む。
- 仕様に書かれていない判断が必要になったら、`docs/09_open_questions.md` に追記する。**2026-10-04 から、費用が発生しない判断は Claude Code が決めて docs/09 に「委任により決定」と記録し、止まらずに進める**（ユーザーの全権委任）。人に確認するのは、費用が発生するもの、アカウント作成・ログイン・認証情報の入力、ダウンロード・インストール・公開など安全ルールで都度の許可が要る操作だけ。
- 外部APIの仕様（上限・パラメータ・権限・審査）は変わる。実装前に公式ドキュメントで確認し、確認日と URL を `docs/04_integrations.md` の該当箇所に追記する。記憶やブログ記事を根拠にしない。

## 技術スタック（決定事項）
- 言語：TypeScript（Node.js 20+）。パッケージ管理は pnpm。
- バッチ（画像生成・動画化・投稿・指標取得）：`apps/batch`。ローカル実行と GitHub Actions の両方で動くこと。
- Webhook・リダイレクト：`apps/edge`（Cloudflare Workers）。LINE Webhook、Threads 返信の処理、プロフィールリンク用のリダイレクト計測。
- ストレージ：Cloudflare R2（画像・動画。Threads・Instagram・LINE に渡すため公開URLが必要）。
- DB：Cloudflare D1（SQLite）。スキーマは `docs/05_data_model.md`。
- 動画合成：ffmpeg。
- 画像生成：codex CLI 経由の ChatGPT 画像生成（サブスク内、**ローカルPCでの一括生成のみ**。CI では使わない）。予備として OpenAI Images API。`IMAGE_GENERATOR=codex|openai` で切り替え（2026-10-04 決定、`docs/04` §1）。キャプション・返信文の生成：LLM（モデル名は設定値）。

## 守ること（違反したら差し戻し）
1. **秘密情報をコードやログに出さない。** APIキー・トークンは環境変数のみ。`.env.example` にキー名だけ書く。
2. **生年は収集しない。** LINE で受け取るのは「月日」だけ。Threads のリプから読み取った月日は返信に使うだけで保存しない。
3. **NG ワード検査は送信を止めない（2026-10-04 決定、`docs/09` #16）。** 生成テキスト（投稿文・返信文・LINE文面）は `NG_WORD_MODE`（`off` / `warn` / `block`、初期 `warn`）に従って検査する。`warn` は該当語をログに記録するだけで送る。`block` に戻せば引っかかったものは送らない。表現ガイドライン（`docs/08` §1）はプロンプトの指示として残す。
4. **AI生成であることを隠さない。** 投稿文末尾の定型文と、プラットフォームの AI ラベル（指定できる場合）。
5. **同一・高類似の文面を使い回さない。** 投稿文は直近90日、Threads の自動返信は直近200件と比較し、完全一致または類似度が閾値以上なら再生成する。
6. **フォロー／いいね／リポストの自動化、相互フォロー、懸賞は実装しない。** 自動で行う能動的な行為は「自分の投稿へのリプへの返信」だけ。
7. **Threads の自動返信は上限と承認モードを持つ。** 1日の自動返信数は `THREADS_AUTO_REPLY_DAILY_CAP`（初期50）まで。`THREADS_AUTO_REPLY_MODE=approve` の間は送信せず承認キューに入れる。返信本文に外部リンクを入れない。
8. 失敗時は投稿をスキップして記録し、リトライは最大2回。二重投稿を防ぐため、投稿・返信はテーブルの状態遷移で冪等にする。

## コマンド（実装時に整備すること）
- `pnpm install` / `pnpm test`
- `pnpm batch:validate-data`
- `pnpm batch:generate-images --kind birthday --from 01-01 --to 12-31 [--dry-run] [--force]`
- `pnpm batch:apply-approvals`
- `pnpm batch:plan --from 2026-10-10 --days 7`
- `pnpm batch:render-videos --date 2026-10-10`
- `pnpm batch:publish-threads --date 2026-10-10`
- `pnpm batch:publish-instagram --date 2026-10-10`
- `pnpm batch:threads-replies [--approve <id>|--approve-all|--reject <id>]`
- `pnpm batch:fetch-metrics --week 2026-W41`
- `pnpm batch:weekly-push --week 2026-W41`
- `pnpm batch:weekly-report --week 2026-W41`
- `pnpm batch:export-note-pack --name <name>`
- `pnpm edge:dev` / `pnpm edge:deploy`

## コード規約
- 型は厳格（`strict: true`）。外部APIのレスポンスは zod で検証してから使う。
- 外部APIクライアントは `packages/clients/*` に集約し、テストではモックする。実APIを叩くテストは `*.live.test.ts` に分け、CIでは実行しない。
- 日付は Asia/Tokyo で扱う。DBには ISO8601（UTCオフセット付き）で保存。
- ログは JSON 1行。LINE userId と Threads のユーザー名はハッシュ化して出力する。

## 完了の定義（実験開始可能な状態）
`docs/07_tasks.md` の M1〜M8 がすべて完了し、`docs/10_runbook.md` の「開始前チェックリスト」が全項目 OK であること。
