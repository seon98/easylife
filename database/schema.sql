CREATE TABLE IF NOT EXISTS programs (
  source_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  period TEXT,
  ministry TEXT,
  organization TEXT,
  published_at DATE,
  region TEXT,
  status TEXT,
  official_url TEXT NOT NULL,
  summary TEXT DEFAULT '',
  target TEXT DEFAULT '',
  benefit TEXT DEFAULT '',
  application_method TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  documents JSONB NOT NULL DEFAULT '[]',
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL,
  detail_collected_at TIMESTAMPTZ,
  content_hash TEXT DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'PENDING',
  raw_source_url TEXT NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(target,'') || ' ' || coalesce(ministry,'') || ' ' || coalesce(organization,''))
  ) STORED
);
CREATE INDEX IF NOT EXISTS programs_search_idx ON programs USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS programs_filter_idx ON programs(region, category, status);
CREATE TABLE IF NOT EXISTS program_versions (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES programs(source_id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL,
  UNIQUE(source_id, content_hash)
);
