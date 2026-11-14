import { area } from "@turf/area";
import { bbox } from "@turf/bbox";
import { intersect } from "@turf/intersect";
import { union } from "@turf/union";
import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
} from "geojson";
import type { AnalysisArea, AreaGeometry } from "./types";

type Surface = Polygon | MultiPolygon;
export type SplitDirection = "north-south" | "east-west";
const feature = (geometry: AreaGeometry): Feature<Surface> => ({
  type: "Feature",
  properties: {},
  geometry,
});
const collection = (
  geometries: AreaGeometry[],
): FeatureCollection<Surface> => ({
  type: "FeatureCollection",
  features: geometries.map(feature),
});
const tolerance = (size: number) => Math.max(0.1, size * 0.00001);

export function validateWorkingGeometry(geometry: AreaGeometry): void {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  if (!polygons.length) throw Error("Plocha nemá platnou geometrii.");
  for (const polygon of polygons) {
    if (!polygon.length) throw Error("Plocha nemá vnější hranici.");
    for (const ring of polygon) {
      if (
        ring.length < 4 ||
        ring.some(
          (p) =>
            p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]),
        )
      )
        throw Error("Hranice plochy obsahuje neplatné souřadnice.");
      const first = ring[0],
        last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1])
        throw Error("Hranice plochy není uzavřená.");
    }
  }
  if (!Number.isFinite(area(geometry)) || area(geometry) < 1)
    throw Error("Pracovní plocha musí mít alespoň 1 m².");
}

/** Intersect actual geometry with adjacent bands; retain holes and disconnected parts. */
export function splitGeometry(
  geometry: AreaGeometry,
  direction: SplitDirection,
  count = 2,
  positionPct = 50,
): AreaGeometry[] {
  validateWorkingGeometry(geometry);
  if (!Number.isInteger(count) || count < 2 || count > 8)
    throw Error("Zvolte 2 až 8 částí.");
  if (positionPct < 10 || positionPct > 90 || !Number.isFinite(positionPct))
    throw Error("Umístěte dělení mezi 10 a 90 % šířky.");
  const [w, s, e, n] = bbox(geometry),
    vertical = direction === "north-south",
    low = vertical ? w : s,
    high = vertical ? e : n;
  if (high <= low) throw Error("Plochu nelze v tomto směru rozdělit.");
  const stops = [
    low,
    ...Array.from(
      { length: count - 1 },
      (_, i) =>
        low +
        (high - low) * (count === 2 ? positionPct / 100 : (i + 1) / count),
    ),
    high,
  ];
  const parts: AreaGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const a = stops[i],
      b = stops[i + 1];
    const coordinates = vertical
      ? [
          [a, s],
          [b, s],
          [b, n],
          [a, n],
          [a, s],
        ]
      : [
          [w, a],
          [e, a],
          [e, b],
          [w, b],
          [w, a],
        ];
    const clipped = intersect(
      collection([geometry, { type: "Polygon", coordinates: [coordinates] }]),
    );
    if (clipped && area(clipped) > 0.000001) parts.push(clipped.geometry);
  }
  if (parts.length < 2)
    throw Error(
      "Dělicí hranice nevytváří alespoň dvě neprázdné části. Změňte směr nebo polohu dělení.",
    );
  parts.forEach(validateWorkingGeometry);
  const original = area(geometry),
    sum = parts.reduce((total, g) => total + area(g), 0),
    allowed = tolerance(original);
  if (Math.abs(sum - original) > allowed)
    throw Error(
      "Dělení nezachovalo celou výměru. Zvolte jiný směr nebo menší plochu.",
    );
  for (let i = 0; i < parts.length; i++)
    for (let j = i + 1; j < parts.length; j++) {
      const shared = intersect(collection([parts[i], parts[j]]));
      if (shared && area(shared) > allowed)
        throw Error("Vytvořené části se překrývají; dělení se neuložilo.");
    }
  return parts;
}

type Point = [number, number];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];
const subtract = (a: number[], b: number[]): Point => [
  a[0] - b[0],
  a[1] - b[1],
];

/** A boundary counts as inside here. Holes cannot be used as line endpoints. */
function insideOuterRing(
  point: Point,
  ring: number[][],
  epsilon: number,
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j],
      b = ring[i],
      edge = subtract(b, a),
      relative = subtract(point, a);
    const length = Math.hypot(...edge);
    if (
      length > 0 &&
      Math.abs(edge[0] * relative[1] - edge[1] * relative[0]) <=
        epsilon * length
    ) {
      const along = dot(relative, edge) / length;
      if (along >= -epsilon && along <= length + epsilon) return true;
    }
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

/**
 * Split a selected geometry with the finite straight segment drawn on the map.
 * Two oriented half planes are intersected with the actual polygon, preserving
 * holes and MultiPolygons. The line must span every boundary it would cut, so a
 * short segment cannot silently cut another disconnected component far away.
 */
