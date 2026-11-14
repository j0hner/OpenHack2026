import { loadLocation, locationIndex } from "./openData";
import {
  aggregateWeather,
  distanceKm,
  type RegionalData,
} from "./regionalData";

type Climate = NonNullable<RegionalData["climate"]>;
type Stored = { at: number; data: Climate };
type Failure = { until: number; message: string };
export const CLIMATE_STORAGE = "sady-climate-era5-v1";
const LIMIT_STORAGE = "sady-climate-limit-v1";
const TTL = 7 * 86400000;
const memory = new Map<string, Stored>();
const pending = new Map<
  string,
  { promise: Promise<Climate>; subscribers: Set<AbortSignal> }
>();
const failures = new Map<string, Failure>();
let providerLimit: Failure | null = null;
let running = 0;
const queue: (() => void)[] = [];
export const climateCell = (point: [number, number]): [number, number] =>
  point.map((value) => Math.round(value * 4) / 4) as [number, number];
const landCell = (point: [number, number]): [number, number] =>
  point.map((value) => Math.round(value * 10) / 10) as [number, number];
// Prepared observations combine two real grids. Grouping only by the coarser
// rain cell would incorrectly copy another ERA5-Land temperature cell.
export const climateCellKey = (point: [number, number]) =>
  `${climateCell(point).join(",")}|${landCell(point).join(",")}`;

