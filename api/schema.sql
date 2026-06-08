CREATE TABLE IF NOT EXISTS visits (
  ts INTEGER NOT NULL, day TEXT NOT NULL, ip_hash TEXT NOT NULL, country TEXT, path TEXT
);
CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day);