export function splitGeometryByLine(
  geometry: AreaGeometry,
  points: Point[],
): AreaGeometry[] {
  validateWorkingGeometry(geometry);
  if (points.length !== 2)
    throw Error(
      "Dělicí čára potřebuje dva body: začátek a konec mimo pozemek.",
    );
  if (
    points.some(
      (p) =>
        !Array.isArray(p) ||
        p.length !== 2 ||
        !Number.isFinite(p[0]) ||
        !Number.isFinite(p[1]) ||
        Math.abs(p[0]) > 180 ||
        Math.abs(p[1]) > 90,
    )
  )
    throw Error("Dělicí čára obsahuje neplatné souřadnice.");
  const [start, end] = points,
    vector = subtract(end, start),
    length = Math.hypot(...vector);
  const lengthM = Math.hypot(
    vector[0] * 111320 * Math.cos(((start[1] + end[1]) * Math.PI) / 360),
    vector[1] * 110540,
  );
  if (lengthM < 0.5 || !Number.isFinite(lengthM) || length === 0)
    throw Error(
      "Dělicí čára je příliš krátká. Nakreslete ji přes celý pozemek.",
    );
  const [w, s, e, n] = bbox(geometry),
    diagonal = Math.hypot(e - w, n - s),
    epsilon = Math.max(1e-12, diagonal * 1e-10);
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  if (
    points.some((point) =>
      polygons.some((polygon) => insideOuterRing(point, polygon[0], epsilon)),
    )
  )
    throw Error(
      "Začněte a ukončete čáru mimo vnější hranici pozemku, ne uvnitř ani v otvoru.",
    );

  const direction: Point = [vector[0] / length, vector[1] / length],
    normal: Point = [-direction[1], direction[0]];
  // Anchor near the parcel rather than at a possibly distant map click.
  const center: Point = [(w + e) / 2, (s + n) / 2],
    projection = dot(subtract(center, start), direction);
  const origin: Point = [
    start[0] + direction[0] * projection,
    start[1] + direction[1] * projection,
  ];
  const frame = (p: number[]): Point => [
    dot(subtract(p, origin), direction),
    dot(subtract(p, origin), normal),
  ];
  const all = polygons.flatMap((polygon) =>
    polygon.flatMap((ring) => ring.map(frame)),
  );
  let minAlong = Infinity,
    maxAlong = -Infinity,
    minSide = Infinity,
    maxSide = -Infinity;
  for (const [along, side] of all) {
    minAlong = Math.min(minAlong, along);
    maxAlong = Math.max(maxAlong, along);
    minSide = Math.min(minSide, side);
    maxSide = Math.max(maxSide, side);
  }
  if (minSide >= -epsilon || maxSide <= epsilon)
    throw Error(
      "Čára pozemek nerozděluje. Veďte ji napříč jeho plochou, ne podél okraje.",
    );

  const segmentStart = frame(start)[0],
    segmentEnd = frame(end)[0],
    crossings: number[] = [];
  for (const polygon of polygons)
    for (const ring of polygon) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = frame(ring[i]),
          b = frame(ring[i + 1]),
          aOn = Math.abs(a[1]) <= epsilon,
          bOn = Math.abs(b[1]) <= epsilon;
        // Collinear boundaries are ambiguous, including the side of a hole.
        if (aOn && bOn && Math.hypot(b[0] - a[0], b[1] - a[1]) > epsilon)
          throw Error(
            "Čára splývá s hranicí pozemku nebo otvoru. Posuňte ji mimo hranu.",
          );
        if (aOn) crossings.push(a[0]);
        else if (bOn) crossings.push(b[0]);
        else if (a[1] < 0 !== b[1] < 0)
          crossings.push(a[0] + ((b[0] - a[0]) * a[1]) / (a[1] - b[1]));
      }
    }
  const distinct = crossings
    .sort((a, b) => a - b)
    .filter(
      (value, index, sorted) =>
        index === 0 || value - sorted[index - 1] > epsilon,
    );
  if (distinct.length < 2)
    throw Error(
      "Čára neprotíná pozemek na dvou místech. Veďte ji přes celý pozemek.",
    );
  if (
    distinct.some(
      (along) => along < segmentStart - epsilon || along > segmentEnd + epsilon,
    )
  )
    throw Error(
      "Čára je příliš krátká: prodlužte ji za všechny části vybraného pozemku.",
    );

  const margin = Math.max(diagonal, length * 0.01, 1e-6),
    lo = minAlong - margin,
    hi = maxAlong + margin;
  const extent = Math.max(Math.abs(minSide), Math.abs(maxSide)) + margin;
  const world = (along: number, side: number): Point => [
    origin[0] + direction[0] * along + normal[0] * side,
    origin[1] + direction[1] * along + normal[1] * side,
  ];
  const half = (low: number, high: number): AreaGeometry => ({
    type: "Polygon",
    coordinates: [
      [
        world(lo, low),
        world(hi, low),
        world(hi, high),
        world(lo, high),
        world(lo, low),
      ],
    ],
  });
  const parts = [half(0, extent), half(-extent, 0)]
    .map((clip) => intersect(collection([geometry, clip])))
    .filter((p): p is Feature<Surface> => p !== null)
    .map((p) => p.geometry);
  if (parts.length !== 2 || parts.some((part) => area(part) < 1))
    throw Error(
      "Čára nevytváří dvě použitelné části alespoň po 1 m². Posuňte dělení dál od okraje.",
    );
  parts.forEach(validateWorkingGeometry);
  const original = area(geometry),
    sum = parts.reduce((total, part) => total + area(part), 0),
    allowed = tolerance(original);
  if (Math.abs(sum - original) > allowed)
    throw Error("Dělení nezachovalo celou výměru. Zkuste čáru vést jinudy.");
  const shared = intersect(collection(parts));
  if (shared && area(shared) > allowed)
    throw Error("Vzniklé části se překrývají; rozdělení se neuložilo.");
  return parts;
}

