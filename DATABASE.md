# Database

## On the phone (SQLite, `apps/mobile/src/database/schema.ts`)
v1: `user_profile, allergies, restrictions, products (global cache + custom:* products), custom_products, scan_history, score_results, favorites, meals, meal_entries, hydration_entries, daily_goals, conversations, chat_messages, sync_queue (legacy, unused)`.
v2 (sync): `sync_meta` (cursor, device id), `sync_outbox` (what changed), and AFTER INSERT/UPDATE/DELETE **triggers** that record changes. The engine reads the row's current state when pushing, so many offline edits collapse into one update.

Synced collections: `profile, custom_products, favorites (with product snapshot), conversations, chat_messages, meal_entries, hydration_entries`. Not synced: the Open Food Facts product cache, scan history, score cache (re-derivable).

## In the cloud (Cloudflare D1, `apps/worker/migrations/0001_init.sql`)
`users(id, key_hash, created_at, sync_seq, record_count)` → `sessions(token_hash, user_id, expires_at)` and `sync_records(user_id, collection, record_id, data JSON, deleted, updated_at, seq, device_id)` (PK `user_id, collection, record_id`; cascade delete) plus `rate_limits(key hash, window_start, count)`.
Design note: records are stored document-style (one JSON per record) rather than fully normalised, so adding a synced field never needs a cloud migration and a sync costs few D1 rows. Only hashes of account keys, session tokens and IPs are stored.

## Sync rules
- **Last write wins by timestamp**, decided atomically inside one D1 batch. Server clamps timestamps more than 5 min in the future.
- A rejected (older) edit is **not silent**: the server returns the winning version, the device adopts it and the app shows "N edits lost to a newer change".
- Deletes are tombstones, and a newer edit beats an older delete (and vice versa).
- A device keeps a local edit that is newer than an incoming remote one and pushes it next sync.
- Updates are idempotent; re-sending a change cannot duplicate it. Each device skips its own writes on pull.
- "Delete all local data" does **not** delete the cloud copy; it resets the link so the next sync restores it. Deleting the account removes the cloud copy.
