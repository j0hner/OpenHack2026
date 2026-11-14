import type { BindingSpec, Database } from '@sqlite.org/sqlite-wasm';
import { requireValue, SadyError } from '../errors';
import type {
  ClimateImport, ClimateSeries, FeatureQuery, GeoJsonImport, ImportReceipt,
  Orchard, OrchardInput, Provenance, StoredFeature,
} from '../types';
import * as validate from '../validation';

const orchardColumns = 'id, name, longitude, latitude, notes, created_at AS createdAt, updated_at AS updatedAt';
const importColumns = `id, source_id AS sourceId, scope_key AS scopeKey, source_url AS sourceUrl,
  attribution, license, source_version AS sourceVersion, imported_at AS importedAt, record_count AS recordCount, kind`;

/** Synchronous and worker-private. All externally supplied SQL values are bound. */
export class Store {
  constructor(private readonly db: Database) {}

  private rows<T>(sql: string, bind: BindingSpec = []): T[] {
    return this.db.selectObjects(sql, bind) as T[];
  }
  private write(sql: string, bind: BindingSpec): void { this.db.exec(sql, { bind }); }

  listOrchards(): Orchard[] { return this.rows(`SELECT ${orchardColumns} FROM orchards ORDER BY created_at, id`); }

  getOrchard(id: string): Orchard | null {
    return this.rows<Orchard>(`SELECT ${orchardColumns} FROM orchards WHERE id = ?`, [id])[0] ?? null;
  }

  saveOrchard(input: { id?: string; orchard: OrchardInput }): Orchard {
    validate.orchardInput(input.orchard);
    if (input.id !== undefined) {
      validate.text(input.id, 'Orchard ID', 100);
      if (!this.db.selectValue('SELECT 1 FROM orchards WHERE id = ?', [input.id])) {
        throw new SadyError('NOT_FOUND', 'Orchard does not exist.');
      }
    }
    const id = input.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const { name, longitude, latitude, notes = '' } = input.orchard;
    this.write(`INSERT INTO orchards VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, longitude=excluded.longitude,
        latitude=excluded.latitude, notes=excluded.notes, updated_at=excluded.updated_at`,
    [id, name.trim(), longitude, latitude, notes, now, now]);
    return this.rows<Orchard>(`SELECT ${orchardColumns} FROM orchards WHERE id = ?`, [id])[0]!;
  }

  deleteOrchard(id: string): boolean {
    this.write('DELETE FROM orchards WHERE id = ?', [id]);
    return this.db.changes() > 0;
  }

  listImports(): ImportReceipt[] {
    return this.rows(`SELECT ${importColumns} FROM imports ORDER BY imported_at DESC, id`);
  }
  deleteImport(id: string): boolean {
    this.write('DELETE FROM imports WHERE id = ?', [id]);
    return this.db.changes() > 0;
  }

