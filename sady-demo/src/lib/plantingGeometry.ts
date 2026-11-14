import type { AreaGeometry } from "./types";

export const PLANTING_GEOMETRY_VERSION = "planting-1";
export type PlantingPoint = [number, number];
export interface PlantingGeometrySettings {
  rowSpacingM: number;
  treeSpacingM: number;
  edgeClearanceM: number;
  headlandM: number;
  orientation: "auto" | "manual";
  /** Row bearing clockwise from north, modulo 180 degrees. */
  bearingDeg: number;
}
export interface PlantingRow {
  id: string;
  /** A continuously admissible row segment, never a line across a hole. */
  coordinates: [PlantingPoint, PlantingPoint];
  treeCount: number;
}
export interface PlantingLayout {
  status: "ready" | "empty" | "limited" | "error";
  geometryKey: string;
  trees: PlantingPoint[];
  rows: PlantingRow[];
  bearingDeg: number;
  candidateCount: number;
  message: string;
  stats: {
    areaM2: number;
    rowLengthM: number;
    rowCount: number;
    treeCount: number;
  };
}

export const PLANTING_LIMITS = {
  maxAreaM2: 1_000_000,
  maxDiagonalM: 3_000,
  maxVertices: 1_200,
  maxRings: 64,
  maxTrees: 10_000,
  maxOperations: 20_000_000,
} as const;
const EARTH = 6_371_008.8;
const RAD = Math.PI / 180;
const EPS = 1e-7;
// Centimetre margin covers floating-point rounding and local projection scale.
const SAFETY = 0.02;
type Point = PlantingPoint;
type Segment = [Point, Point];
type Interval = [number, number];
type ProjectedPolygon = Point[][];
type Projection = {
  toXY: (point: number[]) => Point;
  toLonLat: (point: Point) => Point;
};
type Candidate = {
  count: number;
  segments: {
    low: number;
    high: number;
    y: number;
    first: number;
    last: number;
  }[];
  bearing: number;
  treePhase: number;
  length: number;
};
class LimitError extends Error {}

/** Distinct from the regional-data cache: changing a shape always changes a plan. */
export function plantingGeometryKey(geometry: AreaGeometry): string {
  const json = JSON.stringify(geometry);
  let first = 2166136261,
    second = 5381;
  for (let i = 0; i < json.length; i++) {
    first = Math.imul(first ^ json.charCodeAt(i), 16777619);
    second = Math.imul(second, 33) ^ json.charCodeAt(i);
  }
  return `${PLANTING_GEOMETRY_VERSION}-${json.length}-${first >>> 0}-${second >>> 0}`;
}

export function normalizePlantingSettings(
  raw: unknown,
): PlantingGeometrySettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const input = raw as Record<string, unknown>;
  for (const field of [
    "rowSpacingM",
    "treeSpacingM",
    "edgeClearanceM",
    "headlandM",
    "bearingDeg",
  ]) {
    if (typeof input[field] !== "number" || !Number.isFinite(input[field]))
      return undefined;
  }
  const settings = input as unknown as PlantingGeometrySettings;
  if (settings.orientation !== "auto" && settings.orientation !== "manual")
    return undefined;
  if (
    settings.rowSpacingM < 0.5 ||
    settings.rowSpacingM > 50 ||
    settings.treeSpacingM < 0.5 ||
    settings.treeSpacingM > 50 ||
    settings.rowSpacingM < settings.treeSpacingM
  )
    return undefined;
  if (
    settings.edgeClearanceM < 0 ||
    settings.edgeClearanceM > 50 ||
    settings.headlandM < 0 ||
    settings.headlandM > 50
  )
    return undefined;
  return {
    rowSpacingM: settings.rowSpacingM,
    treeSpacingM: settings.treeSpacingM,
    edgeClearanceM: settings.edgeClearanceM,
    headlandM: settings.headlandM,
    orientation: settings.orientation,
    bearingDeg: bearing(settings.bearingDeg),
  };
}
const bearing = (value: number) => ((value % 180) + 180) % 180;
const bearingDistance = (value: number) =>
  Math.min(bearing(value), 180 - bearing(value));

