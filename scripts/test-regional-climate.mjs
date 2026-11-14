import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
const storageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);
const originalNow = Date.now;
let now = Date.UTC(2026, 10, 14, 12);
Date.now = () => now;
const storage = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
});
const index = JSON.parse(
  await readFile(
    new URL("../public/data/locations-index.json", import.meta.url),
    "utf8",
  ),
);
const entry = index.find((item) => item.id === "demo-d");
assert(entry, "The actual Velké Bílovice climate fixture must exist.");
const snapshot = JSON.parse(
  await readFile(
    new URL("../public/data/" + entry.file, import.meta.url),
    "utf8",
  ),
);
const daily = {
  time: [],
  temperature_2m_mean: [],
  temperature_2m_min: [],
  temperature_2m_max: [],
  precipitation_sum: [],
  et0_fao_evapotranspiration: [],
};
for (
  let day = Date.UTC(2005, 0, 1);
  day < Date.UTC(2025, 0, 1);
  day += 86400000
) {
  daily.time.push(new Date(day).toISOString().slice(0, 10));
  daily.temperature_2m_mean.push(10);
  daily.temperature_2m_min.push(1);
  daily.temperature_2m_max.push(26);
  daily.precipitation_sum.push(2);
  daily.et0_fao_evapotranspiration.push(1);
}
const servers = [],
  requests = [],
  pending = new Set(),
  starts = [];
let behavior = "success",
  temperature = 10,
  active = 0,
  peakActive = 0;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const signal = () => new AbortController().signal;
const deadline = async (promise, label) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(`Timed out: ${label}`)), 3000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
const waitForRequests = (count) =>
  requests.length >= count
    ? Promise.resolve()
    : new Promise((resolve) => starts.push({ count, resolve }));
