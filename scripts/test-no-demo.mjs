import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});
try {
  const { migrateState } = await server.ssrLoadModule("/src/lib/migration.ts");
  const { parcelArea } = await server.ssrLoadModule("/src/lib/openData.ts");
  const collection = JSON.parse(
    await readFile(
      new URL("../public/data/locations/demo-d-parcels.json", import.meta.url),
    ),
  );
  const feature = collection.features.find(
    (feature) => String(feature.properties.druhpozemkukod) === "2",
  );
  assert(feature, "Fixture needs a real arable parcel");
  const real = parcelArea(feature),
    sample = { ...real, id: "demo-a", kind: "sample" },
    child = {
      ...real,
      id: "working-synthetic",
      kind: "custom",
      cadastral: undefined,
      derivedFrom: {
        operation: "split",
        sourceIds: ["demo-a"],
        sourceNames: ["sample"],
      },
    },
    grandchild = {
      ...child,
      id: "working-nested",
      derivedFrom: {
        operation: "split",
        sourceIds: [child.id],
        sourceNames: ["part"],
      },
    },
    orphan = {
      ...child,
      id: "working-orphan",
      derivedFrom: {
        operation: "split",
        sourceIds: ["removed-parent"],
        sourceNames: ["part"],
        rootSourceIds: ["demo-b"],
        rootSourceNames: ["sample"],
      },
    };
  const custom = {
      ...real,
      id: "own-drawing",
      kind: "custom",
      cadastral: undefined,
      derivedFrom: undefined,
      name: "Můj původní polygon",
    },
    realPart = {
      ...custom,
      id: "working-real",
      derivedFrom: {
        operation: "split",
        sourceIds: [real.id],
        sourceNames: [real.name],
        rootSourceIds: [real.id],
        rootCadastralIds: [real.cadastral.id],
      },
    },
    mixed = {
      ...custom,
      id: "mixed",
      derivedFrom: {
        operation: "merge",
        sourceIds: [real.id, grandchild.id],
        sourceNames: ["actual", "synthetic"],
      },
    };
  const syntheticIds = [
    sample.id,
    child.id,
    grandchild.id,
    orphan.id,
    mixed.id,
  ];
  const boot = {
    mode: "demo",
    fruit: "apple",
    parcels: [real, sample],
    workingAreas: [custom, child, grandchild, orphan, realPart, mixed],
    selectedIds: [real.id, ...syntheticIds, realPart.id],
    activeId: grandchild.id,
    areaNames: {
      [real.id]: "Přejmenovaný skutečný pozemek",
      [sample.id]: "sample",
      [custom.id]: "Vlastní",
    },
    fruitByArea: {
      [real.id]: "pear",
      [grandchild.id]: "cherry",
      [realPart.id]: "plum",
    },
    layers: {
      lpis: true,
      drought: true,
      bpej: true,
      coverage: true,
      protected: false,
    },
    drawnGeometry: real.geometry,
    demoProfileId: "demo-c",
    splitHistory: [
      {
        id: "bad-history",
        source: sample,
        childIds: [child.id],
        selectedIds: [sample.id],
        fruit: "apple",
      },
      {
        id: "real-history",
        source: real,
        childIds: [realPart.id],
        selectedIds: [real.id],
        fruit: "pear",
      },
    ],
  };
  const before = JSON.stringify(boot),
    next = migrateState(boot);
  assert.equal(
    JSON.stringify(boot),
    before,
    "Migration must not mutate caller data",
  );
  assert.deepEqual(
    next.parcels.map((area) => area.id),
    [real.id],
  );
  assert.deepEqual(
    next.workingAreas.map((area) => area.id),
    [custom.id, realPart.id],
  );
  assert.deepEqual(next.selectedIds, [real.id, realPart.id]);
  assert.equal(next.activeId, null);
  assert.equal(next.areaNames[real.id], "Přejmenovaný skutečný pozemek");
  assert.equal(next.fruitByArea[realPart.id], "plum");
  assert.equal(next.parcels[0].geometry, real.geometry);
  assert.equal(next.workingAreas[0].name, custom.name);
  assert.equal(next.parcels[0].attributes.soil, null);
  assert.equal(next.parcels[0].regional, undefined);
  assert.deepEqual(Object.keys(next.layers).sort(), [
    "bpej",
    "coverage",
  ]);
  assert.deepEqual(
    next.splitHistory.map((record) => record.id),
    ["real-history"],
  );
  assert.equal(next.drawnGeometry, real.geometry);
  assert.deepEqual(
    migrateState(next),
    next,
    "A migrated state must remain stable on subsequent reloads",
  );
  assert.equal(migrateState(null), null);
  const app = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  assert(!app.includes("DEMO_AREAS"));
  assert(!app.includes("scoreArea("));
  assert(!app.includes("setMode("));
  console.log(
    JSON.stringify({
      checks: "OK",
      migration:
        "sample roots, recursive/missing ancestors, mixed lineage, real/custom preservation, independent fruit, history and idempotence",
      freshApplication: "no sample import or synthetic scoring fallback",
    }),
  );
} finally {
  await server.close();
}
