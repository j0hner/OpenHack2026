import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
try {
  const { generatePlantingLayout, normalizePlantingSettings, plantingGeometryKey, PLANTING_LIMITS } = await server.ssrLoadModule('/src/lib/plantingGeometry.ts');
  const { containsPoint } = await server.ssrLoadModule('/src/lib/openData.ts');
  const { splitGeometryByLine, mergeGeometries, makeWorkingArea } = await server.ssrLoadModule('/src/lib/geometryOperations.ts');
  const R = 6371008.8, rad = Math.PI / 180, origin = [16.73, 48.94];
  // Independent local approximation for test fixtures/checks; tolerances are
  // centimetres, not whole metres, on these short Czech parcel extents.
  const position = ([x, y]) => [origin[0] + x / (R * Math.cos(origin[1] * rad)) / rad, origin[1] + y / R / rad];
  const xy = p => [(p[0] - origin[0]) * rad * R * Math.cos(origin[1] * rad), (p[1] - origin[1]) * rad * R];
  const rect = (x, y, width, height) => ({ type: 'Polygon', coordinates: [[[x, y], [x + width, y], [x + width, y + height], [x, y + height], [x, y]].map(position)] });
  const base = { rowSpacingM: 10, treeSpacingM: 5, edgeClearanceM: 3, headlandM: 4, orientation: 'manual', bearingDeg: 90 };
  const distance = (a, b) => {
    const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(value));
  };
  const segmentDistance = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  function assertSafe(geometry, layout, settings, exhaustive = true) {
    assert.equal(layout.status, 'ready', layout.message);
    assert.equal(layout.geometryKey, plantingGeometryKey(geometry));
    assert.equal(layout.stats.treeCount, layout.trees.length);
    assert.equal(layout.stats.rowCount, layout.rows.length);
    assert.equal(layout.rows.reduce((sum, row) => sum + row.treeCount, 0), layout.trees.length);
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    const edges = polygons.flatMap(polygon => polygon.flatMap(ring => ring.slice(1).map((p, i) => [xy(ring[i]), xy(p)])));
    for (const point of layout.trees) {
      assert(containsPoint(geometry, point), 'Every tree must lie in the exact geometry, outside every hole.');
      const local = xy(point);
      assert(edges.every(([a, b]) => segmentDistance(local, a, b) >= settings.edgeClearanceM - .01), 'Every stem observes the edge clearance.');
    }
    if (exhaustive) for (let i = 0; i < layout.trees.length; i++) for (let j = i + 1; j < layout.trees.length; j++)
      assert(distance(layout.trees[i], layout.trees[j]) >= settings.treeSpacingM - .001, 'No duplicate/cross-fragment trees violate spacing.');
    for (const row of layout.rows) {
      assert.equal(row.coordinates.length, 2); assert(row.treeCount >= 1);
      for (let i = 0; i <= 20; i++) {
        const a = row.coordinates[0], b = row.coordinates[1], t = i / 20;
        const point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        assert(containsPoint(geometry, point), 'A row line may not bridge a hole or concave gap.');
        assert(edges.every(([a, b]) => segmentDistance(xy(point), a, b) >= settings.edgeClearanceM - .01), 'Entire row segments observe clearance.');
      }
    }
  }
  const rectangle = rect(0, 0, 100, 60), manual = generatePlantingLayout(rectangle, base);
  assertSafe(rectangle, manual, base);
  assert.equal(manual.trees.length, 108, 'Known 100×60m rectangle with 10×5m grid/3m clearance/4m headlands.');
  assert.equal(manual.bearingDeg, 90);
  for (const row of manual.rows) for (const point of row.coordinates) {
    const [x] = xy(point);
    assert(x >= base.edgeClearanceM + base.headlandM - .01 && x <= 100 - base.edgeClearanceM - base.headlandM + .01, 'Headland is additional to edge clearance on every end.');
  }
  assert.deepEqual(generatePlantingLayout(rectangle, base), manual, 'Generation is deterministic.');
  const automatic = generatePlantingLayout(rectangle, { ...base, orientation: 'auto' });
  assertSafe(rectangle, automatic, base); assert(automatic.trees.length >= manual.trees.length);
  assert(automatic.candidateCount > 16 && automatic.candidateCount <= 900);
  const vertical = generatePlantingLayout(rectangle, { ...base, bearingDeg: 0 });
  assertSafe(rectangle, vertical, base); assert.equal(vertical.bearingDeg, 0);
  const rowVector = vertical.rows[0].coordinates;
  assert(Math.abs(rowVector[1][1] - rowVector[0][1]) > Math.abs(rowVector[1][0] - rowVector[0][0]), 'Zero bearing means north/south, not east/west.');
  const holed = { ...rectangle, coordinates: [rectangle.coordinates[0], rect(35, 20, 30, 20).coordinates[0]] };
  const holePlan = generatePlantingLayout(holed, { ...base, orientation: 'auto' });
  assertSafe(holed, holePlan, base);
  const concave = { type: 'Polygon', coordinates: [[[0, 0], [100, 0], [100, 20], [25, 20], [25, 100], [0, 100], [0, 0]].map(position)] };
  assertSafe(concave, generatePlantingLayout(concave, { ...base, orientation: 'auto' }), base);
  const disjoint = { type: 'MultiPolygon', coordinates: [rect(0, 0, 35, 80).coordinates, rect(60, 0, 35, 80).coordinates] };
  assertSafe(disjoint, generatePlantingLayout(disjoint, { ...base, orientation: 'auto' }), base);
  const tiny = generatePlantingLayout(rect(0, 0, 5, 5), base);
  assert.equal(tiny.status, 'empty'); assert.equal(tiny.trees.length, 0); assert.equal(tiny.rows.length, 0);
  const narrower = generatePlantingLayout(rect(0, 0, 4, 100), base);
  assert.equal(narrower.status, 'empty');
  const tooManyTrees = generatePlantingLayout(rect(0, 0, 200, 200), { ...base, rowSpacingM: .5, treeSpacingM: .5 });
  assert.equal(tooManyTrees.status, 'limited'); assert.equal(tooManyTrees.trees.length, 0); assert.match(tooManyTrees.message, /10 000/);
  assert.equal(generatePlantingLayout(rect(0, 0, 1100, 1100), base).status, 'limited');
  assert.equal(generatePlantingLayout(rect(0, 0, 3100, 10), base).status, 'limited');
  const circle = (vertices, radius) => {
    const ring = Array.from({ length: vertices }, (_, i) => position([radius * Math.cos(i * 2 * Math.PI / vertices), radius * Math.sin(i * 2 * Math.PI / vertices)]));
    ring.push([...ring[0]]);
    return { type: 'Polygon', coordinates: [ring] };
  };
  const detailed = circle(1100, 500), detailedSettings = { ...base, rowSpacingM: 15, treeSpacingM: 10, orientation: 'auto' };
  const detailedAuto = generatePlantingLayout(detailed, detailedSettings);
  assert.equal(detailedAuto.status, 'limited', detailedAuto.message);
  assert.equal(detailedAuto.trees.length, 0); assert.match(detailedAuto.message, /limitu/);
  const detailedManual = generatePlantingLayout(detailed, { ...detailedSettings, orientation: 'manual' });
  assert.equal(detailedManual.status, 'ready', detailedManual.message);
  assert(detailedManual.trees.length > 0, 'Manual orientation provides a bounded fallback for complex but supported boundaries.');
  assert.equal(generatePlantingLayout(circle(1200, 500), base).status, 'limited');
  assert.equal(generatePlantingLayout({ type: 'Polygon', coordinates: [[[0, 0], [10, 10], [0, 10], [10, 0], [0, 0]].map(position)] }, base).status, 'error');
  assert.equal(generatePlantingLayout({ type: 'Polygon', coordinates: [[[16, 49], [16.1, 49], [NaN, 50], [16, 49]]] }, base).status, 'error');
  assert.equal(generatePlantingLayout(rectangle, { ...base, rowSpacingM: 2 }).status, 'error');
  assert.equal(generatePlantingLayout(rectangle, { ...base, rowSpacingM: 2 }).geometryKey, plantingGeometryKey(rectangle));
  assert.equal(normalizePlantingSettings({ ...base, treeSpacingM: '' }), undefined);
  assert.equal(normalizePlantingSettings({ ...base, rowSpacingM: Infinity }), undefined);
  assert.equal(normalizePlantingSettings({ ...base, bearingDeg: -90 }).bearingDeg, 90);
  assert.equal(generatePlantingLayout({ ...rectangle, coordinates: [rectangle.coordinates[0], rect(110, 0, 10, 10).coordinates[0]] }, base).status, 'error', 'An outside hole is invalid.');
  assert.equal(generatePlantingLayout({ type: 'MultiPolygon', coordinates: [rectangle.coordinates, rectangle.coordinates] }, base).status, 'error', 'Overlapping components must not double-plant.');
  assert.equal(PLANTING_LIMITS.maxTrees, 10000);
  // Actual downloaded parcel geometry and actual derived working shapes.
  const collection = JSON.parse(await readFile(new URL('../public/data/locations/demo-d-parcels.json', import.meta.url), 'utf8'));
  const parcel = collection.features.find(f => String(f.properties.id) === '1245682735').geometry;
  const neighbour = collection.features.find(f => String(f.properties.id) === '1245678735').geometry;
  const actualSettings = { ...base, rowSpacingM: 4, treeSpacingM: 1.5, edgeClearanceM: 2, headlandM: 2, orientation: 'auto' };
  const began = performance.now(), actual = generatePlantingLayout(parcel, actualSettings);
  assertSafe(parcel, actual, actualSettings);
  const xs = parcel.coordinates[0].map(p => p[0]), ys = parcel.coordinates[0].map(p => p[1]);
  const lineY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const parts = splitGeometryByLine(parcel, [[Math.min(...xs) - .001, lineY], [Math.max(...xs) + .001, lineY]]);
  const source = { id: 'real-parcel', name: 'Parcela 1641', kind: 'parcel', landUse: 'zahrada', geometry: parcel, location: { obec: '', okres: '', kraj: '', katastr: '649864' } };
  for (const [index, part] of parts.entries()) {
    const working = makeWorkingArea(part, `část ${index + 1}`, [source], 'split');
    const layout = generatePlantingLayout(working.geometry, actualSettings);
    assertSafe(working.geometry, layout, actualSettings);
    assert.notEqual(layout.geometryKey, actual.geometryKey);
  }
  const rejoined = mergeGeometries(parts), joined = mergeGeometries([parcel, neighbour]);
  assertSafe(rejoined, generatePlantingLayout(rejoined, actualSettings), actualSettings);
  assertSafe(joined, generatePlantingLayout(joined, actualSettings), actualSettings);
  assert(performance.now() - began < 6000, 'Several real parcel/split/merge plans must stay bounded.');
  console.log(JSON.stringify({ checks: 'OK', knownRectangleTrees: manual.trees.length, actualParcelTrees: actual.trees.length, holesAndConcavity: true, actualSplitMerge: true, allTreesInside: true, edgeClearance: true, noCrossGapRows: true, minimumSpacing: true, deterministic: true, limitIsNotPartial: true, elapsedMs: Math.round(performance.now() - began) }));
} finally { await server.close(); }
