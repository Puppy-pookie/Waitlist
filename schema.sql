CREATE TABLE IF NOT EXISTS waitlist_entries (
  id              BIGSERIAL PRIMARY KEY,
  school_name     TEXT NOT NULL,
  email_encrypted TEXT NOT NULL,        -- AES-256-GCM ciphertext, "iv:authTag:ciphertext" hex
  email_lookup_hash TEXT NOT NULL UNIQUE, -- HMAC-SHA256 of the lowercased email, for dedup only
  school_type     TEXT NOT NULL CHECK (school_type IN ('independent', 'state', 'international')),
  country         TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'manual', -- 'google' or 'manual'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist_entries (created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_country ON waitlist_entries (country);
