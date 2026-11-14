import { useId, useMemo, useState } from "react";
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsSort,
  IconFilterOff,
  IconSearch,
} from "@tabler/icons-react";
import { FRUITS, FRUIT_ORDER } from "../data/fruitProfiles";
import { fmtHa } from "../lib/format";
import {
  officialParcelNumber,
  showOfficialParcelNumber,
} from "../lib/parcelCategories";
import {
  EMPTY_PARCEL_FILTERS,
  createParcelOverviewRows,
  filterParcelOverviewRows,
  parseParcelOverviewRanges,
  sortParcelOverviewRows,
  type ParcelOverviewFilters,
  type ParcelSortDirection,
  type ParcelSortKey,
} from "../lib/parcelOverview";
import type { AnalysisArea, FruitKey, SuitabilityResult } from "../lib/types";
import "./parcel-overview.css";

export interface ParcelOverviewProps {
  areas: AnalysisArea[];
  fruitForArea: (area: AnalysisArea) => FruitKey;
  scoreForArea: (area: AnalysisArea) => SuitabilityResult;
  onSelect: (id: string) => void;
}
export default function ParcelOverview({
  areas,
  fruitForArea,
  scoreForArea,
  onSelect,
}: ParcelOverviewProps) {
  const id = useId();
  const [filters, setFilters] = useState<ParcelOverviewFilters>({
    ...EMPTY_PARCEL_FILTERS,
  });
  const [sort, setSort] = useState<{
    key: ParcelSortKey;
    direction: ParcelSortDirection;
  }>({ key: "name", direction: "asc" });
  const rows = useMemo(
    () => createParcelOverviewRows(areas, fruitForArea, scoreForArea),
    [areas, fruitForArea, scoreForArea],
  );
  const filtered = useMemo(
    () =>
      sortParcelOverviewRows(
        filterParcelOverviewRows(rows, filters),
        sort.key,
        sort.direction,
      ),
    [rows, filters, sort],
  );
  const rangeError = parseParcelOverviewRanges(filters).error;
  const filteredActive = Object.keys(EMPTY_PARCEL_FILTERS).some(
    (key) =>
      filters[key as keyof ParcelOverviewFilters] !==
      EMPTY_PARCEL_FILTERS[key as keyof ParcelOverviewFilters],
  );
  const change = (patch: Partial<ParcelOverviewFilters>) =>
    setFilters((previous) => ({ ...previous, ...patch }));
  const sortBy = (key: ParcelSortKey) =>
    setSort((previous) => ({
      key,
      direction:
        previous.key === key && previous.direction === "asc" ? "desc" : "asc",
    }));
  const sortHeader = (key: ParcelSortKey, label: string) => {
    const Icon =
      sort.key !== key
        ? IconArrowsSort
        : sort.direction === "asc"
          ? IconArrowUp
          : IconArrowDown;
    return (
      <th
        scope="col"
        aria-sort={
          sort.key === key
            ? sort.direction === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        <button
          type="button"
          className="parcel-sort-button"
          onClick={() => sortBy(key)}
          aria-label={`Seřadit podle ${label.toLocaleLowerCase("cs-CZ")} ${sort.key === key && sort.direction === "asc" ? "sestupně" : "vzestupně"}`}
        >
          {label}
          <Icon size={14} aria-hidden="true" />
        </button>
      </th>
    );
  };
  return (
    <section
      className="parcel-overview"
      aria-label="Přehled a filtrování pozemků"
    >
      <p className="section-description">
        Porovnejte uložené pozemky podle výměry, ovoce a vhodnosti. Kliknutím na
        záhlaví tabulky změníte směr řazení.
      </p>
      <div className="parcel-overview-filters">
        <label className="field overview-search">
          <span className="field-label">Hledat pozemek nebo lokalitu</span>
          <span className="overview-search-input">
            <IconSearch size={16} aria-hidden="true" />
            <input
              type="search"
              value={filters.query}
              onChange={(event) => change({ query: event.target.value })}
              placeholder="Název, parcelní číslo, obec…"
            />
          </span>
        </label>
        <label className="field">
          <span className="field-label">Ovocný druh</span>
          <select
            value={filters.fruit}
            onChange={(event) =>
              change({
                fruit: event.target.value as ParcelOverviewFilters["fruit"],
              })
            }
          >
            <option value="all">Všechny druhy</option>
            {FRUIT_ORDER.map((fruit) => (
              <option key={fruit} value={fruit}>
                {FRUITS[fruit].name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Hodnocení</span>
          <select
            value={filters.rating}
            onChange={(event) =>
              change({
                rating: event.target.value as ParcelOverviewFilters["rating"],
                ...(event.target.value === "unrated"
                  ? { suitabilityMin: "", suitabilityMax: "" }
                  : {}),
              })
            }
          >
            <option value="all">Všechny pozemky</option>
            <option value="rated">Pouze se skóre</option>
            <option value="unrated">Bez hodnocení</option>
          </select>
        </label>
        <fieldset className="overview-range">
          <legend>Výměra (ha)</legend>
          <label>
            <span>Od</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={filters.areaMin}
              onChange={(event) => change({ areaMin: event.target.value })}
              aria-label="Výměra od (ha)"
              placeholder="Bez meze"
              aria-describedby={rangeError ? `${id}-error` : undefined}
            />
          </label>
          <label>
            <span>Do</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={filters.areaMax}
              onChange={(event) => change({ areaMax: event.target.value })}
              aria-label="Výměra do (ha)"
              placeholder="Bez meze"
              aria-describedby={rangeError ? `${id}-error` : undefined}
            />
          </label>
        </fieldset>
        <fieldset className="overview-range">
          <legend>Vhodnost (0–100)</legend>
          <label>
            <span>Od</span>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              inputMode="numeric"
              value={filters.suitabilityMin}
              onChange={(event) =>
                change({ suitabilityMin: event.target.value })
              }
              aria-label="Vhodnost od"
              placeholder="Bez meze"
              disabled={filters.rating === "unrated"}
              aria-describedby={rangeError ? `${id}-error` : undefined}
            />
          </label>
          <label>
            <span>Do</span>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              inputMode="numeric"
              value={filters.suitabilityMax}
              onChange={(event) =>
                change({ suitabilityMax: event.target.value })
              }
              aria-label="Vhodnost do"
              placeholder="Bez meze"
              disabled={filters.rating === "unrated"}
              aria-describedby={rangeError ? `${id}-error` : undefined}
            />
          </label>
        </fieldset>
        <button
          type="button"
          className="btn overview-reset"
          disabled={!filteredActive}
          onClick={() => setFilters({ ...EMPTY_PARCEL_FILTERS })}
        >
          <IconFilterOff size={16} />
          Zrušit filtry
        </button>
      </div>
      {rangeError && (
        <p className="overview-filter-error" id={`${id}-error`} role="alert">
          {rangeError}
        </p>
      )}
      <p className="overview-result-count" role="status">
        Zobrazeno {filtered.length} z {areas.length} pozemků.
        {(filters.suitabilityMin || filters.suitabilityMax) &&
          " Rozmezí vhodnosti zahrnuje pouze pozemky s vypočteným skóre."}
      </p>
      {!filtered.length ? (
        <div className="notice info overview-no-results">
          <strong>
            {areas.length
              ? "Žádný pozemek neodpovídá filtrům"
              : "Zatím nemáte uložené pozemky"}
          </strong>
          <p>
            {rangeError
              ? "Opravte zadané rozmezí nebo zrušte filtry."
              : areas.length
                ? "Změňte podmínky nebo použijte tlačítko Zrušit filtry."
                : "Vyberte zemědělskou parcelu na mapě a přidejte ji do svého seznamu."}
          </p>
        </div>
      ) : (
        <div
          className="plot-table-wrap overview-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Tabulka uložených pozemků"
        >
          <table className="plot-table overview-table">
            <thead>
              <tr>
                {sortHeader("name", "Pozemek")}
                <th scope="col">Lokalita</th>
                {sortHeader("area", "Výměra")}
                {sortHeader("fruit", "Ovocný druh")}
                {sortHeader("suitability", "Vhodnost")}
                <th scope="col">
                  <span className="sr-only">Akce</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.area.id}>
                  <td>
                    <strong>
                      {row.area.name}
                      {showOfficialParcelNumber(row.area) && (
                        <span className="parcel-official-number">
                          {" "}
                          · parc. {officialParcelNumber(row.area)}
                        </span>
                      )}
                    </strong>
                    <small>
                      {row.area.derivedFrom
                        ? "Uživatelská část"
                        : row.area.cadastral
                          ? "Katastrální parcela"
                          : "Uživatelská plocha"}
                    </small>
                  </td>
                  <td className="overview-locality">{row.locality}</td>
                  <td>
                    {row.areaHa === null
                      ? "Výměra neověřená"
                      : fmtHa(row.areaHa)}
                  </td>
                  <td>{FRUITS[row.fruit].name}</td>
                  <td>
                    {row.suitability === null ? (
                      <>
                        <span className="overview-unrated">Bez hodnocení</span>
                        <small>{row.score.verdict}</small>
                      </>
                    ) : (
                      <>
                        <span className={`badge ${row.score.verdictClass}`}>
                          {row.suitability}/100
                        </span>
                        <small>{row.score.verdict}</small>
                      </>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn small"
                      type="button"
                      onClick={() => onSelect(row.area.id)}
                      aria-label={`Otevřít pozemek ${row.area.name}`}
                    >
                      Otevřít
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
