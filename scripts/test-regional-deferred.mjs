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
  const { geometryKey, representativePoint, soilSummary, distanceKm } =
    await server.ssrLoadModule("/src/lib/regionalData.ts");
  const { scoreRegionalArea } = await server.ssrLoadModule(
    "/src/lib/regionalScoring.ts",
  );
  const { parcelArea } = await server.ssrLoadModule("/src/lib/openData.ts");
  const { FRUIT_ORDER, economicsForFruit } = await server.ssrLoadModule(
    "/src/data/fruitProfiles.ts",
  );
  const { AnalysisDataStatus, VerdictBadge } = await server.ssrLoadModule(
    "/src/components/ui.tsx",
  );
  const { default: RegionalPanel } = await server.ssrLoadModule(
    "/src/components/RegionalPanel.tsx",
  );
  const { default: ManualInputsPanel } = await server.ssrLoadModule(
    "/src/components/ManualInputsPanel.tsx",
  );
  const { default: AreaDetail } = await server.ssrLoadModule(
    "/src/components/AreaDetail.tsx",
  );
  const parcels = JSON.parse(
    await readFile(
      new URL("../public/data/locations/demo-d-parcels.json", import.meta.url),
      "utf8",
    ),
  );
  const snapshot = JSON.parse(
    await readFile(
      new URL("../public/data/locations/demo-d.json", import.meta.url),
      "utf8",
    ),
  );
  const parcel = parcelArea(
    parcels.features.find(
      (feature) => String(feature.properties.id) === "1245682735",
    ),
  );
  const point = representativePoint(parcel.geometry);
  const complete = {
    key: geometryKey(parcel.geometry),
    fetchedAt: new Date().toISOString(),
    source: "snapshot",
    point,
    soil: soilSummary(parcel.geometry, snapshot.layers.bpej),
    climate: {
      ...snapshot.climate,
      distanceKm: distanceKm(point, snapshot.climate.grid),
    },
    errors: [],
  };
  const waiting = {
    ...complete,
    climate: null,
    deferred: {
      source: "climate",
      kind: "rate-limit",
      retryAt: Date.now() + 120000,
      message:
        "Na klimatická data čekáme do uvolnění dočasného limitu poskytovatele.",
    },
  };
  const area = { ...parcel, regional: { status: "ready", data: waiting } };
  const original = JSON.stringify(waiting);
  const result = scoreRegionalArea(area, "apple");
  assert.equal(result.dataStatus, "deferred");
  assert.equal(result.verdict, "Čeká na klimatická data");
  assert.equal(result.dataMessage, waiting.deferred.message);
  assert.equal(result.overall, null);
  assert.equal(result.verdictClass, "nodata");
  assert.equal(
    result.categories.find((category) => category.key === "soil").score,
    90,
  );
  for (const key of ["climate", "water"]) {
    const category = result.categories.find((category) => category.key === key);
    assert.equal(category.score, null);
    assert.equal(category.summary, waiting.deferred.message);
  }
  assert(
    !result.risks.some((risk) => risk.label === "Nedostupný podklad"),
    "The provider quota is a deferred observation, not a reported source failure.",
  );
  assert.equal(JSON.stringify(waiting), original);

  const partialManual = scoreRegionalArea(
    { ...area, manualInputs: { rainfallMm: 650 } },
    "apple",
  );
  assert.equal(partialManual.dataStatus, "deferred");
  assert.equal(partialManual.overall, null);
  assert.equal(partialManual.dataMessage, waiting.deferred.message);
  const manualClimate = {
    temperatureMeanC: 9,
    rainfallMm: 650,
    et0Mm: 600,
    springFrostDays: 12,
    summerDays: 40,
  };
  const manualReady = scoreRegionalArea(
    { ...area, manualInputs: manualClimate },
    "apple",
  );
  assert.equal(manualReady.dataStatus, "ready");
  assert.notEqual(manualReady.overall, null);
  assert.notEqual(
    manualReady.dataMessage,
    waiting.deferred.message,
    "A complete explicit manual scenario has priority over waiting for an external source.",
  );
  const bpejError = scoreRegionalArea(
    {
      ...area,
      regional: {
        status: "ready",
        data: { ...waiting, soil: null, errors: ["BPEJ: HTTP 503"] },
      },
    },
    "apple",
  );
  assert.equal(bpejError.dataStatus, "error");
  assert.equal(bpejError.overall, null);
  assert.equal(
    bpejError.verdict,
    "Chyba načítání",
    "A real BPEJ failure must remain an error even while climate is deferred.",
  );
  const mismatch = scoreRegionalArea(
    {
      ...area,
      regional: {
        status: "ready",
        data: { ...waiting, key: "another-parcel" },
      },
    },
    "apple",
  );
  assert.equal(mismatch.dataStatus, "error");
  assert.equal(mismatch.overall, null);
  const completed = scoreRegionalArea(
    {
      ...area,
      regional: {
        status: "ready",
        data: { ...waiting, climate: complete.climate },
      },
    },
    "apple",
  );
  assert.equal(completed.dataStatus, "ready");
  assert.equal(
    completed.overall,
    79,
    "Stale waiting metadata must not suppress actual complete climate.",
  );
  const insufficient = scoreRegionalArea(
    {
      ...area,
      regional: {
        status: "ready",
        data: {
          ...complete,
          climate: {
            ...complete.climate,
            years: complete.climate.years.slice(0, 14),
          },
        },
      },
    },
    "apple",
  );
  assert.equal(insufficient.dataStatus, "insufficient");
  assert.equal(insufficient.overall, null);

  const noop = () => {};
  const status = renderToStaticMarkup(
    createElement(AnalysisDataStatus, { score: result, onComplete: noop }),
  );
  assert.match(status, /analysis-data-status deferred/);
  assert.match(status, /role="status"/);
  assert(!status.includes("needs-input"));
  assert(!status.includes("Doplnit chybějící údaje"));
  assert(!status.includes('role="alert"'));
  assert(status.includes(waiting.deferred.message));
  const badge = renderToStaticMarkup(
    createElement(VerdictBadge, {
      verdictClass: result.verdictClass,
      verdict: result.verdict,
    }),
  );
  assert.match(badge, /tabler-icon-clock/);
  assert(!badge.includes("badge risk"));
  const dataHtml = renderToStaticMarkup(
    createElement(RegionalPanel, {
      area,
      fruit: "apple",
      onEconomicsChange: noop,
      onRetry: noop,
    }),
  );
  assert.match(dataHtml, /climate-deferred-note/);
  assert.match(dataHtml, /Čekání na klimatická data/);
  assert(
    !dataHtml.includes("Zdroj nedostupný."),
    "A quota must not be described as confirmed source unavailability.",
  );
  assert(!dataHtml.includes("notice error"));
  const manualHtml = renderToStaticMarkup(
    createElement(ManualInputsPanel, { area, score: result, onChange: noop }),
  );
  assert(!/<details[^>]*needs-input/.test(manualHtml));
  assert(
    !/<details[^>]*open=""/.test(manualHtml),
    "A temporary provider limit must not force the missing-data wizard open.",
  );
  assert.equal(
    (manualHtml.match(/data-manual-needed="true"/g) ?? []).length,
    0,
  );
  assert.equal(
    (manualHtml.match(/Čeká na klimatický podklad/g) ?? []).length,
    5,
  );
  const ranking = Object.fromEntries(
    FRUIT_ORDER.map((fruit) => [fruit, scoreRegionalArea(area, fruit)]),
  );
  const fullHtml = renderToStaticMarkup(
    createElement(AreaDetail, {
      area,
      score: result,
      ranking,
      fruit: "apple",
      onFruitChange: noop,
      irrigation: false,
      onIrrigationChange: noop,
      economicsInputs: economicsForFruit("apple"),
      onEconomicsChange: noop,
      onResetEconomics: noop,
      selectedCount: 1,
      tab: "prehled",
      onTabChange: noop,
      onOpenProvenance: noop,
      onOpenCompare: noop,
      onRetryData: noop,
      onManualChange: noop,
    }),
  );
  assert(fullHtml.includes("Čeká na klimatická data"));
  assert(!fullHtml.includes("Doplňte podklady pro hodnocení"));
  assert.match(
    fullHtml,
    /class="meter neutral"/,
    "Temporarily deferred completeness uses a neutral meter instead of a red failure meter.",
  );
  assert(
    !/badge nodata[^>]*>chybí</.test(fullHtml),
    "Deferred climate and water category badges must show waiting, not missing.",
  );
  console.log(
    JSON.stringify({
      checks: "OK",
      quotaIsNeutralDeferred: true,
      noFavorableMissingScore: true,
      soilPreserved: true,
      manualReadyHasPriority: true,
      realBpejErrorPreserved: true,
      mismatchedGeometryRejected: true,
      completeClimateRestores79: true,
      trueInsufficiencyPreserved: true,
      neutralStatusAndDataUi: true,
      manualWizardNotForced: true,
    }),
  );
} finally {
  await server.close();
}
