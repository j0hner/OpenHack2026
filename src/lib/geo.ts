import { area as turfArea } from '@turf/area';
import { bbox as turfBbox } from '@turf/bbox';
import { feature as turfFeature } from '@turf/helpers';
import { length as turfLength } from '@turf/length';
import { union as turfUnion } from '@turf/union';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { AreaGeometry } from './types';

export type Bbox = [number, number, number, number];

export const toFeature = (geometry: AreaGeometry): Feature<Polygon | MultiPolygon> =>
  turfFeature(geometry as Polygon | MultiPolygon);

export const areaHa = (geometry: AreaGeometry): number => turfArea(toFeature(geometry)) / 10_000;

export const perimeterM = (geometry: AreaGeometry): number =>
  turfLength(toFeature(geometry), { units: 'kilometers' }) * 1000;

export const bboxOf = (geometry: AreaGeometry): Bbox => turfBbox(toFeature(geometry)) as Bbox;

export const centerOf = (geometry: AreaGeometry): [number, number] => {
  const [w, s, e, n] = bboxOf(geometry);
  return [(w + e) / 2, (s + n) / 2];
};

const unionFeatures = (a: Feature<Polygon | MultiPolygon>, b: Feature<Polygon | MultiPolygon>) =>
  turfUnion({type:'FeatureCollection',features:[a,b]});

/**
 * Společná výměra bez dvojího započtení překryvů.
 * Sjednotí všechny vybrané polygony a změří výsledek.
 */
export function unionAreaHa(geometries: AreaGeometry[]): number {
  if (geometries.length === 0) return 0;
  if (geometries.length === 1) return areaHa(geometries[0]);
  try {
    const features = geometries.map(toFeature) as Feature<Polygon | MultiPolygon>[];
    let merged: Feature<Polygon | MultiPolygon> = features[0];
    for (let i = 1; i < features.length; i += 1) {
      const next = unionFeatures(merged, features[i]);
      if (next) merged = next;
    }
    return turfArea(merged) / 10_000;
  } catch {
    // Když geometrie nejdou sjednotit, vrať alespoň součet (UI to označí).
    return geometries.reduce((sum, geometry) => sum + areaHa(geometry), 0);
  }
}

export const sumAreaHa = (geometries: AreaGeometry[]): number =>
  geometries.reduce((sum, geometry) => sum + areaHa(geometry), 0);

export const formatLatLon = ([lon, lat]: [number, number]): string =>
  `${lat.toFixed(5)}° s. š., ${lon.toFixed(5)}° v. d.`;