/** Local spherical azimuthal-equidistant projection. At a 3 km extent its
 * tangential scale error is below 0.00001%; there is no Web Mercator scale error. */
function localProjection(lon0: number, lat0: number): Projection {
  const longitude = lon0 * RAD,
    latitude = lat0 * RAD;
  const sin0 = Math.sin(latitude),
    cos0 = Math.cos(latitude);
  return {
    toXY(point) {
      const lat = point[1] * RAD,
        delta = point[0] * RAD - longitude;
      const sinLat = Math.sin(lat),
        cosLat = Math.cos(lat);
      const cosine = Math.max(
        -1,
        Math.min(1, sin0 * sinLat + cos0 * cosLat * Math.cos(delta)),
      );
      const angle = Math.acos(cosine),
        scale = angle < 1e-8 ? 1 : angle / Math.sin(angle);
      return [
        EARTH * scale * cosLat * Math.sin(delta),
        EARTH * scale * (cos0 * sinLat - sin0 * cosLat * Math.cos(delta)),
      ];
    },
    toLonLat([x, y]) {
      const radius = Math.hypot(x, y);
      if (radius < EPS) return [lon0, lat0];
      const angle = radius / EARTH,
        sin = Math.sin(angle),
        cos = Math.cos(angle);
      const lat = Math.asin(cos * sin0 + (y * sin * cos0) / radius);
      const lon =
        longitude + Math.atan2(x * sin, radius * cos0 * cos - y * sin0 * sin);
      return [lon / RAD, lat / RAD];
    },
  };
}
function ringArea(ring: Point[]): number {
  let sum = 0;
  for (let i = 1; i < ring.length; i++)
    sum += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
  return Math.abs(sum) / 2;
}
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function pointSegmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy),
    ),
  );
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}
function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
  if (
    Math.max(a[0], b[0]) + EPS < Math.min(c[0], d[0]) ||
    Math.max(c[0], d[0]) + EPS < Math.min(a[0], b[0]) ||
    Math.max(a[1], b[1]) + EPS < Math.min(c[1], d[1]) ||
    Math.max(c[1], d[1]) + EPS < Math.min(a[1], b[1])
  )
    return false;
  const abC = cross(a, b, c),
    abD = cross(a, b, d),
    cdA = cross(c, d, a),
    cdB = cross(c, d, b);
  if (
    ((abC > EPS && abD < -EPS) || (abC < -EPS && abD > EPS)) &&
    ((cdA > EPS && cdB < -EPS) || (cdA < -EPS && cdB > EPS))
  )
    return true;
  return (
    pointSegmentDistance(c, a, b) <= EPS ||
    pointSegmentDistance(d, a, b) <= EPS ||
    pointSegmentDistance(a, c, d) <= EPS ||
    pointSegmentDistance(b, c, d) <= EPS
  );
}
/** -1 outside, 0 on boundary, 1 strictly inside. */
function inRing(point: Point, ring: Point[]): number {
  let inside = false;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1],
      b = ring[i];
    if (pointSegmentDistance(point, a, b) < EPS) return 0;
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside ? 1 : -1;
}
function inPolygon(point: Point, polygon: ProjectedPolygon): boolean {
  return (
    inRing(point, polygon[0]) === 1 &&
    polygon.slice(1).every((hole) => inRing(point, hole) === -1)
  );
}
function validateProjected(
  polygons: ProjectedPolygon[],
  spend: (n: number) => void,
): void {
  for (const polygon of polygons) {
    for (const ring of polygon) {
      if (ringArea(ring) < 0.005)
        throw Error("Hranice obsahuje nulovou nebo příliš malou smyčku.");
      for (let i = 0; i < ring.length - 1; i++)
        for (let j = i + 2; j < ring.length - 1; j++) {
          if (i === 0 && j === ring.length - 2) continue;
          spend(1);
          if (intersects(ring[i], ring[i + 1], ring[j], ring[j + 1]))
            throw Error("Hranice pozemku se protíná sama se sebou.");
        }
    }
    for (let i = 0; i < polygon.length; i++)
      for (let j = i + 1; j < polygon.length; j++) {
        const first = polygon[i],
          second = polygon[j];
        for (let a = 1; a < first.length; a++)
          for (let b = 1; b < second.length; b++) {
            spend(1);
            if (intersects(first[a - 1], first[a], second[b - 1], second[b]))
              throw Error("Otvor se dotýká nebo kříží jinou hranici.");
          }
        if (
          i > 0 &&
          (inRing(first[0], second) === 1 || inRing(second[0], first) === 1)
        )
          throw Error("Otvory pozemku se překrývají.");
      }
    for (const hole of polygon.slice(1))
      if (inRing(hole[0], polygon[0]) !== 1)
        throw Error("Otvor leží mimo vnější hranici pozemku.");
  }
  for (let i = 0; i < polygons.length; i++)
    for (let j = i + 1; j < polygons.length; j++) {
      const first = polygons[i],
        second = polygons[j];
      for (const a of first)
        for (const b of second)
          for (let x = 1; x < a.length; x++)
            for (let y = 1; y < b.length; y++) {
              spend(1);
              if (intersects(a[x - 1], a[x], b[y - 1], b[y]))
                throw Error(
                  "Části multipolygonu se dotýkají nebo překrývají. Nejprve je platně spojte.",
                );
            }
      if (inPolygon(first[0][0], second) || inPolygon(second[0][0], first))
        throw Error("Části multipolygonu se překrývají.");
    }
}
function bounds(points: Point[]): [number, number, number, number] {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
}
function unionIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter(([lo, hi]) => hi - lo > EPS)
    .sort((a, b) => a[0] - b[0]);
  const result: Interval[] = [];
  for (const item of sorted) {
    const previous = result.at(-1);
    if (previous && item[0] <= previous[1] + EPS)
      previous[1] = Math.max(previous[1], item[1]);
    else result.push([...item]);
  }
  return result;
}
function subtractIntervals(
  inside: Interval[],
  forbidden: Interval[],
): Interval[] {
  const result: Interval[] = [];
  for (const [start, end] of inside) {
    let cursor = start;
    for (const [low, high] of forbidden) {
      if (high <= cursor || low >= end) continue;
      if (low > cursor + EPS) result.push([cursor, Math.min(low, end)]);
      cursor = Math.max(cursor, high);
      if (cursor >= end) break;
    }
    if (end - cursor > EPS) result.push([cursor, end]);
  }
  return result;
}
/** Intersection of the line y=constant with a segment's radius-r capsule. */
function capsuleInterval(
  a: Point,
  b: Point,
  y: number,
  radius: number,
): Interval | null {
  if (y < Math.min(a[1], b[1]) - radius || y > Math.max(a[1], b[1]) + radius)
    return null;
  let low = Infinity,
    high = -Infinity;
  for (const p of [a, b]) {
    const delta = y - p[1];
    if (Math.abs(delta) <= radius) {
      const extent = Math.sqrt(Math.max(0, radius * radius - delta * delta));
      low = Math.min(low, p[0] - extent);
      high = Math.max(high, p[0] + extent);
    }
  }
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    lengthSquared = dx * dx + dy * dy;
  let rectLow = -Infinity,
    rectHigh = Infinity;
  if (Math.abs(dy) < EPS) {
    if (Math.abs(y - a[1]) > radius)
      return Number.isFinite(low) ? [low, high] : null;
  } else {
    const middle = a[0] + ((y - a[1]) * dx) / dy,
      spread = (radius * Math.sqrt(lengthSquared)) / Math.abs(dy);
    rectLow = middle - spread;
    rectHigh = middle + spread;
  }
  if (Math.abs(dx) < EPS) {
    const projection = (y - a[1]) * dy;
    if (projection < 0 || projection > lengthSquared) rectLow = Infinity;
  } else {
    const first = a[0] - ((y - a[1]) * dy) / dx,
      last = a[0] + (lengthSquared - (y - a[1]) * dy) / dx;
    rectLow = Math.max(rectLow, Math.min(first, last));
    rectHigh = Math.min(rectHigh, Math.max(first, last));
  }
  if (rectLow <= rectHigh) {
    low = Math.min(low, rectLow);
    high = Math.max(high, rectHigh);
  }
  return Number.isFinite(low) && Number.isFinite(high) && low <= high
    ? [low, high]
    : null;
}
function scanlineIntervals(
  polygons: ProjectedPolygon[],
  y: number,
  edges: Segment[],
  clearance: number,
  spend: (n: number) => void,
): Interval[] {
  const intervals: Interval[] = [];
  for (const polygon of polygons) {
    const crossings: number[] = [];
    for (const ring of polygon)
      for (let i = 1; i < ring.length; i++) {
        spend(1);
        const a = ring[i - 1],
          b = ring[i];
        if (a[1] > y !== b[1] > y)
          crossings.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
    crossings.sort((a, b) => a - b);
    if (crossings.length % 2)
      throw Error("Hranici nelze jednoznačně rozdělit na řádky.");
    for (let i = 0; i < crossings.length; i += 2)
      intervals.push([crossings[i], crossings[i + 1]]);
  }
  const inside = unionIntervals(intervals);
  if (!inside.length) return [];
  const forbidden: Interval[] = [];
  for (const [a, b] of edges) {
    spend(1);
    const interval = capsuleInterval(a, b, y, clearance);
    if (interval) forbidden.push(interval);
  }
  return subtractIntervals(inside, unionIntervals(forbidden));
}
function rotated(
  polygons: ProjectedPolygon[],
  angle: number,
): ProjectedPolygon[] {
  const sin = Math.sin(angle * RAD),
    cos = Math.cos(angle * RAD);
  return polygons.map((polygon) =>
    polygon.map((ring) =>
      ring.map(([x, y]): Point => [x * sin + y * cos, x * cos - y * sin]),
    ),
  );
}
function unrotate([x, y]: Point, angle: number): Point {
  const sin = Math.sin(angle * RAD),
    cos = Math.cos(angle * RAD);
  return [x * sin + y * cos, x * cos - y * sin];
}
function preferable(candidate: Candidate, best: Candidate | null): boolean {
  if (!best || candidate.count !== best.count)
    return !best || candidate.count > best.count;
  if (candidate.segments.length !== best.segments.length)
    return candidate.segments.length < best.segments.length;
  if (
    Math.abs(
      bearingDistance(candidate.bearing) - bearingDistance(best.bearing),
    ) > EPS
  )
    return bearingDistance(candidate.bearing) < bearingDistance(best.bearing);
  if (Math.abs(candidate.length - best.length) > EPS)
    return candidate.length > best.length;
  return candidate.bearing < best.bearing;
}

/** Searches a bounded family of row bearings and lattice offsets. It is a
 * geometric planting scenario, not a proof of global/agronomic optimality. */
export function generatePlantingLayout(
  geometry: AreaGeometry,
  rawSettings: PlantingGeometrySettings,
): PlantingLayout {
  let key = "invalid",
    candidateCount = 0,
    areaM2 = 0,
    bestBearing = 0;
  const result = (
    status: PlantingLayout["status"],
    message: string,
    trees: Point[] = [],
    rows: PlantingRow[] = [],
  ): PlantingLayout => ({
    status,
    geometryKey: key,
    trees,
    rows,
    bearingDeg: bestBearing,
    candidateCount,
    message,
    stats: {
      areaM2,
      rowLengthM: 0,
      rowCount: rows.length,
      treeCount: trees.length,
    },
  });
  try {
    key = plantingGeometryKey(geometry);
    const settings = normalizePlantingSettings(rawSettings);
    if (!settings)
      throw Error(
        "Neplatné rozestupy. Použijte 0,5–50 m, vzdálenost řad alespoň jako vzdálenost stromů a odstupy/souvratě 0–50 m.",
      );
    bestBearing = settings.bearingDeg;
    if (
      !geometry ||
      (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") ||
      !Array.isArray(geometry.coordinates)
    )
      throw Error("Chybí platná polygonová geometrie.");
    const source =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.coordinates;
    if (
      !source.length ||
      source.some((polygon) => !Array.isArray(polygon) || !polygon.length)
    )
      throw Error("Plocha nemá vnější hranici.");
    const rings = source.flat();
    if (rings.length > PLANTING_LIMITS.maxRings)
      throw new LimitError(
        "Geometrie má více než 64 hranic/otvorů. Rozdělte ji na menší plánovací části.",
      );
    let vertexCount = 0;
    const all: Point[] = [];
    for (const ring of rings) {
      if (!Array.isArray(ring) || ring.length < 4)
        throw Error(
          "Hranice musí mít alespoň čtyři souřadnice a být uzavřená.",
        );
      vertexCount += ring.length;
      if (vertexCount > PLANTING_LIMITS.maxVertices)
        throw new LimitError(
          "Hranice má více než 1 200 vrcholů. Rozdělte složitou plochu na menší části.",
        );
      for (const p of ring) {
        if (
          !Array.isArray(p) ||
          !Number.isFinite(p[0]) ||
          !Number.isFinite(p[1]) ||
          Math.abs(p[0]) > 180 ||
          Math.abs(p[1]) > 85
        )
          throw Error("Hranice obsahuje neplatné zeměpisné souřadnice.");
        all.push([p[0], p[1]]);
      }
      if (ring[0][0] !== ring.at(-1)![0] || ring[0][1] !== ring.at(-1)![1])
        throw Error("Hranice pozemku není uzavřená.");
    }
    const [west, south, east, north] = bounds(all),
      projection = localProjection((west + east) / 2, (south + north) / 2);
    const polygons = source.map((polygon) =>
      polygon.map((ring) => {
        const cleaned: Point[] = [];
        for (const item of ring) {
          const point = projection.toXY(item),
            previous = cleaned.at(-1);
          if (
            !previous ||
            Math.hypot(point[0] - previous[0], point[1] - previous[1]) > EPS
          )
            cleaned.push(point);
        }
        if (cleaned.length < 4)
          throw Error("Hranice obsahuje příliš málo různých bodů.");
        return cleaned;
      }),
    );
    const xy = polygons.flat(2),
      [minX, minY, maxX, maxY] = bounds(xy);
    if (Math.hypot(maxX - minX, maxY - minY) > PLANTING_LIMITS.maxDiagonalM)
      throw new LimitError(
        "Plocha přesahuje 3 km úhlopříčky. Rozdělte ji pro podrobný plán výsadby.",
      );
    let operations = 0;
    const spend = (number: number) => {
      operations += number;
      if (operations > PLANTING_LIMITS.maxOperations)
        throw new LimitError(
          "Výpočet složité hranice dosáhl limitu. Zvolte ruční směr řad nebo plochu rozdělte.",
        );
    };
    validateProjected(polygons, spend);
    areaM2 = polygons.reduce(
      (sum, polygon) =>
        sum +
        ringArea(polygon[0]) -
        polygon.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0),
      0,
    );
    if (!Number.isFinite(areaM2) || areaM2 < 1)
      throw Error("Plocha musí mít alespoň 1 m².");
    if (areaM2 > PLANTING_LIMITS.maxAreaM2)
      throw new LimitError(
        "Plocha přesahuje 100 ha. Rozdělte ji pro podrobný plán výsadby.",
      );
    let best: Candidate | null = null;
    const tested = new Set<string>();
    const angles =
      settings.orientation === "manual"
        ? [settings.bearingDeg]
        : Array.from({ length: 36 }, (_, i) => i * 5);
    if (settings.orientation === "auto") {
      const edges = polygons.flatMap((polygon) =>
        polygon.flatMap((ring) =>
          ring
            .slice(1)
            .map((p, i) => ({
              length: Math.hypot(p[0] - ring[i][0], p[1] - ring[i][1]),
              angle: bearing(
                Math.atan2(p[0] - ring[i][0], p[1] - ring[i][1]) / RAD,
              ),
            })),
        ),
      );
      angles.push(
        ...edges
          .sort((a, b) => b.length - a.length)
          .slice(0, 8)
          .map((edge) => edge.angle),
        settings.bearingDeg,
      );
    }
    // A tiny safety factor keeps spherical point-to-point distance >= the pitch
    // even at the outer edge of the local azimuthal projection.
    const rowPitch = settings.rowSpacingM * 1.000001,
      treePitch = settings.treeSpacingM * 1.000001;
    const evaluate = (angle: number) => {
      const normalized = bearing(angle),
        angleKey = normalized.toFixed(7);
      if (tested.has(angleKey)) return;
      tested.add(angleKey);
      const rotatedPolygons = rotated(polygons, normalized),
        rotatedPoints = rotatedPolygons.flat(2),
        box = bounds(rotatedPoints);
      const edges: Segment[] = rotatedPolygons.flatMap((polygon) =>
        polygon.flatMap((ring) =>
          ring.slice(1).map((point, i): Segment => [ring[i], point]),
        ),
      );
      for (const rowOffset of [0, 0.25, 0.5, 0.75]) {
        const rowPhase = rowOffset * rowPitch;
        const firstRow = Math.ceil((box[1] - rowPhase) / rowPitch),
          lastRow = Math.floor((box[3] - rowPhase) / rowPitch);
        const allowed: { low: number; high: number; y: number }[] = [];
        for (let index = firstRow; index <= lastRow; index++) {
          const y = index * rowPitch + rowPhase;
          const pieces = scanlineIntervals(
            rotatedPolygons,
            y,
            edges,
            settings.edgeClearanceM + SAFETY,
            spend,
          );
          for (const [a, b] of pieces) {
            const low = a + settings.headlandM + SAFETY,
              high = b - settings.headlandM - SAFETY;
            if (high > low + EPS) allowed.push({ low, high, y });
          }
        }
        for (const offset of [0, 0.25, 0.5, 0.75]) {
          candidateCount++;
          const phase = offset * treePitch;
          const candidate: Candidate = {
            count: 0,
            segments: [],
            bearing: normalized,
            treePhase: phase,
            length: 0,
          };
          for (const segment of allowed) {
            const first = Math.ceil((segment.low - phase) / treePitch),
              last = Math.floor((segment.high - phase) / treePitch);
            const count = last - first + 1;
            if (count <= 0) continue;
            candidate.count += count;
            if (candidate.count > PLANTING_LIMITS.maxTrees)
              throw new LimitError(
                "Plán obsahuje více než 10 000 stromů. Zvětšete spon nebo rozdělte pozemek; částečný počet nezobrazujeme.",
              );
            candidate.segments.push({ ...segment, first, last });
            candidate.length += segment.high - segment.low;
          }
          if (preferable(candidate, best)) best = candidate;
        }
      }
    };
    for (const angle of angles) evaluate(angle);
    // Refinement is deliberately bounded, deterministic and disclosed in UI.
    if (settings.orientation === "auto" && best) {
      const winningAngle = (best as Candidate).bearing;
      for (let delta = -4; delta <= 4; delta++) evaluate(winningAngle + delta);
    }
    if (!best || !(best as Candidate).count)
      return result(
        "empty",
        "Při tomto sponu, odstupu a souvratích se do plochy nevejde žádný strom. Upravte parametry nebo zvolte jiný způsob výsadby.",
      );
    const winner = best as Candidate;
    bestBearing = winner.bearing;
    const trees: Point[] = [],
      rows: PlantingRow[] = [];
    for (const [index, segment] of winner.segments.entries()) {
      for (let tree = segment.first; tree <= segment.last; tree++)
        trees.push(
          projection.toLonLat(
            unrotate(
              [tree * treePitch + winner.treePhase, segment.y],
              winner.bearing,
            ),
          ),
        );
      rows.push({
        id: `row-${index + 1}`,
        coordinates: [
          projection.toLonLat(
            unrotate([segment.low, segment.y], winner.bearing),
          ),
          projection.toLonLat(
            unrotate([segment.high, segment.y], winner.bearing),
          ),
        ],
        treeCount: segment.last - segment.first + 1,
      });
    }
    const plan = result(
      "ready",
      settings.orientation === "auto"
        ? "Nejlepší nalezená varianta z omezeného porovnání směrů a posunů řad. Nejde o zaručené agronomické optimum."
        : "Řady v zadaném směru s nejlepším nalezeným posunem sítě.",
    );
    plan.trees = trees;
    plan.rows = rows;
    plan.stats = {
      areaM2,
      rowLengthM: winner.length,
      rowCount: rows.length,
      treeCount: trees.length,
    };
    return plan;
  } catch (error) {
    return result(
      error instanceof LimitError ? "limited" : "error",
      error instanceof Error
        ? error.message
        : "Plán výsadby se nepodařilo vypočítat.",
    );
  }
}