const releasePending = () => {
  for (const hold of [...pending]) hold.resolve();
};
const freshClient = async () => {
  const server = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: "custom",
  });
  servers.push(server);
  return server.ssrLoadModule("/src/lib/regionalClimate.ts");
};
globalThis.fetch = async (input, options = {}) => {
  const url = String(input),
    file = url.replace(/^\.?\/data\//, "");
  if (file === "locations-index.json") return Response.json([entry]);
  if (file === entry.file) return Response.json(snapshot);
  assert(
    url.startsWith("https://archive-api.open-meteo.com/"),
    `Unexpected source: ${url}`,
  );
  const params = new URL(url).searchParams;
  assert.equal(params.get("models"), "era5");
  assert.equal(params.get("start_date"), "2005-01-01");
  assert.equal(params.get("end_date"), "2024-12-31");
  for (const field of Object.keys(daily).filter((key) => key !== "time"))
    assert(params.get("daily").split(",").includes(field));
  const cell = [
    Number(params.get("longitude")),
    Number(params.get("latitude")),
  ].map((value) => Math.round(value * 4) / 4);
  const request = { cell, signal: options.signal, behavior };
  requests.push(request);
  active++;
  peakActive = Math.max(peakActive, active);
  for (const watcher of [...starts])
    if (requests.length >= watcher.count) {
      starts.splice(starts.indexOf(watcher), 1);
      watcher.resolve();
    }
  try {
    if (behavior === "hold" || behavior === "hold-quota") {
      const hold = deferred();
      pending.add(hold);
      try {
        await hold.promise;
      } finally {
        pending.delete(hold);
      }
    }
    if (request.behavior === "quota" || request.behavior === "hold-quota")
      return Response.json(
        {
          error: true,
          reason:
            "Daily API request limit exceeded. Please try again tomorrow.",
        },
        { status: 429, headers: { "Retry-After": "120" } },
      );
    if (request.behavior === "failure")
      return Response.json(
        { error: true, reason: "Temporary upstream problem" },
        { status: 503 },
      );
    return Response.json({
      longitude: cell[0] + (request.behavior === "wrong-grid" ? 0.25 : 0),
      latitude: cell[1],
      daily: {
        ...daily,
        temperature_2m_mean: daily.time.map(() => temperature),
      },
    });
  } finally {
    active--;
  }
};
try {
  const client = await freshClient();
  assert.equal(client.CLIMATE_STORAGE, "sady-climate-era5-v1");
  assert.deepEqual(client.climateCell([14.61, 50.1]), [14.5, 50]);
  const outside = [16.72, 48.93];
  assert(
    outside[0] < entry.bounds[0],
    "The prepared climate reuse case deliberately falls outside its soil bbox.",
  );
  const prepared = await deadline(
    client.loadRegionalClimate(outside, signal()),
    "prepared climate outside bbox",
  );
  assert.equal(
    requests.length,
    0,
    "A matching actual temperature and rainfall cell must not consume the live API quota.",
  );
  assert.match(prepared.model, /ERA5-Land/);
  assert.deepEqual(prepared.grid, snapshot.climate.grid);
  assert.deepEqual(prepared.rainfallGrid, snapshot.climate.rainfallGrid);
  assert.equal(
    prepared.years[0].temperatureMeanC,
    snapshot.climate.years[0].temperatureMeanC,
  );
  assert.equal(
    prepared.years[0].rainfallMm,
    snapshot.climate.years[0].rainfallMm,
  );
  const otherLand = [16.8, 48.93];
  assert.deepEqual(client.climateCell(outside), client.climateCell(otherLand));
  const pure = await deadline(
    client.loadRegionalClimate(otherLand, signal()),
    "same ERA5 cell but different ERA5-Land cell",
  );
  assert.equal(
    requests.length,
    1,
    "Matching the rainfall cell alone cannot justify reusing prepared ERA5-Land temperature.",
  );
  assert.deepEqual(pure.grid, [16.75, 49]);
  assert(!pure.model.includes("ERA5-Land"));
  assert.equal(pure.years[0].temperatureMeanC, 10);
  assert.equal(pure.years.length, 20);

  // Shared work outlives one detached view, while an already aborted subscriber
  // cannot start new network work or cancel a remaining subscriber.
  behavior = "hold";
  const beforeShared = requests.length,
    firstController = new AbortController();
  const first = client.loadRegionalClimate(
    [14.61, 50.1],
    firstController.signal,
  );
  const second = client.loadRegionalClimate([14.62, 50.105], signal());
  const rejectedFirst = assert.rejects(first, { name: "AbortError" });
  await deadline(waitForRequests(beforeShared + 1), "shared climate starts");
  firstController.abort();
  await rejectedFirst;
  assert.equal(requests.length, beforeShared + 1);
  assert.equal(
    requests.at(-1).signal.aborted,
    false,
    "Detaching one subscriber must not abort the shared underlying request.",
  );
  releasePending();
  const remaining = await deadline(
    second,
    "remaining shared climate subscriber",
  );
  assert.deepEqual(remaining.grid, [14.5, 50]);
  assert.equal(
    requests.length,
    beforeShared + 1,
    "Two detail/map subscribers share one actual climate request.",
  );
  const preAborted = new AbortController();
  preAborted.abort();
  await assert.rejects(
    client.loadRegionalClimate([13.5, 50], preAborted.signal),
    { name: "AbortError" },
  );
  assert.equal(requests.length, beforeShared + 1);

  // Four unrelated cells may be queued by maps/details, with one common bound.
  storage.clear();
  const boundedClient = await freshClient();
  const beforeBounded = requests.length;
  peakActive = 0;
  const queued = [13.5, 13.75, 14, 14.25].map((lon) =>
    boundedClient.loadRegionalClimate([lon, 49.5], signal()),
  );
  await deadline(waitForRequests(beforeBounded + 2), "two climate jobs start");
  assert.equal(requests.length, beforeBounded + 2);
  assert.equal(peakActive, 2);
  releasePending();
  await deadline(
    waitForRequests(beforeBounded + 4),
    "queued climate jobs start after slots free",
  );
  releasePending();
  await deadline(Promise.all(queued), "bounded climate jobs complete");
  assert.equal(
    peakActive,
    2,
    "The shared climate client must enforce its global two-request concurrency bound.",
  );

  // Moving away may detach the only subscriber of a not-yet-started cell.
  // Drain the prepared-data microtasks so this third call really reaches the
  // occupied request queue before it is aborted, without a wall-clock sleep.
  storage.clear();
  const detachedClient = await freshClient(),
    detachedBefore = requests.length;
  const occupied = [13.5, 13.75].map((lon) =>
    detachedClient.loadRegionalClimate([lon, 49.75], signal()),
  );
  await deadline(
    waitForRequests(detachedBefore + 2),
    "occupy both climate slots",
  );
  const queuedController = new AbortController();
  const detachedJob = detachedClient.loadRegionalClimate(
    [14, 49.75],
    queuedController.signal,
  );
  const detachedRejected = assert.rejects(detachedJob, { name: "AbortError" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, detachedBefore + 2);
  queuedController.abort();
  await detachedRejected;
  releasePending();
  await deadline(
    Promise.all(occupied),
    "remaining occupied climate jobs finish",
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    requests.length,
    detachedBefore + 2,
    "A queued job with no live subscribers must never consume an API request.",
  );
  behavior = "success";
  await detachedClient.loadRegionalClimate([14, 49.75], signal());
  assert.equal(
    requests.length,
    detachedBefore + 3,
    "A detached queued job must not install a cached failure that blocks a later selection.",
  );

  // Even cells queued before the first quota response must check the common
  // cooldown before starting fetch, not generate a new quota error per cell.
  storage.clear();
  behavior = "hold-quota";
  const queuedQuotaClient = await freshClient(),
    queuedQuotaBefore = requests.length;
  const beforeQuota = [13.5, 13.75, 14, 14.25].map((lon) =>
    queuedQuotaClient.loadRegionalClimate([lon, 50.5], signal()),
  );
  const quotaSettled = Promise.allSettled(beforeQuota);
  await deadline(
    waitForRequests(queuedQuotaBefore + 2),
    "two pre-quota requests start",
  );
  releasePending();
  const blockedQueue = await deadline(
    quotaSettled,
    "pre-quota queued cells reject without fetch",
  );
  assert(
    blockedQueue.every(
      (result) =>
        result.status === "rejected" &&
        /429|limit|kvót/i.test(String(result.reason)),
    ),
  );
  assert.equal(
    requests.length,
    queuedQuotaBefore + 2,
    "Queued cells must not start new requests after an earlier cell receives 429.",
  );

  // A separate module context represents a reloaded page: successful pure ERA5
  // observations survive through localStorage, not through the old module map.
  storage.clear();
  behavior = "success";
  temperature = 11;
  const persistenceClient = await freshClient(),
    persistedPoint = [15.25, 50.5];
  const liveBefore = requests.length;
  const persisted = await persistenceClient.loadRegionalClimate(
    persistedPoint,
    signal(),
  );
  assert.equal(persisted.years[0].temperatureMeanC, 11);
  assert.equal(requests.length, liveBefore + 1);
  assert(
    storage.has(client.CLIMATE_STORAGE),
    "A complete successful observation must enter the climate cache.",
  );
  temperature = 18;
  const reloaded = await freshClient();
  const restored = await reloaded.loadRegionalClimate(persistedPoint, signal());
  assert.equal(restored.years[0].temperatureMeanC, 11);
  assert.equal(requests.length, liveBefore + 1);
  now += 8 * 86400000;
  const expired = await freshClient();
  const renewed = await expired.loadRegionalClimate(persistedPoint, signal());
  assert.equal(renewed.years[0].temperatureMeanC, 18);
  assert.equal(
    requests.length,
    liveBefore + 2,
    "A cache older than seven days must be renewed.",
  );

  // One daily quota response protects all following cells and survives reloads.
  // Explicit refresh is a request to update data, never a bypass of the quota.
  behavior = "quota";
  const quotaBefore = requests.length;
  await assert.rejects(
    deadline(
      expired.loadRegionalClimate([13.5, 50.75], signal()),
      "quota response",
    ),
    /429|limit|kvót/i,
  );
  assert.equal(requests.length, quotaBefore + 1);
  await assert.rejects(
    deadline(
      expired.loadRegionalClimate([13.75, 50.75], signal()),
      "quota blocks another cell",
    ),
    /429|limit|kvót/i,
  );
  await assert.rejects(
    deadline(
      expired.loadRegionalClimate([13.5, 50.75], signal(), true),
      "refresh respects quota",
    ),
    /429|limit|kvót/i,
  );
  const quotaReloaded = await freshClient();
  await assert.rejects(
    deadline(
      quotaReloaded.loadRegionalClimate([14, 50.75], signal()),
      "reloaded quota blocks another cell",
    ),
    /429|limit|kvót/i,
  );
  assert.equal(
    requests.length,
    quotaBefore + 1,
    "A daily quota must not cause a request per parcel, cell, refresh or reload.",
  );
  const cachedDuringQuota = await quotaReloaded.loadRegionalClimate(
    persistedPoint,
    signal(),
  );
  assert.equal(cachedDuringQuota.years[0].temperatureMeanC, 18);
  assert.equal(requests.length, quotaBefore + 1);
  const preparedDuringQuota = await quotaReloaded.loadRegionalClimate(
    outside,
    signal(),
  );
  assert.match(preparedDuringQuota.model, /ERA5-Land/);
  assert.equal(requests.length, quotaBefore + 1);
  now += 119000;
  await assert.rejects(
    quotaReloaded.loadRegionalClimate([14.25, 50.75], signal()),
    /429|limit|kvót/i,
  );
  assert.equal(
    requests.length,
    quotaBefore + 1,
    "Retry-After must remain effective until its actual deadline.",
  );
  now += 2000;
  behavior = "success";
  const afterReset = await freshClient();
  await afterReset.loadRegionalClimate([14, 50.75], signal());
  assert.equal(
    requests.length,
    quotaBefore + 2,
    "After the reset deadline has passed, the protected request may retry.",
  );

  // Transient non-quota failures protect only their own cell for one minute.
  storage.clear();
  behavior = "failure";
  const transient = await freshClient(),
    transientBefore = requests.length;
  await assert.rejects(
    transient.loadRegionalClimate([15, 49.5], signal()),
    /503|zdroj|problem/i,
  );
  behavior = "success";
  await assert.rejects(transient.loadRegionalClimate([15, 49.5], signal()));
  assert.equal(requests.length, transientBefore + 1);
  await transient.loadRegionalClimate([15.25, 49.5], signal());
  assert.equal(
    requests.length,
    transientBefore + 2,
    "A 503 is a per-cell failure, not a false global daily quota.",
  );
  now += 61000;
  await transient.loadRegionalClimate([15, 49.5], signal());
  assert.equal(requests.length, transientBefore + 3);

  // A malformed/wrong grid is never accepted or persisted as valid climate.
  storage.clear();
  behavior = "wrong-grid";
  const wrong = await freshClient(),
    wrongBefore = requests.length,
    wrongPoint = [17.5, 50];
  await assert.rejects(
    wrong.loadRegionalClimate(wrongPoint, signal()),
    /grid|souřadnic|odpovíd/i,
  );
  assert.equal(requests.length, wrongBefore + 1);
  behavior = "success";
  const cleanReload = await freshClient();
  const corrected = await cleanReload.loadRegionalClimate(wrongPoint, signal());
  assert.equal(requests.length, wrongBefore + 2);
  assert.deepEqual(corrected.grid, [17.5, 50]);
  console.log(
    JSON.stringify({
      checks: "OK",
      matchingMixedPreparedCellsOutsideBbox: true,
      differentLandCellNeedsLiveData: true,
      sharedSubscribers: true,
      detachAbort: true,
      globalConcurrency: peakActive,
      detachedQueuedCellNeverFetched: true,
      persistentSuccess: true,
      sevenDayExpiry: true,
      queuedBeforeQuotaProtected: true,
      persistentGlobalQuota: true,
      refreshRespectsQuota: true,
      retryAfterDeadline: true,
      quotaExpiryRetry: true,
      perCellFailureBackoff: true,
      wrongGridNeverCached: true,
    }),
  );
} finally {
  releasePending();
  globalThis.fetch = originalFetch;
  Date.now = originalNow;
  if (storageDescriptor)
    Object.defineProperty(globalThis, "localStorage", storageDescriptor);
  else delete globalThis.localStorage;
  await Promise.all(servers.map((server) => server.close()));
}