  private receipt(input: Provenance & { scopeKey: string }, count: number,
    kind: ImportReceipt['kind'], orchardId: string | null = null): ImportReceipt {
    validate.provenance(input);
    validate.text(input.scopeKey, 'Scope key', 500);
    // Called only in a transaction: the old snapshot survives any failed replacement.
    this.write('DELETE FROM imports WHERE source_id = ? AND kind = ? AND scope_key = ? AND owner_key = ?',
      [input.sourceId, kind, input.scopeKey, orchardId ?? '']);
    const receipt: ImportReceipt = {
      id: crypto.randomUUID(), sourceId: input.sourceId, scopeKey: input.scopeKey,
      sourceUrl: input.sourceUrl, attribution: input.attribution, license: input.license,
      sourceVersion: input.sourceVersion ?? null, importedAt: new Date().toISOString(),
      recordCount: count, kind,
    };
    this.write(`INSERT INTO imports
      (id, source_id, scope_key, owner_key, orchard_id, kind, source_url, attribution, license, source_version, imported_at, record_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [receipt.id, receipt.sourceId, receipt.scopeKey, orchardId ?? '', orchardId, kind,
      receipt.sourceUrl, receipt.attribution, receipt.license, receipt.sourceVersion, receipt.importedAt, count]);
    return receipt;
  }

  importFeatures(input: GeoJsonImport): ImportReceipt {
    requireValue(new TextEncoder().encode(JSON.stringify(input)).length <= validate.MAX_IMPORT_BYTES,
      'Import exceeds the 10 MiB limit. Split it into bounded snapshots.');
    requireValue(input.collection?.type === 'FeatureCollection' && Array.isArray(input.collection.features),
      'Expected a GeoJSON FeatureCollection.');
    requireValue(!('crs' in input.collection), 'Legacy GeoJSON CRS is unsupported; transform to EPSG:4326 first.');
    requireValue(input.collection.features.length <= validate.MAX_FEATURES, 'Import exceeds the 10000 feature limit.');
    if (input.idProperty !== undefined) validate.text(input.idProperty, 'ID property', 200);
    return this.db.transaction('IMMEDIATE', () => {
      const receipt = this.receipt(input, input.collection.features.length, 'features');
      const ids = new Set<string>();
      for (const feature of input.collection.features) {
        requireValue(feature?.type === 'Feature', 'Expected a GeoJSON Feature.');
        requireValue(feature.properties === null || (typeof feature.properties === 'object' && !Array.isArray(feature.properties)),
          'Feature properties must be an object or null.');
        const rawId = input.idProperty === undefined ? feature.id : feature.properties?.[input.idProperty];
        requireValue(typeof rawId === 'string' || (typeof rawId === 'number' && Number.isSafeInteger(rawId)),
          'Each feature needs a stable string/integer ID. Supply idProperty for provider property IDs.');
        const externalId = String(rawId);
        validate.text(externalId, 'Feature ID', 200);
        requireValue(!ids.has(externalId), `Duplicate feature ID: ${externalId}.`);
        ids.add(externalId);
        requireValue(!('crs' in feature), 'Transform legacy GeoJSON to EPSG:4326 first.');
        requireValue(feature.geometry !== null, 'Null geometry is unsupported.');
        const bounds = validate.geometryBounds(feature.geometry);
        this.write('INSERT INTO features VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [crypto.randomUUID(), receipt.id, input.sourceId, externalId,
            JSON.stringify(feature.geometry), JSON.stringify(feature.properties), ...bounds]);
      }
      return receipt;
    });
  }

  queryFeatures(query: FeatureQuery): StoredFeature[] {
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    requireValue(Number.isInteger(limit) && limit >= 1 && limit <= 1000, 'Limit must be an integer between 1 and 1000.');
    requireValue(Number.isSafeInteger(offset) && offset >= 0, 'Offset must be a nonnegative integer.');
    const conditions: string[] = [];
    const bind: (string | number)[] = [];
    if (query.sourceId !== undefined) { conditions.push('source_id = ?'); bind.push(query.sourceId); }
    if (query.importId !== undefined) { conditions.push('import_id = ?'); bind.push(query.importId); }
    if (query.bbox !== undefined) {
      validate.bbox(query.bbox);
      conditions.push('west <= ? AND east >= ? AND south <= ? AND north >= ?');
      bind.push(query.bbox[2], query.bbox[0], query.bbox[3], query.bbox[1]);
    }
    type FeatureRow = Omit<StoredFeature, 'geometry' | 'properties' | 'bbox'> & {
      geometryJson: string; propertiesJson: string; west: number; south: number; east: number; north: number;
    };
    return this.rows<FeatureRow>(`SELECT id, import_id AS importId, external_id AS externalId, source_id AS sourceId,
      geometry_json AS geometryJson, properties_json AS propertiesJson, west, south, east, north FROM features
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY source_id, external_id, id LIMIT ? OFFSET ?`,
    [...bind, limit, offset]).map(({ geometryJson, propertiesJson, west, south, east, north, ...row }) => ({
      ...row, geometry: JSON.parse(geometryJson), properties: JSON.parse(propertiesJson), bbox: [west, south, east, north],
    }));
  }

  importClimate(input: ClimateImport): ImportReceipt {
    validate.coordinates(input.longitude, input.latitude);
    validate.text(input.model, 'Climate model', 100);
    requireValue(input.timezone === 'Europe/Prague', 'Climate data must use Europe/Prague local dates.');
    requireValue(Array.isArray(input.days) && input.days.length > 0 && input.days.length <= 3660,
      'Import between 1 and 3660 climate days at a time.');
    requireValue(Boolean(this.db.selectValue('SELECT 1 FROM orchards WHERE id = ?', [input.orchardId])), 'Orchard does not exist.');
    const dates = new Set<string>();
    for (const day of input.days) {
      validate.isoDate(day.date);
      requireValue(!dates.has(day.date), 'Climate dates must be unique.');
      dates.add(day.date);
      requireValue(day.minimumTemperatureC === null || Number.isFinite(day.minimumTemperatureC), 'Temperature must be finite or null.');
      requireValue(day.precipitationMm === null || (Number.isFinite(day.precipitationMm) && day.precipitationMm >= 0),
        'Precipitation must be nonnegative or null.');
    }
    return this.db.transaction('IMMEDIATE', () => {
      const receipt = this.receipt(input, input.days.length, 'climate', input.orchardId);
      this.write('INSERT INTO climate_series VALUES (?, ?, ?, ?, ?)',
        [receipt.id, input.longitude, input.latitude, input.model, input.timezone]);
      for (const day of input.days) {
        this.write('INSERT INTO climate_days VALUES (?, ?, ?, ?)',
          [receipt.id, day.date, day.minimumTemperatureC, day.precipitationMm]);
      }
      return receipt;
    });
  }

  listClimate(orchardId: string): ClimateSeries[] {
    return this.rows<ImportReceipt>(`SELECT ${importColumns} FROM imports WHERE orchard_id = ? ORDER BY imported_at, id`,
      [orchardId]).map(receipt => ({
      import: receipt,
      ...this.rows<Omit<ClimateSeries, 'import' | 'days'>>('SELECT longitude, latitude, model, timezone FROM climate_series WHERE import_id = ?', [receipt.id])[0]!,
      days: this.rows('SELECT date, minimum_temperature_c AS minimumTemperatureC, precipitation_mm AS precipitationMm FROM climate_days WHERE import_id = ? ORDER BY date', [receipt.id]),
    }));
  }
}
