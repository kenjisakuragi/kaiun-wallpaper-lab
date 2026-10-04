# kaiun-wallpaper-lab — 開運待ち受け 実証実験（Threads・Instagram）

誕生日別の開運待ち受け画像を **Threads と Instagram** で配信し、LINE で受け取ってもらうことでリストを獲得する実証実験の実装一式です。Threads では、誕生日を4けたでリプしてくれた人に守護カラーを自動で返信します。

## 使い方（Claude Code に渡す）
1. このフォルダを新しいリポジトリとして作成し、Claude Code で開く。
2. 最初の指示の例：
   > CLAUDE.md と docs/ を番号順に読んで、docs/07_tasks.md の M1 を実装してください。完了条件をテストで示し、終わったら止まって報告してください。
3. 以降は M2 → M8 の順に1つずつ指示する。M2 と M3 の後には人のレビュー（題材と画像の承認）が入る。

## ドキュメント
| ファイル | 内容 |
| --- | --- |
| `CLAUDE.md` | Claude Code への作業ルール・媒体・技術スタック・禁止事項 |
| `docs/01_requirements.md` | 背景の事実と未検証の点、実験の問い、スコープ、実験設計、KPI |
| `docs/02_architecture.md` | 全体構成、A/B、Threads 誕生日リプ返信、LINE、リンク計測、スケジュール |
| `docs/03_content_spec.md` | 画像・Threads 投稿と返信・Instagram リール・LINE 文面の仕様 |
| `docs/04_integrations.md` | OpenAI / Cloudflare / Threads / Instagram / LINE の連携仕様と制約 |
| `docs/05_data_model.md` | D1 のテーブル定義 |
| `docs/06_kpi_and_reporting.md` | 指標の定義、比較基準、週次レポート、判断ルール |
| `docs/07_tasks.md` | 実装マイルストーン（M1〜M8）と完了条件 |
| `docs/08_compliance.md` | 表現ルール、法令上の注意、自動化の範囲 |
| `docs/09_open_questions.md` | 未決事項 |
| `docs/10_runbook.md` | 人の運用手順と開始前チェックリスト |

## 人がやること（概要）
- アカウント類の準備（Instagram・Threads・Meta 開発者アプリ・LINE・Cloudflare・OpenAI）
- 題材データと画像のレビュー・承認
- 開運日カレンダーの入力（出典付き）
- 最初の2週間は Threads 自動返信の承認（1日10分程度）、以降は週1回のレポート確認
- 未決事項（`docs/09`）の判断
