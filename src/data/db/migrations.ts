import type { Database } from '@sqlite.org/sqlite-wasm';
import { SadyError } from '../errors';

/** Append migrations; never edit a migration after databases have shipped. */
export const migrations = [{
  version: 1,
  sql: `
    CREATE TABLE orchards (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
      longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
      latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE imports (
      id TEXT PRIMARY KEY NOT NULL,
      source_id TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      owner_key TEXT NOT NULL DEFAULT '',
      orchard_id TEXT REFERENCES orchards(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('features','climate')),
      source_url TEXT NOT NULL,
      attribution TEXT NOT NULL,
      license TEXT NOT NULL,
      source_version TEXT,
      imported_at TEXT NOT NULL,
      record_count INTEGER NOT NULL CHECK(record_count >= 0),
      UNIQUE(source_id, kind, scope_key, owner_key)
    ) STRICT;
    CREATE TABLE features (
      id TEXT PRIMARY KEY NOT NULL,
      import_id TEXT NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL,
      external_id TEXT NOT NULL,
      geometry_json TEXT NOT NULL CHECK(json_valid(geometry_json)),
      properties_json TEXT NOT NULL CHECK(json_valid(properties_json)),
      west REAL NOT NULL, south REAL NOT NULL, east REAL NOT NULL, north REAL NOT NULL,
      UNIQUE(import_id, external_id)
    ) STRICT;
    CREATE INDEX features_source_bounds ON features(source_id, west, east, south, north);
    CREATE INDEX features_bounds ON features(west, east, south, north);
    CREATE INDEX features_import ON features(import_id);
    CREATE INDEX imports_orchard ON imports(orchard_id);
    CREATE TABLE climate_series (
      import_id TEXT PRIMARY KEY NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
      longitude REAL NOT NULL,
      latitude REAL NOT NULL,
      model TEXT NOT NULL,
      timezone TEXT NOT NULL
    ) STRICT;
    CREATE TABLE climate_days (
      import_id TEXT NOT NULL REFERENCES climate_series(import_id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      minimum_temperature_c REAL,
      precipitation_mm REAL CHECK(precipitation_mm IS NULL OR precipitation_mm >= 0),
      PRIMARY KEY(import_id, date)
    ) STRICT;
  `,
}];

export function migrate(db: Database): number {
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL; PRAGMA temp_store = MEMORY;');
  const current = Number(db.selectValue('PRAGMA user_version'));
  const latest = migrations.at(-1)!.version;
  if (current > latest) throw new SadyError('DATABASE_ERROR', 'This database was created by a newer app. Update the app before opening it.');
  db.transaction('IMMEDIATE', () => {
    for (const migration of migrations) {
      if (migration.version <= current) continue;
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version}`);
    }
  });
  return latest;
}
