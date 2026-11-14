import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: "custom",
});
try {
  const { parcelArea } = await server.ssrLoadModule("/src/lib/openData.ts");
  const { economicsForFruit, FRUIT_ORDER } = await server.ssrLoadModule(
    "/src/data/fruitProfiles.ts",
  );
  const { computeEconomics, SCENARIOS } = await server.ssrLoadModule(
    "/src/lib/economics.ts",
  );
  const { matchingPlantingPlan, appliedPlantingPlan } =
    await server.ssrLoadModule("/src/lib/plantingPlan.ts");
  const {
    PLANTING_GEOMETRY_VERSION,
    plantingGeometryKey,
    generatePlantingLayout,
  } = await server.ssrLoadModule("/src/lib/plantingGeometry.ts");
  const { splitGeometryByLine, mergeGeometries, makeWorkingArea } =
    await server.ssrLoadModule("/src/lib/geometryOperations.ts");
  const { aggregateCategoryScenarios } = await server.ssrLoadModule(
    "/src/lib/parcelCategories.ts",
  );
  const { scoreRegionalArea } = await server.ssrLoadModule(
    "/src/lib/regionalScoring.ts",
  );
  const { default: RecommendationPanel } = await server.ssrLoadModule(
    "/src/components/RecommendationPanel.tsx",
  );
  const { default: EconomicsPanel } = await server.ssrLoadModule(
    "/src/components/EconomicsPanel.tsx",
  );
  const { areaHa } = await server.ssrLoadModule("/src/lib/geo.ts");
  const fixture = JSON.parse(
    await readFile(
      new URL("../public/data/locations/demo-d-parcels.json", import.meta.url),
      "utf8",
    ),
  );
  const area = parcelArea(
    fixture.features.find(
      (feature) => String(feature.properties.id) === "1245682735",
    ),
  );
  const inputs = economicsForFruit("apple"),
    options = { irrigation: false, subsidy: false, scenario: SCENARIOS[1] };
  const original = JSON.stringify(area);
  const baseline = computeEconomics(area, "apple", inputs, options);
  assert.equal(
    baseline.treeCount,
    150,
    "The existing actual-parcel scenario must retain its original count without a spatial plan.",
  );
  assert.equal(baseline.investment.trees, 40500);
  const settings = {
    rowSpacingM: 5,
    treeSpacingM: 3.5,
    edgeClearanceM: 3,
    headlandM: 4,
    orientation: "manual",
    bearingDeg: 90,
  };
  const summary = (count) => ({
    version: PLANTING_GEOMETRY_VERSION,
    geometryKey: plantingGeometryKey(area.geometry),
    fruit: "apple",
    settings,
    profileId: "custom",
    status: count ? "ready" : "empty",
    treeCount: count,
    rowCount: count ? 5 : 0,
    bearingDeg: 90,
    createdAt: "2026-11-14T00:00:00.000Z",
  });
  const planned = { ...area, plantingPlan: summary(37) };
  assert.equal(matchingPlantingPlan(planned, "apple").treeCount, 37);
  const result = computeEconomics(planned, "apple", inputs, options);
  assert.equal(result.treeCount, 37);
  assert.equal(
    result.investment.trees,
    9990,
    "Sapling and planting costs use the geometry count, not the global density.",
  );
  assert.equal(
    baseline.annualCostsMature - result.annualCostsMature,
    (150 - 37) * inputs.annualCostPerTree,
  );
  assert.equal(
    result.matureRevenue,
    baseline.matureRevenue,
    "A geometric layout must not invent a new yield model for nonempty orchards.",
  );
  for (const scenario of SCENARIOS) {
    const empty = { ...area, plantingPlan: summary(0) };
    const noTrees = computeEconomics(empty, "apple", inputs, {
      ...options,
      scenario,
    });
    assert.equal(noTrees.treeCount, 0);
    assert.equal(noTrees.investment.trees, 0);
    assert.equal(noTrees.matureRevenue, 0);
    assert(
      noTrees.flows.every((flow) => flow.revenue === 0),
      "No fruit revenue may appear in any year of an empty spatial plan.",
    );
    const support = computeEconomics(empty, "apple", inputs, {
      ...options,
      scenario,
      subsidy: true,
    });
    assert.equal(support.flows[1].revenue, support.subsidyTotal);
    assert(
      support.flows
        .filter((flow) => flow.year !== 1)
        .every((flow) => flow.revenue === 0),
    );
  }
  for (const stale of [
    { ...summary(37), fruit: "pear" },
    { ...summary(37), geometryKey: "foreign-geometry" },
    { ...summary(37), version: "stale-version" },
  ])
    assert.deepEqual(
      computeEconomics(
        { ...area, plantingPlan: stale },
        "apple",
        inputs,
        options,
      ),
      baseline,
      "Foreign fruit, geometry and obsolete versions must not alter this parcel.",
    );
  const rows = area.geometry.coordinates[0];
  const bounds = rows.reduce(
    (b, p) => [
      Math.min(b[0], p[0]),
      Math.min(b[1], p[1]),
      Math.max(b[2], p[0]),
      Math.max(b[3], p[1]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  const mid = (bounds[1] + bounds[3]) / 2;
  const parts = splitGeometryByLine(area.geometry, [
    [bounds[0] - 0.001, mid],
    [bounds[2] + 0.001, mid],
  ]).map((geometry, index) =>
    makeWorkingArea(geometry, `část ${index + 1}`, [area], "split"),
  );
  const generated = (target) => {
    const layout = generatePlantingLayout(target.geometry, settings);
    assert(["ready", "empty"].includes(layout.status), layout.message);
    const plan = appliedPlantingPlan(
      target.geometry,
      "apple",
      settings,
      "custom",
      layout,
    );
    assert(
      plan,
      "A complete actual geometry result must become a geometry-bound summary.",
    );
    const next = { ...target, plantingPlan: plan };
    assert.equal(
      computeEconomics(next, "apple", inputs, options).treeCount,
      layout.trees.length,
    );
    return next;
  };
  const plantedParts = parts.map(generated);
  const merged = generated(
    makeWorkingArea(
      mergeGeometries(parts.map((part) => part.geometry)),
      "spojený sad",
      parts,
      "merge",
    ),
  );
  const wrongInherited = { ...parts[0], plantingPlan: summary(37) };
  assert.equal(
    matchingPlantingPlan(wrongInherited, "apple"),
    undefined,
    "A child must not reuse a parent summary.",
  );
  const byFruit = Object.fromEntries(
    FRUIT_ORDER.map((fruit) => [fruit, economicsForFruit(fruit)]),
  );
  const aggregate = aggregateCategoryScenarios(
    plantedParts,
    {},
    "apple",
    byFruit,
    false,
  );
  assert.equal(aggregate.status, "ready");
  assert.equal(
    aggregate.scenarios[1].totals.treeCount,
    plantedParts.reduce(
      (total, part) => total + part.plantingPlan.treeCount,
      0,
    ),
  );
  assert.equal(
    aggregate.scenarios[1].totals.investment.trees,
    plantedParts.reduce(
      (total, part) =>
        total +
        computeEconomics(part, "apple", inputs, options).investment.trees,
      0,
    ),
  );
  assert.equal(
    computeEconomics(merged, "apple", inputs, options).treeCount,
    merged.plantingPlan.treeCount,
  );
  assert.equal(
    JSON.stringify(area),
    original,
    "Economic integration must not mutate actual source geometry or inputs.",
  );
  const noop = () => {};
  const ranking = Object.fromEntries(
    FRUIT_ORDER.map((fruit) => [fruit, scoreRegionalArea(planned, fruit)]),
  );
  const recommendation = renderToStaticMarkup(
    createElement(RecommendationPanel, {
      area: planned,
      areaHa: areaHa(area.geometry),
      fruit: "apple",
      onFruitChange: noop,
      irrigation: false,
      ranking,
      inputs,
      onInputsChange: noop,
    }),
  );
  assert.match(recommendation, /Počet stromů podle geometrie/);
  assert.match(recommendation, /37 ks/);
  assert.equal(
    [...recommendation.matchAll(/disabled=""/g)].length,
    3,
    "Legacy spacing/share controls must not edit an applied geometry plan.",
  );
  const economicsHtml = renderToStaticMarkup(
    createElement(EconomicsPanel, {
      area: planned,
      areaHa: areaHa(area.geometry),
      fruit: "apple",
      inputs,
      irrigation: false,
      onChange: noop,
      onIrrigationChange: noop,
      onReset: noop,
    }),
  );
  assert.match(economicsHtml, /stromů z geometrického plánu/);
  assert.match(economicsHtml, /samostatný uživatelský předpoklad/);
  const inputCard =
    /<details[^>]*aria-label="Scénář vašeho pozemku"[^>]*>(.*?)<\/details>/s.exec(
      economicsHtml,
    );
  const outputCard =
    /<details[^>]*aria-label="Modelový výsledek pro jabloň"[^>]*>(.*?)<\/details>/s.exec(
      economicsHtml,
    );
  assert(
    inputCard && outputCard,
    "Editable assumptions and calculated outputs must have independently named panels.",
  );
  assert(
    inputCard.index + inputCard[0].length <= outputCard.index,
    "Opening a calculated result must not be required to reach scenario inputs.",
  );
  assert.match(inputCard[1], /<input[^>]*type="number"/);
  assert(
    !/<input\b/.test(outputCard[1]),
    "The result panel contains metrics and charts, not editable scenario fields.",
  );
  assert(!/^<details[^>]*\bopen\b/.test(inputCard[0]));
  assert(
    !/^<details[^>]*\bopen\b/.test(outputCard[0]),
    "The complete calculated result remains initially collapsed.",
  );
  assert.equal(
    economicsHtml.replace(/<[^>]+>/g, "").split("Modelový výsledek pro jabloň")
      .length - 1,
    1,
    "The visible result heading is not repeated inside its card.",
  );
  console.log(
    JSON.stringify({
      checks: "OK",
      originalTrees: baseline.treeCount,
      appliedTrees: result.treeCount,
      actualGeometryCost: true,
      emptyPlanHasNoFruitRevenue: true,
      noInventedYield: true,
      staleSummaryRejected: true,
      splitAndMergeCounts: true,
      categoryTotals: true,
      legacyControlsDisabled: true,
      separateInputsAndResults: true,
    }),
  );
} finally {
  await server.close();
}
