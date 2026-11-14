import { useEffect, useId, useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { COVERAGE_STYLES, type CoverageState } from "../lib/parcelCoverage";
import type { ParcelCoverageLayer } from "../lib/useParcelCoverage";
import "./data-coverage.css";
const states: CoverageState[] = [
  "sufficient",
  "insufficient",
  "unknown",
  "loading",
  "error",
];
export default function DataCoverageLegend({
  layer,
  compact = false,
}: {
  layer: ParcelCoverageLayer;
  compact?: boolean;
}) {
  const id = useId();
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 900px)").matches,
  );
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(
    null,
  );
  const expanded = expandedOverride ?? !(mobile && compact);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  if (layer.status === "off") return null;
  const shownStates = states.filter(
    (state) =>
      state === "sufficient" ||
      state === "insufficient" ||
      state === "unknown" ||
      layer.counts[state] > 0,
  );
  const shortLabels: Record<CoverageState, string> = {
    sufficient: "dostatek",
    insufficient: "nestačí",
    unknown: "neověřeno",
    loading: "načítání",
    error: "chyba",
  };
  const total = states.reduce((sum, state) => sum + layer.counts[state], 0);
  return (
    <aside
      className={`data-coverage-legend ${expanded ? "is-expanded" : "is-collapsed"}`}
      aria-label="Dostupnost dat pro parcely"
    >
      <h3>
        <button
          type="button"
          className="coverage-legend-toggle"
          aria-label={`${expanded ? "Sbalit" : "Rozbalit"} legendu dostupnosti dat`}
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpandedOverride(!expanded)}
        >
          <span>
            Dostupnost dat
            {layer.status === "ready" && <small>{total} parcel</small>}
          </span>
          <IconChevronDown size={17} aria-hidden="true" />
        </button>
      </h3>
      {!expanded && layer.status === "ready" && (
        <p className="coverage-compact-summary" role="status">
          {shownStates.map((state) => (
            <span key={state}>
              <i
                className="coverage-dot"
                style={{ background: COVERAGE_STYLES[state].color }}
              />
              {layer.counts[state]} {shortLabels[state]}
            </span>
          ))}
          {layer.truncated && (
            <span className="coverage-scope-warning">Omezený výřez</span>
          )}
        </p>
      )}
      {!expanded && layer.status !== "ready" && (
        <p
          className={`coverage-status ${layer.status === "error" ? "is-error" : ""}`}
          role="status"
        >
          {layer.status === "loading" ? "Načítám parcely…" : layer.message}
        </p>
      )}
      <div id={id} hidden={!expanded}>
        <p
          className={`coverage-status ${layer.status === "error" ? "is-error" : ""}`}
          role="status"
        >
          {layer.message}
        </p>
        {layer.status === "ready" && (
          <ul className="coverage-counts">
            {states
              .filter(
                (state) =>
                  state === "sufficient" ||
                  state === "insufficient" ||
                  state === "unknown" ||
                  layer.counts[state] > 0,
              )
              .map((state) => (
                <li key={state}>
                  <span
                    className="coverage-dot"
                    style={{ background: COVERAGE_STYLES[state].color }}
                  />
                  <span>{COVERAGE_STYLES[state].label}</span>
                  <strong>{layer.counts[state]}</strong>
                </li>
              ))}
          </ul>
        )}
        <details className="coverage-explanation">
          <summary>Co barvy znamenají</summary>
          <p>
            Zelená znamená podklady pro základní regionální index: alespoň 80 %
            hodnotitelného pokrytí BPEJ a 15 úplných klimatických let. Tři
            kategorie jsou půda, klima a vláha.
          </p>
          <p>
            Šedá znamená dosud neověřeno, nikoli chybějící data. Mimo připravené
            výřezy se podklady ověří až při analýze přidané parcely. Načtení lze
            opakovat vypnutím a zapnutím vrstvy.
          </p>
          <p>
            Vrstva nehodnotí vhodnost sadu. Půdní rozbor, mikroklima, záplavy a
            právní podmínky zůstávají k samostatnému ověření.
          </p>
        </details>
      </div>
    </aside>
  );
}