function storedClimate(key: string): Stored | null {
  try {
    const list: Stored[] = JSON.parse(
      localStorage.getItem(CLIMATE_STORAGE) ?? "[]",
    );
    return (
      list.find(
        (entry) =>
          valid(entry) && climateCell(entry.data.grid!).join(",") === key,
      ) ?? null
    );
  } catch {
    return null;
  }
}
function valid(entry: Stored) {
  return (
    !!entry &&
    Number.isFinite(entry.at) &&
    Date.now() - entry.at < TTL &&
    entry.data?.model === "ERA5" &&
    entry.data.period === "2005–2024" &&
    Array.isArray(entry.data.grid) &&
    entry.data.grid.length === 2 &&
    entry.data.grid.every(Number.isFinite) &&
    Array.isArray(entry.data.years) &&
    entry.data.years.length === 20
  );
}
function save(entry: Stored) {
  if (memory.size >= 48) memory.delete(memory.keys().next().value!);
  memory.set(climateCell(entry.data.grid!).join(","), entry);
  try {
    const list: Stored[] = JSON.parse(
      localStorage.getItem(CLIMATE_STORAGE) ?? "[]",
    );
    localStorage.setItem(
      CLIMATE_STORAGE,
      JSON.stringify(
        [
          entry,
          ...list.filter(
            (old) =>
              valid(old) &&
              climateCell(old.data.grid!).join(",") !==
                climateCell(entry.data.grid!).join(","),
          ),
        ].slice(0, 48),
      ),
    );
  } catch {
    /* A full/disabled browser store must not prevent analysis. */
  }
}
function currentLimit() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(LIMIT_STORAGE) ?? "null",
    ) as Failure | null;
    if (
      stored &&
      Number.isFinite(stored.until) &&
      typeof stored.message === "string" &&
      (!providerLimit || stored.until > providerLimit.until)
    )
      providerLimit = stored;
  } catch {
    /* Storage is optional. */
  }
  return providerLimit && providerLimit.until > Date.now()
    ? providerLimit
    : null;
}
function limitedMessage(failure: Failure) {
  return `${failure.message} Další pokus po ${new Date(failure.until).toLocaleString("cs-CZ")}. Uložené podklady zůstávají dostupné.`;
}
async function preparedClimate(
  point: [number, number],
): Promise<Climate | null> {
  try {
    const rain = climateCell(point),
      temperature = landCell(point);
    const entries = (await locationIndex()).filter(
      (entry) =>
        distanceKm(climateCell(entry.center), rain) < 1 &&
        distanceKm(landCell(entry.center), temperature) < 1,
    );
    for (const entry of entries) {
      const data = (await loadLocation(entry)).climate;
      if (
        data?.model === "ERA5-Land (teplota) + ERA5 (srážky, ET0)" &&
        data.period === "2005–2024" &&
        data.grid &&
        data.rainfallGrid &&
        distanceKm(data.grid, temperature) < 1 &&
        distanceKm(data.rainfallGrid, rain) < 1 &&
        data.years.length === 20
      )
        return {
          ...data,
          grid: data.grid,
          distanceKm: distanceKm(point, data.grid),
        };
    }
  } catch {
    /* Live provider can still serve areas without prepared files. */
  }
  return null;
}
function subscribe<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
async function request(
  cell: [number, number],
  needed: () => boolean,
): Promise<Climate> {
  // Limits apply across map and detail, including requests queued before a 429.
  if (running >= 2) await new Promise<void>((resolve) => queue.push(resolve));
  else running++;
  try {
    if (!needed()) throw new DOMException("Aborted", "AbortError");
    const limit = currentLimit();
    if (limit) throw Error(limitedMessage(limit));
    const params = new URLSearchParams({
      latitude: String(cell[1]),
      longitude: String(cell[0]),
      models: "era5",
      start_date: "2005-01-01",
      end_date: "2024-12-31",
      daily:
        "temperature_2m_mean,temperature_2m_min,temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration",
      timezone: "Europe/Prague",
      cell_selection: "nearest",
      elevation: "nan",
    });
    const response = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?${params}`,
      { signal: AbortSignal.timeout(25000) },
    );
    const value = await response.json().catch(() => ({}));
    if (response.status === 429) {
      const reason = String(value.reason ?? "");
      const retry = response.headers.get("Retry-After");
      const retryAt = retry
        ? /^\d+$/.test(retry)
          ? Date.now() + Number(retry) * 1000
          : Date.parse(retry)
        : NaN;
      const delay = /daily|tomorrow/i.test(reason)
        ? 86400000
        : /hour/i.test(reason)
          ? 3600000
          : 60000;
      providerLimit = {
        until:
          Number.isFinite(retryAt) && retryAt > Date.now()
            ? retryAt
            : Date.now() + delay,
        message: /daily|tomorrow/i.test(reason)
          ? "Klimatický zdroj vyčerpal denní limit (HTTP 429)."
          : "Klimatický zdroj dočasně omezil požadavky (HTTP 429).",
      };
      try {
        localStorage.setItem(LIMIT_STORAGE, JSON.stringify(providerLimit));
      } catch {
        /* Optional. */
      }
      throw Error(limitedMessage(providerLimit));
    }
    if (!response.ok || value.error)
      throw Error(
        `Klimatický zdroj: HTTP ${response.status}${value.reason ? ` – ${value.reason}` : ""}`,
      );
    if (
      !value.daily ||
      !Array.isArray(value.daily.time) ||
      !Number.isFinite(value.latitude) ||
      !Number.isFinite(value.longitude)
    )
      throw Error("Neúplné klimatické souřadnice nebo řada.");
    const grid: [number, number] = [value.longitude, value.latitude];
    if (distanceKm(grid, cell) > 1)
      throw Error("Odpověď neodpovídá požadovanému gridu ERA5.");
    const data: Climate = {
      years: aggregateWeather(value.daily),
      period: "2005–2024",
      model: "ERA5",
      resolution: "0.25° (~25 km), nikoli mikroklima parcely",
      grid,
      distanceKm: null,
    };
    save({ at: Date.now(), data });
    return data;
  } finally {
    // Transfer this occupied slot directly to a queued job; a new caller cannot
    // steal it before that job's continuation resumes.
    const next = queue.shift();
    if (next) next();
    else running--;
  }
}

/** One shared, bounded ERA5 client for automatic coverage and detailed analysis.
 * A view can detach without cancelling another view's request. */
export async function loadRegionalClimate(
  point: [number, number],
  signal: AbortSignal,
  refresh = false,
): Promise<Climate> {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const prepared = await subscribe(preparedClimate(point), signal);
  if (prepared) return prepared;
  const cell = climateCell(point),
    key = cell.join(",");
  const cached = memory.get(key) ?? storedClimate(key);
  if (!refresh && cached && valid(cached))
    return { ...cached.data, distanceKm: distanceKm(point, cached.data.grid!) };
  const limit = currentLimit();
  if (limit) throw Error(limitedMessage(limit));
  const failed = failures.get(key);
  if (!refresh && failed && failed.until > Date.now())
    throw Error(limitedMessage(failed));
  if (!pending.has(key)) {
    const subscribers = new Set<AbortSignal>([signal]);
    const job = Promise.resolve()
      .then(() =>
        request(cell, () =>
          [...subscribers].some((subscriber) => !subscriber.aborted),
        ),
      )
      .then((data) => {
        failures.delete(key);
        return data;
      })
      .catch((error) => {
        if (
          !currentLimit() &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          if (failures.size >= 48)
            failures.delete(failures.keys().next().value!);
          failures.set(key, {
            until: Date.now() + 60000,
            message:
              error instanceof Error ? error.message : "Klima není dostupné.",
          });
        }
        throw error;
      })
      .finally(() => {
        if (pending.get(key)?.promise === job) pending.delete(key);
      });
    pending.set(key, { promise: job, subscribers });
  }
  const shared = pending.get(key)!;
  shared.subscribers.add(signal);
  try {
    const result = await subscribe(shared.promise, signal);
    return {
      ...result,
      distanceKm: result.grid ? distanceKm(point, result.grid) : null,
    };
  } finally {
    shared.subscribers.delete(signal);
  }
}
