-- NutriScan API schema v1.
-- Accounts are keyed by a high-entropy account key; only its SHA-256 is stored.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  sync_seq INTEGER NOT NULL DEFAULT 0,
  record_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- One row per synced record (document-style store; see DATABASE.md).
CREATE TABLE sync_records (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  data TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  seq INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  PRIMARY KEY (user_id, collection, record_id)
);
CREATE INDEX idx_sync_user_seq ON sync_records(user_id, seq);

-- Fixed-window rate limiting. Keys are hashed; no raw IPs are stored.
CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
