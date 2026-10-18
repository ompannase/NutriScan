export const migrations = [
  `PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS user_profile (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS allergies (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
  CREATE TABLE IF NOT EXISTS restrictions (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
  CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, barcode TEXT UNIQUE, data TEXT NOT NULL, retrieved_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
  CREATE TABLE IF NOT EXISTS custom_products (id TEXT PRIMARY KEY, barcode TEXT UNIQUE, data TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS scan_history (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT NOT NULL, scanned_at TEXT NOT NULL, FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE);
  CREATE INDEX IF NOT EXISTS idx_scans_date ON scan_history(scanned_at DESC);
  CREATE TABLE IF NOT EXISTS score_results (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT NOT NULL, version TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS favorites (product_id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS meals (id TEXT PRIMARY KEY, local_date TEXT NOT NULL, meal_type TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(local_date);
  CREATE TABLE IF NOT EXISTS meal_entries (id TEXT PRIMARY KEY, meal_id TEXT NOT NULL, product_id TEXT, data TEXT NOT NULL, UNIQUE(meal_id,id), FOREIGN KEY(meal_id) REFERENCES meals(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS hydration_entries (id TEXT PRIMARY KEY, local_date TEXT NOT NULL, amount_ml INTEGER NOT NULL, created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_hydration_date ON hydration_entries(local_date);
  CREATE TABLE IF NOT EXISTS daily_goals (local_date TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS sync_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, operation TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
  PRAGMA user_version = 1;`,
  // v2: change tracking for optional cloud sync. Triggers record WHAT changed; the
  // sync engine reads the current row when pushing, so edits made while offline
  // collapse into one update per record.
  `CREATE TABLE IF NOT EXISTS sync_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
  INSERT OR IGNORE INTO sync_meta(k,v) VALUES('cursor','0'),('seeded','0');
  CREATE TABLE IF NOT EXISTS sync_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, collection TEXT NOT NULL, record_id TEXT NOT NULL, changed_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_outbox_record ON sync_outbox(collection, record_id);

  CREATE TRIGGER IF NOT EXISTS trg_sync_profile_ins AFTER INSERT ON user_profile BEGIN
    INSERT INTO sync_outbox(collection,record_id,changed_at) VALUES('profile','profile',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  END;
  CREATE TRIGGER IF NOT EXISTS trg_sync_fav_ins AFTER INSERT ON favorites BEGIN
    INSERT INTO sync_outbox(collection,record_id,changed_at) VALUES('favorites',NEW.product_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  END;
  CREATE TRIGGER IF NOT EXISTS trg_sync_fav_del AFTER DELETE ON favorites BEGIN
    INSERT INTO sync_outbox(collection,record_id,changed_at) VALUES('favorites',OLD.product_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  END;
  CREATE TRIGGER IF NOT EXISTS trg_sync_custom_ins AFTER INSERT ON products WHEN NEW.id LIKE 'custom:%' BEGIN
    INSERT INTO sync_outbox(collection,record_id,changed_at) VALUES('custom_products',NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  END;
  CREATE TRIGGER IF NOT EXISTS trg_sync_custom_del AFTER DELETE ON products WHEN OLD.id LIKE 'custom:%' BEGIN
    INSERT INTO sync_outbox(collection,record_id,changed_at) VALUES('custom_products',OLD.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  END;
  CREATE TRIGGER IF NOT EXISTS trg_sync_conv_ins AFTER INSERT ON conversations BEGIN
    INSERT INTO sync_outbox(collection,record_id,changed_at) VALUES('conversations',NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  END;
  CREATE TRIGGER IF NOT EXISTS trg_sync_conv_upd AFTER UPDATE OF title ON conversations BEGIN
    INSERT INTO sync_outbox(collection,record_id,changed_at) VALUES('conversations',NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  END;
  CREATE TRIGGER IF NOT EXISTS trg_sync_conv_del BEFORE DELETE ON conversations BEGIN
    DELETE FROM chat_messages WHERE conversation_id = OLD.id;
    INSERT INTO sync_outbox(collection,record_id,changed_at) VALUES('conversations',OLD.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  END;
  CREATE TRIGGER IF NOT EXISTS trg_sync_msg_ins AFTER INSERT ON chat_messages BEGIN
    INSERT INTO sync_outbox(collection,record_id,changed_at) VALUES('chat_messages',NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  END;
  CREATE TRIGGER IF NOT EXISTS trg_sync_msg_del AFTER DELETE ON chat_messages BEGIN
    INSERT INTO sync_outbox(collection,record_id,changed_at) VALUES('chat_messages',OLD.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  END;
  CREATE TRIGGER IF NOT EXISTS trg_sync_entry_ins AFTER INSERT ON meal_entries BEGIN
    INSERT INTO sync_outbox(collection,record_id,changed_at) VALUES('meal_entries',NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  END;
  CREATE TRIGGER IF NOT EXISTS trg_sync_entry_del AFTER DELETE ON meal_entries BEGIN
    INSERT INTO sync_outbox(collection,record_id,changed_at) VALUES('meal_entries',OLD.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  END;
  CREATE TRIGGER IF NOT EXISTS trg_sync_water_ins AFTER INSERT ON hydration_entries BEGIN
    INSERT INTO sync_outbox(collection,record_id,changed_at) VALUES('hydration_entries',NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  END;
  CREATE TRIGGER IF NOT EXISTS trg_sync_water_del AFTER DELETE ON hydration_entries BEGIN
    INSERT INTO sync_outbox(collection,record_id,changed_at) VALUES('hydration_entries',OLD.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  END;
  PRAGMA user_version = 2;`,
] as const;
