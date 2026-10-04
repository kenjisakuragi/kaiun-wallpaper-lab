# 10 運用手順（人の作業）

## 開始前チェックリスト
- [ ] Instagram をビジネス／クリエイターアカウントにし、Facebook ページに紐付けた
- [ ] Threads アカウントを作成（Instagram と連携）し、プロフィールに「誕生日リプへのお返事は自動で送っています」「画像はAIで作成」を明記した
- [ ] Meta 開発者アプリで Threads API と Instagram Graph API を設定し、自分をテスターに登録、長期トークンを取得して設定した
- [ ] LINE 公式アカウントと Messaging API チャネルを作成し、Webhook URL を設定、管理画面の自動応答を OFF にした
- [ ] Cloudflare（Workers・D1・R2）を用意し、シークレットを設定した
- [ ] Threads・Instagram のプロフィールリンクを `/go/threads`・`/go/instagram` にした
- [ ] `data/birthdays.yaml` をレビューし `data/birthdays.reviewed` を置いた
- [ ] `data/calendar/2026.csv`・`2027.csv` に開運日を出典付きで入力した
- [ ] 試作10〜20枚で画風を確定し、初回386枚（誕生日366・開運日7・アファメーション12・共通1）をローカルPCで codex 生成し、`data/approvals.csv` で承認した
- [ ] プライバシーポリシーを公開し、LINE あいさつ文とプロフィールにリンクした
- [ ] 7日分の投稿予定（`batch:plan`）・文面・動画を作り、目視確認した
- [ ] `THREADS_AUTO_REPLY_MODE=approve` で開始する設定になっている

## 最初の2週間（毎日10分程度）
1. `batch:threads-replies` で承認キューを確認し、問題なければ `--approve-all`。不適切な返信は `--reject` し、原因（テンプレート・NG ワード）を直す。
2. 2週間で不適切な返信がほぼ出なくなったら `THREADS_AUTO_REPLY_MODE=auto` に切り替える（日次上限はそのまま）。

## 毎週（目安：合計1時間）
1. 月曜：`out/reports/YYYY-Www.md` を確認。判断ルール（`docs/06` §5）に該当したら対応を決める。
2. 随時：新しく生成された画像の承認、NG ワードの追加。画像は必要が見えたもの（使い回しが目立つ開運日・アファメーション、LINE の要望など）だけ追加生成する。
3. 投稿後、アプリで AI ラベルが付いているか確認（API で指定できない場合）。

## 壁紙パック販売（LINE 友だち300人到達後）
1. `batch:export-note-pack` で zip を作成し、note に手動出品（700〜900円台）。
2. 案内は `prompts/line_messages.md` の pack_offer で、A/B 別の URL を使って `batch:weekly-push` に載せる。
3. note の売上を `purchases` に転記。

## 障害時
- 投稿失敗：`posts.error` を確認。2回リトライ後も失敗ならその日はスキップ（翌日に繰り越さない）。
- Threads の返信で警告や制限を受けた場合：直ちに `THREADS_AUTO_REPLY_MODE=approve` に戻し、日次上限を下げる。
- LINE Webhook 停止：Workers のログを確認。停止中の入力への後追い返信はしない。
- トークン期限切れ：ログの警告に従い更新。
