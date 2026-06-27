CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  city_name TEXT NOT NULL,
  venue_name TEXT,
  category_name TEXT,
  show_time_text TEXT,
  sale_start_time TIMESTAMPTZ,
  status TEXT NOT NULL,
  price_text TEXT,
  min_price NUMERIC(10,2),
  max_price NUMERIC(10,2),
  official_url TEXT NOT NULL,
  is_selectable_seat BOOLEAN,
  raw_payload_hash TEXT NOT NULL,
  raw_payload JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS event_snapshots (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT,
  price_text TEXT,
  sale_start_time TIMESTAMPTZ,
  raw_payload_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watch_rules (
  id TEXT PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  name TEXT NOT NULL,
  city_name TEXT NOT NULL DEFAULT '成都',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  artists TEXT[] NOT NULL DEFAULT '{}',
  venues TEXT[] NOT NULL DEFAULT '{}',
  categories TEXT[] NOT NULL DEFAULT '{}',
  min_price NUMERIC(10,2),
  max_price NUMERIC(10,2),
  notify_offsets_seconds INT[] NOT NULL DEFAULT ARRAY[86400,1800,600,60,10],
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_channels (
  id TEXT PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  channel_type TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  endpoint_encrypted BYTEA,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_jobs (
  id TEXT PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  event_id TEXT NOT NULL REFERENCES events(id),
  watch_rule_id TEXT REFERENCES watch_rules(id),
  channel_type TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  priority INT NOT NULL DEFAULT 5,
  dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_sessions (
  id TEXT PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  event_id TEXT NOT NULL REFERENCES events(id),
  opened_official_at TIMESTAMPTZ,
  user_confirmed_ready_at TIMESTAMPTZ,
  purchase_result TEXT,
  failure_reason_code TEXT,
  failure_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_city_sale_time ON events(city_name, sale_start_time);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_due ON notification_jobs(status, scheduled_for);
