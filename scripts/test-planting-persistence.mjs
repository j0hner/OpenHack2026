import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const storageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);
const values = new Map([["moje-sady-theme", "dark"]]);
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  },
});
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: "custom",
});
try {
  const { parcelArea } = await server.ssrLoadModule("/src/lib/openData.ts");
  const { generatePlantingLayout, plantingGeometryKey } =
    await server.ssrLoadModule("/src/lib/plantingGeometry.ts");
  const {
    appliedPlantingPlan,
    normalizeAppliedPlantingPlan,
    normalizePlantingPlans,
    matchingPlantingPlan,
    plantingRequestKey,
  } = await server.ssrLoadModule("/src/lib/plantingPlan.ts");
  const { splitGeometryByLine, mergeGeometries, makeWorkingArea } =
    await server.ssrLoadModule("/src/lib/geometryOperations.ts");
  const { migrateState } = await server.ssrLoadModule("/src/lib/migration.ts");
  const { saveState, loadState, STORAGE_KEY } = await server.ssrLoadModule(
    "/src/lib/storage.ts",
  );
  const fixture = JSON.parse(
    await readFile(
      new URL("../public/data/locations/demo-d-parcels.json", import.meta.url),
      "utf8",
    ),
  );
  const actual = (id) =>
    parcelArea(
      fixture.features.find((feature) => String(feature.properties.id) === id),
    );
  const a = actual("1245682735"),
    b = actual("1245689735");
  const settings = {
    rowSpacingM: 5,
    treeSpacingM: 3.5,
    edgeClearanceM: 3,
    headlandM: 4,
    orientation: "manual",
    bearingDeg: 90,
  };
  const record = (target, fruit, custom = settings) => {
    const layout = generatePlantingLayout(target.geometry, custom);
    assert(["ready", "empty"].includes(layout.status), layout.message);
    const plan = appliedPlantingPlan(
      target.geometry,
      fruit,
      custom,
      `${fruit}-test`,
      layout,
    );
    assert(
      plan,
      "A complete generated geometry must create a persistable record.",
    );
    assert.equal(plan.treeCount, layout.trees.length);
    assert.equal(plan.rowCount, layout.rows.length);
    assert.deepEqual(plan.settings, custom);
    assert(!("trees" in plan));
    assert(!("rows" in plan));
    assert(!("coordinates" in plan));
    return { plan, layout };
  };
  const apple = record(a, "apple"),
    pear = record(a, "pear", {
      ...settings,
      rowSpacingM: 6,
      treeSpacingM: 4,
      bearingDeg: 45,
    });
  const plum = record(b, "plum");
  assert(apple.plan.treeCount > 0);
  assert(pear.plan.treeCount > 0);
  const plans = {
    [a.id]: { apple: apple.plan, pear: pear.plan },
    [b.id]: { plum: plum.plan },
  };
  const before = JSON.stringify(plans);
  const polluted = {
    ...apple.plan,
    trees: apple.layout.trees,
    rows: apple.layout.rows,
    coordinates: apple.layout.trees,
    unknown: "discard",
  };
  assert.deepEqual(
    normalizeAppliedPlantingPlan(polluted, a.geometry, "apple"),
    apple.plan,
    "Normalisation must strip point arrays and unrecognised fields.",
  );
  const clean = normalizePlantingPlans(
    {
      ...plans,
      orphan: { apple: apple.plan },
      [a.id]: { ...plans[a.id], unknownFruit: apple.plan },
    },
    [a, b],
  );
  assert.deepEqual(clean, plans);
  assert.equal(
    JSON.stringify(plans),
    before,
    "Normalisation must not mutate existing records.",
  );
  const renamed = {
    ...a,
    name: "Sad u cesty",
    cadastral: { ...a.cadastral, parcelNumber: "1641" },
  };
  assert.deepEqual(
    normalizePlantingPlans(plans, [renamed, b]),
    plans,
    "Name and canonical-number presentation do not invalidate a geometry plan.",
  );
  assert.equal(
    matchingPlantingPlan({ ...renamed, plantingPlan: apple.plan }, "apple")
      .treeCount,
    apple.plan.treeCount,
  );
  assert.equal(
    matchingPlantingPlan({ ...renamed, plantingPlan: apple.plan }, "pear"),
    undefined,
  );
  const badRecords = [
    null,
    [],
    { ...apple.plan, treeCount: -1 },
    { ...apple.plan, treeCount: 0.5 },
    { ...apple.plan, treeCount: 10001 },
    { ...apple.plan, treeCount: NaN },
    { ...apple.plan, rowCount: -1 },
    { ...apple.plan, rowCount: apple.plan.treeCount + 1 },
    { ...apple.plan, status: "loading" },
    { ...apple.plan, status: "limited" },
    { ...apple.plan, status: "empty" },
    { ...apple.plan, treeCount: 0, rowCount: 0 },
    { ...apple.plan, version: "obsolete" },
    { ...apple.plan, geometryKey: plantingGeometryKey(b.geometry) },
    { ...apple.plan, fruit: "pear" },
    { ...apple.plan, settings: { ...settings, treeSpacingM: 0 } },
    { ...apple.plan, bearingDeg: 180 },
    { ...apple.plan, createdAt: "not-a-date" },
  ];
  for (const raw of badRecords)
    assert.equal(
      normalizeAppliedPlantingPlan(raw, a.geometry, "apple"),
      undefined,
      `Invalid plan must be rejected: ${JSON.stringify(raw)}`,
    );
  for (const status of ["limited", "error"])
    assert.equal(
      appliedPlantingPlan(a.geometry, "apple", settings, "apple-test", {
        ...apple.layout,
        status,
      }),
      undefined,
      "An incomplete result must not become a saved count.",
    );
  const empty = record(a, "apple", {
    ...settings,
    edgeClearanceM: 50,
    headlandM: 50,
  }).plan;
  assert.equal(empty.status, "empty");
  assert.equal(empty.treeCount, 0);
  assert.equal(empty.rowCount, 0);
  assert.deepEqual(
    normalizeAppliedPlantingPlan(empty, a.geometry, "apple"),
    empty,
    "A confirmed empty layout is different from a missing result.",
  );

  const bounds = a.geometry.coordinates[0].reduce(
    (box, p) => [
      Math.min(box[0], p[0]),
      Math.min(box[1], p[1]),
      Math.max(box[2], p[0]),
      Math.max(box[3], p[1]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  const middle = (bounds[1] + bounds[3]) / 2;
  const parts = splitGeometryByLine(a.geometry, [
    [bounds[0] - 0.001, middle],
    [bounds[2] + 0.001, middle],
  ]).map((geometry, index) =>
    makeWorkingArea(
      geometry,
      `část ${index + 1}`,
      [{ ...a, plantingPlan: apple.plan }],
      "split",
    ),
  );
  const merged = makeWorkingArea(
    mergeGeometries(parts.map((part) => part.geometry)),
    "spojený sad",
    parts,
    "merge",
  );
  for (const target of [...parts, merged])
    assert.equal(
      target.plantingPlan,
      undefined,
      "A working shape must not inherit a source plan property.",
    );
  const expandedAreas = [a, b, ...parts, merged];
  assert.deepEqual(
    normalizePlantingPlans(plans, expandedAreas),
    plans,
    "New working IDs start without inherited persisted plans.",
  );
  assert.equal(
    normalizeAppliedPlantingPlan(apple.plan, parts[0].geometry, "apple"),
    undefined,
    "A parent summary is invalid for a child polygon.",
  );
  assert.equal(
    normalizePlantingPlans(plans, [{ ...a, geometry: parts[0].geometry }, b])[
      a.id
    ],
    undefined,
    "Changing boundaries under the same parcel ID invalidates all fruit plans.",
  );
  assert.notEqual(
    plantingRequestKey(a.geometry, "apple", settings),
    plantingRequestKey(parts[0].geometry, "apple", settings),
  );
  assert.notEqual(
    plantingRequestKey(a.geometry, "apple", settings),
    plantingRequestKey(a.geometry, "pear", settings),
  );
  assert.notEqual(
    plantingRequestKey(a.geometry, "apple", settings),
    plantingRequestKey(a.geometry, "apple", { ...settings, edgeClearanceM: 4 }),
  );

  const saved = {
    fruit: "apple",
    fruitByArea: { [a.id]: "apple", [b.id]: "plum" },
    irrigation: false,
    selectedIds: [a.id],
    activeId: a.id,
    region: { kraj: "", okres: "", obec: "", katastr: "" },
    layers: {},
    economicsByFruit: {},
    drawnGeometry: null,
    parcels: [a, b],
    workingAreas: [],
    areaNames: { [a.id]: "Sad u cesty" },
    plantingPlans: plans,
    plantingVisible: false,
  };
  saveState(saved);
  const stored = JSON.parse(values.get(STORAGE_KEY));
  assert.deepEqual(stored.plantingPlans, plans);
  assert(
    !/"(?:trees|rows|coordinates)"/.test(JSON.stringify(stored.plantingPlans)),
    "Only settings and compact counts belong in saved planting records.",
  );
  assert(
    JSON.stringify(stored.plantingPlans).length < 2000,
    "Three actual plans must remain compact instead of serializing every tree.",
  );
  const restored = loadState();
  assert.deepEqual(restored.plantingPlans, plans);
  assert.equal(restored.plantingVisible, false);
  assert.equal(restored.areaNames[a.id], "Sad u cesty");
  assert.equal(restored.parcels.length, 2);
  assert.equal(values.get("moje-sady-theme"), "dark");
  const invalid = {
    ...saved,
    plantingPlans: {
      ...plans,
      orphan: plans[a.id],
      [b.id]: { plum: { ...plum.plan, treeCount: -2 } },
    },
  };
  const invalidBefore = JSON.stringify(invalid);
  const migrated = migrateState(invalid);
  assert.deepEqual(Object.keys(migrated.plantingPlans), [a.id]);
  assert.equal(JSON.stringify(invalid), invalidBefore);
  assert.deepEqual(
    migrateState(migrated),
    migrated,
    "Planting migration must be idempotent.",
  );
  values.set(STORAGE_KEY, JSON.stringify(invalid));
  assert.deepEqual(
    loadState().plantingPlans,
    migrated.plantingPlans,
    "Reload must apply the same invalid/orphan cleanup.",
  );
  values.set(STORAGE_KEY, "{malformed-json");
  assert.equal(loadState(), null);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem() {
        throw Error("storage blocked");
      },
      setItem() {
        throw Error("quota");
      },
    },
  });
  assert.doesNotThrow(() => saveState(saved));
  assert.equal(loadState(), null);
  console.log(
    JSON.stringify({
      checks: "OK",
      actualComputedSummaries: true,
      compactSettingsWithoutPoints: true,
      perAreaAndFruit: true,
      staleAndInvalidRejected: badRecords.length,
      emptyNotMissing: true,
      renameStable: true,
      changedBoundaryInvalidates: true,
      splitMergeNoInheritance: true,
      storageRoundtrip: true,
      orphanCleanup: true,
      storageFailureTolerant: true,
    }),
  );
} finally {
  if (storageDescriptor)
    Object.defineProperty(globalThis, "localStorage", storageDescriptor);
  else delete globalThis.localStorage;
  await server.close();
}
