import { COVERAGE_STYLES, type CoverageState } from '../lib/parcelCoverage';
import type { ParcelCoverageLayer } from '../lib/useParcelCoverage';
import './data-coverage.css';

/** The explanation belongs beside its layer switch, never over the main map. */
export default function DataCoverageLegend({ layer, enabled = true }: {
  layer: ParcelCoverageLayer;
  enabled?: boolean;
}) {
  const states = Object.keys(COVERAGE_STYLES) as CoverageState[];
  const total = states.reduce((sum, state) => sum + layer.counts[state], 0);
  return (
    <details className="coverage-filter-info">
      <summary>Barvy a automatické ověřování dat</summary>
      <p>
        Dostupnost se ověřuje automaticky pro zobrazené parcely. Pozemek není
        potřeba přidávat. Barva vyjadřuje dostupnost podkladů, nikoli vhodnost sadu.
      </p>
      <ul className="coverage-filter-key">
        {states.map(state => (
          <li key={state}>
            <i className="coverage-dot" style={{ background: COVERAGE_STYLES[state].color }} aria-hidden="true" />
            <span>{COVERAGE_STYLES[state].label}</span>
            {enabled && total > 0 && <strong>{layer.counts[state]}</strong>}
          </li>
        ))}
      </ul>
      <p className={`coverage-filter-status${layer.status === 'error' ? ' is-error' : ''}`} role="status">
        {enabled ? layer.message : 'Barevná vrstva je vypnutá. Zapnutím spustíte ověření podkladů ve výřezu.'}
      </p>
      <p>
        Zelená vyžaduje alespoň 80 % hodnotitelné BPEJ a 15 úplných klimatických let
        pro půdu, klima a vláhu. Šedá znamená dosud neověřeno; chyba zdroje není
        potvrzený nedostatek dat. Při dosažení limitu klimatického API zůstávají
        ověřené parcely beze změny; ostatní čekají v neutrální šedé barvě.
      </p>
      <p>
        Od přiblížení 14, nejvýše 200 parcel v pohledu do 8 km úhlopříčky.
        {layer.truncated && ' Výřez je omezený; přibližte mapu pro další parcely.'}
        {' '}Půdní rozbor, mikroklima, záplavy a právní podmínky je třeba ověřit zvlášť.
      </p>
    </details>
  );
}