export function mergeGeometries(geometries: AreaGeometry[]): AreaGeometry {
  if (geometries.length < 2 || geometries.length > 20)
    throw Error("Pro spojení vyberte 2 až 20 ploch.");
  geometries.forEach(validateWorkingGeometry);
  const merged = union(collection(geometries));
  if (!merged) throw Error("Vybrané geometrie se nepodařilo spojit.");
  validateWorkingGeometry(merged.geometry);
  const mergedSize = area(merged),
    sum = geometries.reduce((total, g) => total + area(g), 0),
    largest = Math.max(...geometries.map((g) => area(g)));
  if (
    mergedSize > sum + tolerance(sum) ||
    mergedSize < largest - tolerance(largest)
  )
    throw Error("Výsledek spojení má neplatnou výměru.");
  return merged.geometry;
}

export type WorkingArea = AnalysisArea & {
  derivedFrom: NonNullable<AnalysisArea["derivedFrom"]>;
};

/** Preserve root provenance independently of the lifetime of intermediate areas. */
function sourceLineage(sources: AnalysisArea[]) {
  const available = new Map(sources.map((source) => [source.id, source]));
  const roots = new Map<string, string>(),
    cadastral = new Set<string>();
  const remember = (id: string, name: string) => {
    if (!roots.has(id)) roots.set(id, available.get(id)?.name ?? name);
    const match = /^parcel-(\d+)$/.exec(id);
    if (match) cadastral.add(match[1]);
  };
  const visit = (source: AnalysisArea, seen: Set<string>) => {
    if (source.cadastral && /^\d+$/.test(source.cadastral.id))
      cadastral.add(source.cadastral.id);
    for (const id of source.derivedFrom?.rootCadastralIds ?? [])
      if (/^\d+$/.test(id)) cadastral.add(id);
    if (seen.has(source.id)) {
      remember(source.id, source.name);
      return;
    }
    const origin = source.derivedFrom;
    if (origin?.rootSourceIds?.length) {
      origin.rootSourceIds.forEach((id, index) =>
        remember(id, origin.rootSourceNames?.[index] ?? id),
      );
      return;
    }
    if (origin?.sourceIds.length) {
      const next = new Set(seen);
      next.add(source.id);
      origin.sourceIds.forEach((id, index) => {
        const parent = available.get(id);
        if (parent) visit(parent, next);
        else remember(id, origin.sourceNames[index] ?? id);
      });
      return;
    }
    remember(source.id, source.name);
  };
  sources.forEach((source) => visit(source, new Set()));
  return {
    rootSourceIds: [...roots.keys()],
    rootSourceNames: [...roots.values()],
    rootCadastralIds: [...cadastral],
  };
}

export function makeWorkingArea(
  geometry: AreaGeometry,
  name: string,
  sources: AnalysisArea[],
  operation: "split" | "merge",
): WorkingArea {
  validateWorkingGeometry(geometry);
  if (!sources.length) throw Error("Chybí zdrojová plocha.");
  const id =
    "working-" +
    (globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  const same = (key: "katastr" | "obec" | "okres" | "kraj") =>
    sources.every((s) => s.location[key] === sources[0].location[key])
      ? sources[0].location[key]
      : "více území";
  return {
    id,
    name: name.trim().slice(0, 100) || "Pracovní plocha",
    kind: "custom",
    geometry,
    landUse: "pracovní vymezení",
    location: {
      code: "PRACOVNÍ",
      katastr: same("katastr"),
      obec: same("obec"),
      okres: same("okres"),
      kraj: same("kraj"),
    },
    attributes: {
      soil: null,
      climate: null,
      water: null,
      terrain: null,
      access: null,
      constraints: null,
    },
    availability: {
      soil: "missing",
      climate: "missing",
      water: "missing",
      terrain: "missing",
      access: "missing",
    },
    sourceNote: `Pracovní geometrie: ${operation === "split" ? "rozdělení" : "spojení"} ploch ${sources.map((s) => s.name).join(", ")}. Podklady se nově přiřazují podle výsledné geometrie.`,
    story:
      "Úprava pracovní plochy v aplikaci. Nejde o právní změnu hranic parcel ani vlastnictví v katastru.",
    derivedFrom: {
      operation,
      sourceIds: sources.map((s) => s.id),
      sourceNames: sources.map((s) => s.name),
      ...sourceLineage(sources),
    },
  };
}
