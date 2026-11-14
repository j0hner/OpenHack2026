import assert from "node:assert/strict";
import { createServer } from "vite";
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});
const originalFetch = globalThis.fetch;
try {
  const {
    parcelEligibility,
    eligibleParcels,
    ELIGIBLE_LAND_USE_CODES,
    ParcelEligibilityError,
  } = await server.ssrLoadModule("/src/lib/parcelEligibility.ts");
  const square = (x, y) => ({
    type: "Polygon",
    coordinates: [
      [
        [x, y],
        [x + 0.001, y],
        [x + 0.001, y + 0.001],
        [x, y + 0.001],
        [x, y],
      ],
    ],
  });
  const feature = (code, extra = {}) => ({
    type: "Feature",
    properties: {
      id: 123,
      cisloparcely: "123/4",
      druhpozemkukod: code,
      katastralniuzemi: 604038,
      ...extra,
    },
    geometry: square(15, 50),
  });
  for (const code of ELIGIBLE_LAND_USE_CODES) {
    assert(parcelEligibility(feature(Number(code))).allowed, code);
    assert(parcelEligibility(feature(code)).allowed, code);
  }
  for (const code of [10, 11, 13, 14, 0, 99, null, undefined, ""])
    assert.equal(parcelEligibility(feature(code)).allowed, false, String(code));
  assert.match(
    parcelEligibility(feature(14, { zpusobyvyuzitipozemku: 16 })).reason,
    /silnice/,
  );
  assert.match(parcelEligibility(feature(14)).reason, /Ostatní plochy/);
  assert.match(parcelEligibility(feature(null)).reason, /spolehlivě/);
  assert(parcelEligibility({ landUse: "trvalý travní porost" }).allowed);
  assert.equal(parcelEligibility({ landUse: "lesní pozemek" }).allowed, false);
  assert.equal(
    parcelEligibility({ landUse: "pracovní vymezení" }).allowed,
    false,
  );
  assert.deepEqual(
    eligibleParcels([feature(10), feature(2)]).map(
      (f) => f.properties.druhpozemkukod,
    ),
    [2],
  );
  assert.throws(() => eligibleParcels([feature(11)]), ParcelEligibilityError);
  assert.deepEqual(eligibleParcels([]), []);

  const localFeatures = [
    feature(2),
    { ...feature(10), geometry: square(15.002, 50) },
  ];
  let liveResponse = {
    type: "FeatureCollection",
    features: [feature(14, { zpusobyvyuzitipozemku: 16 })],
  };
  let liveURL = "";
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("locations-index.json"))
      return new Response(
        JSON.stringify([
          {
            id: "fixture",
            bounds: [15, 50, 15.01, 50.01],
            parcelsFile: "test-parcels.json",
          },
        ]),
      );
    if (url.endsWith("test-parcels.json"))
      return new Response(
        JSON.stringify({ type: "FeatureCollection", features: localFeatures }),
      );
    liveURL = url;
    return new Response(JSON.stringify(liveResponse));
  };
  const { queryParcels } = await server.ssrLoadModule("/src/lib/openData.ts");
  assert.equal((await queryParcels([15.0005, 50.0005])).length, 1);
  await assert.rejects(() => queryParcels([15.0025, 50.0005]), /Lesní/);
  await assert.rejects(() => queryParcels([16, 49]), /silnice/);
  assert(
    new URL(liveURL).searchParams
      .get("outFields")
      .includes("zpusobyvyuzitipozemku"),
  );
  liveResponse = { type: "FeatureCollection", features: [feature(8)] };
  assert.equal((await queryParcels([16, 49]))[0].properties.druhpozemkukod, 8);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => queryParcels([15.0005, 50.0005], controller.signal),
    { name: "AbortError" },
  );
  console.log(
    JSON.stringify({
      checks: "OK",
      allowedCodes: ELIGIBLE_LAND_USE_CODES,
      blocked: "forest/water/buildings/other-roads/unknown",
      cachedAndLive: true,
      abort: true,
    }),
  );
} finally {
  globalThis.fetch = originalFetch;
  await server.close();
}
