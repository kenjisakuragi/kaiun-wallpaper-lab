-- 0001_init: docs/05_data_model.md のスキーマ（2026-10-04 時点）
-- 日時は ISO8601（UTCオフセット付き）文字列、ID は ULID。
-- 列挙値（kind / status など）は CHECK 制約にせず、packages/db/src/schema.ts の定義でアプリ側が検証する
-- （SQLite は CHECK の変更にテーブル再作成が必要なため）。

CREATE TABLE images (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,              -- birthday / common / kaiunbi / affirmation
  key TEXT NOT NULL,               -- birthday: MM-DD, kaiunbi: YYYY-MM-DD, common: v1, affirmation: a001
  version INTEGER NOT NULL DEFAULT 1,
  prompt_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  quality TEXT NOT NULL,
  r2_url_full TEXT,
  r2_url_preview TEXT,
  cost_usd REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'generated', -- generated / approved / rejected
  created_at TEXT NOT NULL,
  UNIQUE (kind, key, version)
);
CREATE INDEX idx_images_kind_key_status ON images (kind, key, status);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  scheduled_date TEXT NOT NULL,    -- YYYY-MM-DD
  slot INTEGER NOT NULL DEFAULT 1,
  theme TEXT NOT NULL,             -- birthday / kaiunbi / affirmation
  image_id TEXT REFERENCES images (id),
  video_url TEXT,
  text_threads TEXT,
  caption_instagram TEXT,
  threads_status TEXT NOT NULL DEFAULT 'planned', -- planned / container_created / published / failed / skipped
  threads_container_id TEXT,
  threads_media_id TEXT,
  threads_error TEXT,              -- 媒体別（docs/09 #14）
  threads_retry_count INTEGER NOT NULL DEFAULT 0,
  ig_status TEXT NOT NULL DEFAULT 'planned',
  ig_container_id TEXT,
  ig_media_id TEXT,
  ig_error TEXT,
  ig_retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (scheduled_date, slot)
);

CREATE TABLE threads_replies (
  id TEXT PRIMARY KEY,
  post_id TEXT REFERENCES posts (id),
  inbound_reply_id TEXT NOT NULL UNIQUE, -- 二重返信防止
  author_hash TEXT NOT NULL,
  parsed_ok INTEGER NOT NULL,
  reply_text TEXT,                 -- 月日の数字は含めない（docs/09 #13 で扱いを見直し予定）
  status TEXT NOT NULL,            -- pending / sent / rejected / capped / skipped / failed
  outbound_reply_id TEXT,
  received_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX idx_threads_replies_status ON threads_replies (status);
CREATE INDEX idx_threads_replies_received_at ON threads_replies (received_at);
CREATE INDEX idx_threads_replies_sent_at ON threads_replies (sent_at);

CREATE TABLE link_clicks (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,          -- threads / instagram
  clicked_at TEXT NOT NULL,
  ua_class TEXT NOT NULL           -- ios / android / desktop / other
);
CREATE INDEX idx_link_clicks_clicked_at ON link_clicks (clicked_at);

CREATE TABLE users (
  user_hash TEXT PRIMARY KEY,      -- sha256(userId + USER_HASH_SALT)
  user_id_enc TEXT NOT NULL,
  variant TEXT NOT NULL,           -- A / B
  birthday_md TEXT,                -- MM-DD（生年は持たない）
  followed_at TEXT NOT NULL,
  birthday_set_at TEXT,
  blocked_at TEXT,
  refollowed_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_users_followed_at ON users (followed_at);
CREATE INDEX idx_users_blocked_at ON users (blocked_at);

CREATE TABLE deliveries (
  id TEXT PRIMARY KEY,
  user_hash TEXT NOT NULL REFERENCES users (user_hash),
  type TEXT NOT NULL,              -- birthday_reply / common_reply / daily_word_reply / weekly_push / pack_offer
  image_id TEXT REFERENCES images (id),
  sent_at TEXT NOT NULL,
  counted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_deliveries_sent_at ON deliveries (sent_at);
CREATE INDEX idx_deliveries_user_hash ON deliveries (user_hash);

CREATE TABLE inbound_messages (
  id TEXT PRIMARY KEY,
  user_hash TEXT NOT NULL,
  parsed_ok INTEGER NOT NULL,
  received_at TEXT NOT NULL        -- 本文は保存しない
);
CREATE INDEX idx_inbound_messages_user_received ON inbound_messages (user_hash, received_at);

CREATE TABLE post_metrics (
  post_id TEXT NOT NULL REFERENCES posts (id),
  platform TEXT NOT NULL,          -- threads / instagram
  measured_at TEXT NOT NULL,
  views INTEGER,
  likes INTEGER,
  replies INTEGER,
  reposts INTEGER,
  quotes INTEGER,
  shares INTEGER,
  saves INTEGER,
  reach INTEGER,
  PRIMARY KEY (post_id, platform, measured_at)
);

CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  product TEXT NOT NULL,
  count INTEGER NOT NULL,
  variant TEXT
);
