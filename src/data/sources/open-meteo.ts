import { requireValue, SadyError } from '../errors';
import type { ClimateImport, Orchard } from '../types';
import { coordinates, isoDate } from '../validation';
import type { SourceAdapter } from './adapter';
import { getJson } from './http';

export interface ArchiveQuery {
  orchard: Pick<Orchard, 'id' | 'longitude' | 'latitude'>;
  startDate: string;
  endDate: string;
  signal?: AbortSignal;
}

export function archiveUrl(query: ArchiveQuery): string {
  coordinates(query.orchard.longitude, query.orchard.latitude);
  isoDate(query.startDate); isoDate(query.endDate);
  const days = (Date.parse(query.endDate) - Date.parse(query.startDate)) / 86_400_000 + 1;
  requireValue(days >= 1 && days <= 3660, 'Request an ordered date range of at most 3660 days.');
  const params = new URLSearchParams({
    latitude: String(query.orchard.latitude), longitude: String(query.orchard.longitude),
    start_date: query.startDate, end_date: query.endDate,
    daily: 'temperature_2m_min,precipitation_sum', models: 'era5_land', timezone: 'Europe/Prague',
    temperature_unit: 'celsius', precipitation_unit: 'mm',
  });
  return `https://archive-api.open-meteo.com/v1/archive?${params}`;
}

export function normalizeArchive(payload: unknown, query: ArchiveQuery): ClimateImport {
  const sourceUrl = archiveUrl(query);
  const fail = (condition: unknown, message: string): void => {
    if (!condition) throw new SadyError('SOURCE_ERROR', message);
  };
  fail(payload !== null && typeof payload === 'object', 'Expected a weather response object.');
  const data = payload as Record<string, unknown>;
  fail(!data.error, typeof data.reason === 'string' ? data.reason : 'Weather source returned an error.');
  fail(data.timezone === 'Europe/Prague', 'Weather response has an unexpected timezone.');
  fail(typeof data.longitude === 'number' && typeof data.latitude === 'number', 'Weather grid location is missing.');
  coordinates(data.longitude as number, data.latitude as number);
  const units = data.daily_units as Record<string, unknown> | undefined;
  fail(units?.temperature_2m_min === '°C' && units?.precipitation_sum === 'mm' && units?.time === 'iso8601',
    'Weather response units are not ISO dates, °C and mm.');
  const daily = data.daily as Record<string, unknown> | undefined;
  fail(daily !== null && typeof daily === 'object', 'Daily weather data is missing.');
  const dates = daily!.time;
  const temperatures = daily!.temperature_2m_min;
  const precipitation = daily!.precipitation_sum;
  fail(Array.isArray(dates) && Array.isArray(temperatures) && Array.isArray(precipitation), 'Daily weather columns are missing.');
  const dateList = dates as unknown[], temperatureList = temperatures as unknown[], precipitationList = precipitation as unknown[];
  const expected = (Date.parse(query.endDate) - Date.parse(query.startDate)) / 86_400_000 + 1;
  fail(dateList.length === expected && temperatureList.length === expected && precipitationList.length === expected,
    'Daily weather columns do not match the requested date range.');
  const days = dateList.map((date, index) => {
    const expectedDate = new Date(Date.parse(query.startDate) + index * 86_400_000).toISOString().slice(0, 10);
    fail(date === expectedDate, 'Weather dates must match the requested consecutive local days.');
    const temperature = temperatureList[index], rain = precipitationList[index];
    fail(temperature === null || (typeof temperature === 'number' && Number.isFinite(temperature)), 'Invalid minimum temperature.');
    fail(rain === null || (typeof rain === 'number' && Number.isFinite(rain) && rain >= 0), 'Invalid precipitation.');
    return { date: expectedDate, minimumTemperatureC: temperature as number | null, precipitationMm: rain as number | null };
  });
  return {
    orchardId: query.orchard.id, sourceId: 'open-meteo-archive',
    scopeKey: `era5_land:${query.orchard.longitude},${query.orchard.latitude}:${query.startDate}:${query.endDate}`,
    sourceUrl, attribution: 'Weather data by Open-Meteo.com; ERA5-Land reanalysis by Copernicus/ECMWF.',
    license: 'CC BY 4.0; https://open-meteo.com/en/terms', sourceVersion: 'era5_land',
    longitude: data.longitude as number, latitude: data.latitude as number,
    model: 'era5_land', timezone: 'Europe/Prague', days,
  };
}

export const openMeteoArchive: SourceAdapter<ArchiveQuery, ClimateImport> = {
  sourceId: 'open-meteo-archive',
  async load(query) { return normalizeArchive(await getJson(archiveUrl(query), query.signal), query); },
};
