-- Dreams, scoped by anonymous device id until accounts exist.
CREATE TABLE dreams (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  text TEXT NOT NULL,
  mood TEXT,
  concern TEXT,
  lens TEXT NOT NULL,
  interpretation_json TEXT,
  notices_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_dreams_device_created ON dreams (device_id, created_at DESC);

-- One row per symbol per dream: powers the symbol map and recurring-dream detection.
CREATE TABLE dream_symbols (
  dream_id TEXT NOT NULL REFERENCES dreams (id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  PRIMARY KEY (dream_id, symbol)
);

CREATE INDEX idx_dream_symbols_device ON dream_symbols (device_id, symbol);
