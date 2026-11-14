import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom" });
try {
  const { FRUIT_ORDER } = await server.ssrLoadModule("/src/data/fruitProfiles.ts");
  const { getPlantingProfiles, getPlantingProfile, getDefaultPlantingSettings, PLANTING_SOURCE } = await server.ssrLoadModule("/src/data/plantingProfiles.ts");
  const { normalizePlantingSettings, generatePlantingLayout } = await server.ssrLoadModule("/src/lib/plantingGeometry.ts");
  const { appliedPlantingPlan } = await server.ssrLoadModule("/src/lib/plantingPlan.ts");
  const { parcelArea } = await server.ssrLoadModule("/src/lib/openData.ts");
  const { default: Panel } = await server.ssrLoadModule("/src/components/PlantingPlanPanel.tsx");
  const ids = new Set();
  for (const fruit of FRUIT_ORDER) {
    const profiles = getPlantingProfiles(fruit), defaults = getDefaultPlantingSettings(fruit);
    assert(profiles.length > 0, "Every supported fruit needs a published-type profile.");
    assert.deepEqual(normalizePlantingSettings(defaults), defaults, "A displayed default must be accepted by the geometry engine.");
    for (const profile of profiles) {
      assert(!ids.has(profile.id)); ids.add(profile.id);
      assert(profile.rowSpacingM >= profile.rowRange[0] && profile.rowSpacingM <= profile.rowRange[1]);
      assert(profile.treeSpacingM >= profile.treeRange[0] && profile.treeSpacingM <= profile.treeRange[1]);
      assert(profile.rowSpacingM >= profile.treeSpacingM);
      assert.equal(getPlantingProfile(fruit, profile.id), profile);
      assert(normalizePlantingSettings({ ...defaults, rowSpacingM: profile.rowSpacingM, treeSpacingM: profile.treeSpacingM }));
    }
  }
  assert.match(PLANTING_SOURCE.url, /^https:\/\/web2\.mendelu\.cz\//);
  const parcels = JSON.parse(await readFile(new URL("../public/data/locations/demo-d-parcels.json", import.meta.url), "utf8"));
  const area = parcelArea(parcels.features.find(feature => String(feature.properties.id) === "1245682735"));
  const settings = { ...getDefaultPlantingSettings("apple"), orientation: "manual", bearingDeg: 0 };
  const layout = generatePlantingLayout(area.geometry, settings);
  assert.equal(layout.status, "ready");
  const applied = appliedPlantingPlan(area.geometry, "apple", settings, getPlantingProfiles("apple")[0].id, layout);
  assert(applied);
  const noop = () => {};
  const props = { area, fruit: "apple", applied, layout, busy: false, error: "", onGenerate: noop, onClear: noop, onShowMap: noop, showOnMap: true, onVisibilityChange: noop };
  const html = renderToStaticMarkup(createElement(Panel, props));
  assert(html.includes("Rozmístění stromů") && html.includes("Úseky řad") && html.includes("GeoJSON"));
  assert(html.includes(PLANTING_SOURCE.url.replaceAll("&", "&amp;")));
  assert(!html.includes("Změněné hodnoty zatím"), "A fresh applied plan cannot look dirty merely because object keys have a different order.");
  assert(html.includes("ne geodetické vytyčení"));
  const busy = renderToStaticMarkup(createElement(Panel, { ...props, busy: true }));
  assert.match(busy, /type="submit" disabled=""/);
  assert(busy.includes("Počítám rozmístění"));
  const emptySettings = { ...settings, rowSpacingM: 50, treeSpacingM: 50, edgeClearanceM: 50, headlandM: 50 };
  const empty = generatePlantingLayout(area.geometry, emptySettings);
  assert.equal(empty.status, "empty");
  const emptyApplied = appliedPlantingPlan(area.geometry, "apple", emptySettings, applied.profileId, empty);
  const emptyHtml = renderToStaticMarkup(createElement(Panel, { ...props, applied: emptyApplied, layout: empty }));
  assert(emptyHtml.includes("nevejde žádný strom"));
  assert(!emptyHtml.includes("Zobrazit stromy a řady v mapě"));
  console.log(JSON.stringify({ checks: "OK", supportedFruits: FRUIT_ORDER.length, profileCount: ids.size, defaultsWithinPublishedRanges: true, engineCompatibleSettings: true, actualParcelTrees: layout.trees.length, freshlyAppliedNotDirty: true, busyAndEmptyStates: true, sourceVisible: true }));
} finally { await server.close(); }
