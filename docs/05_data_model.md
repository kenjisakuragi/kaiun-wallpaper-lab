# 05 データモデル（Cloudflare D1 / SQLite）

日時は ISO8601 文字列（例 `2026-10-10T07:00:00+09:00`）。ID は ULID。

## images
| 列 | 型 | 説明 |
| --- | --- | --- |
| id | TEXT PK | |
| kind | TEXT | `birthday` / `common` / `kaiunbi` / `affirmation` |
| key | TEXT | birthday は `MM-DD`、kaiunbi は開運日の type（例 `ichiryumanbaibi`、追加分は `ichiryumanbaibi-2`）、common は `v1` 等、affirmation は `a001` 等 |
| version | INTEGER | 再生成時に +1 |
| prompt_hash | TEXT | |
| model / quality | TEXT | codex 経由は model=`chatgpt-codex`、quality=`n/a` |
| r2_url_full | TEXT | 1080×1920 |
| r2_url_preview | TEXT | LINE プレビュー用 |
| cost_usd | REAL | 推定コスト（codex 経由は 0） |
| status | TEXT | `generated` / `approved` / `rejected` |
| created_at | TEXT | |
UNIQUE(kind, key, version)。投稿・返信に使うのは `approved` の最新 version のみ。

## posts
| 列 | 型 | 説明 |
| --- | --- | --- |
| id | TEXT PK | |
| scheduled_date | TEXT | `YYYY-MM-DD` |
| slot | INTEGER | その日の何本目か |
| theme | TEXT | `birthday` / `kaiunbi` / `affirmation` |
| image_id | TEXT FK | |
| video_url | TEXT | Instagram 用 |
| text_threads | TEXT | |
| caption_instagram | TEXT | |
| threads_status | TEXT | `planned` / `container_created` / `published` / `failed` / `skipped` |
| threads_container_id / threads_media_id | TEXT | |
| ig_status | TEXT | 同上 |
| ig_container_id / ig_media_id | TEXT | |
| threads_error / ig_error | TEXT | 媒体別（`docs/09` #14） |
| threads_retry_count / ig_retry_count | INTEGER | 媒体別、最大2 |
| created_at / updated_at | TEXT | |
UNIQUE(scheduled_date, slot)。各 status は前進のみ許可（published から戻さない）。

## threads_replies（誕生日リプへの返信）
| 列 | 型 | 説明 |
| --- | --- | --- |
| id | TEXT PK | |
| post_id | TEXT FK | どの本投稿へのリプか |
| inbound_reply_id | TEXT UNIQUE | 相手のリプの Threads ID（二重返信防止） |
| author_hash | TEXT | ユーザー名のハッシュ（生の名前は保存しない） |
| parsed_ok | INTEGER | 月日として解釈できたか |
| reply_text | TEXT | 送る（送った）返信文。月日の数字そのものは含めない |
| status | TEXT | `pending`（承認待ち）/ `sent` / `rejected` / `capped`（上限超過）/ `skipped`（対象外）/ `failed` |
| outbound_reply_id | TEXT | 送信した返信の ID |
| received_at / sent_at | TEXT | |
月日・相手の本文は保存しない。

## link_clicks
| 列 | 型 | 説明 |
| --- | --- | --- |
| id | TEXT PK | |
| platform | TEXT | `threads` / `instagram` |
| clicked_at | TEXT | |
| ua_class | TEXT | `ios` / `android` / `desktop` / `other` |
IP・Cookie は保存しない。

## users（LINE）
| 列 | 型 | 説明 |
| --- | --- | --- |
| user_hash | TEXT PK | `sha256(userId + USER_HASH_SALT)` |
| user_id_enc | TEXT | プッシュ配信用に暗号化した userId（鍵は Workers シークレット） |
| variant | TEXT | `A` / `B` |
| birthday_md | TEXT | `MM-DD`（未入力は NULL） |
| followed_at / birthday_set_at / blocked_at | TEXT | |
| refollowed_count | INTEGER | |

## deliveries（LINE 送信）
| 列 | 型 | 説明 |
| --- | --- | --- |
| id | TEXT PK | |
| user_hash | TEXT FK | |
| type | TEXT | `birthday_reply` / `common_reply` / `daily_word_reply` / `weekly_push` / `pack_offer` |
| image_id | TEXT NULL | |
| sent_at | TEXT | |
| counted | INTEGER | 通数にカウントされる送信（push）なら 1 |

## inbound_messages（LINE 受信）
| 列 | 型 | 説明 |
| --- | --- | --- |
| id | TEXT PK | |
| user_hash | TEXT | |
| parsed_ok | INTEGER | |
| received_at | TEXT | |
本文は保存しない。

## post_metrics
| 列 | 型 | 説明 |
| --- | --- | --- |
| post_id | TEXT | |
| platform | TEXT | `threads` / `instagram` |
| measured_at | TEXT | |
| views | INTEGER | |
| likes | INTEGER | |
| replies | INTEGER NULL | Threads |
| reposts | INTEGER NULL | Threads |
| quotes | INTEGER NULL | Threads |
| shares | INTEGER NULL | |
| saves | INTEGER NULL | Instagram |
| reach | INTEGER NULL | Instagram |
PK(post_id, platform, measured_at)。

## purchases（手入力）
| 列 | 型 | 説明 |
| --- | --- | --- |
| id | TEXT PK | |
| date | TEXT | |
| product | TEXT | |
| count | INTEGER | note の売上画面から人が転記 |
| variant | TEXT NULL | A/B 別の案内URLから分かる場合 |
