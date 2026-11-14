import { useState } from 'react';
import { ADAPTER_SUMMARY } from '../lib/adapters';
import { DATA_PRINCIPLES, PROVENANCE, QUALITY_LABELS } from '../data/provenance';
import type { DataQuality } from '../lib/types';
import { QualityBadge } from './ui';

const QUALITY_FILTERS: { key: DataQuality | 'all'; label: string }[] = [
  { key: 'all', label: 'Vše' },
  { key: 'real', label: 'Skutečná data' },
  { key: 'assumption', label: 'Modelové předpoklady' },
  { key: 'demo', label: 'Demo data' },
  { key: 'unavailable', label: 'Nedostupné' },
];

export default function ProvenancePanel({ onOpenAnalysis }: { onOpenAnalysis: () => void }) {
  const [filter, setFilter] = useState<DataQuality | 'all'>('all');
  const rows = filter === 'all' ? PROVENANCE : PROVENANCE.filter((row) => row.quality === filter);
  const counts: Record<DataQuality, number> = {
    real: PROVENANCE.filter((row) => row.quality === 'real').length,
    precomputed: PROVENANCE.filter((row) => row.quality === 'precomputed').length,
    assumption: PROVENANCE.filter((row) => row.quality === 'assumption').length,
    demo: PROVENANCE.filter((row) => row.quality === 'demo').length,
    unavailable: PROVENANCE.filter((row) => row.quality === 'unavailable').length,
  };

  return (
    <div className="provenance-panel analysis-section-content">
      <div className="area-header secondary-view-header" style={{ marginBottom: 12 }}>
        <div className="eyebrow">
          Data a nejistoty <span className="badge q-real">transparentnost</span>
        </div>
        <h2 className="area-title">Data, kterým rozumíte</h2>
        <div className="area-loc">
          Moje Sady rozlišují skutečné podklady, modelové předpoklady a ukázkové scénáře. U každého zdroje uvidíte jeho pokrytí i omezení.
        </div>
        <div className="prov-summary" style={{ marginTop: 9 }}>
          <span className="badge q-real">Skutečná data: {counts.real}</span>
          <span className="badge q-assumption">Modelové předpoklady: {counts.assumption}</span>
          <span className="badge q-demo">Demo data: {counts.demo}</span>
          <span className="badge q-unavailable">Nedostupné: {counts.unavailable}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span>Skutečně napojené zdroje</span>
          <span className="hint">bez klíče a backendu</span>
        </div>
        <ul className="plain-list">
          <li className="small" style={{ color: 'var(--ink-soft)' }}>
            <b>Natural Earth 1:50m</b> – lokálně přibalená hranice ČR pro záložní náhled mapy.
          </li>
          <li className="small" style={{ color: 'var(--ink-soft)' }}>
            <b>Eurostat GISCO NUTS 2021</b> – lokálně přibalené orientační hranice 14 krajů.
          </li>
          <li className="small" style={{ color: 'var(--ink-soft)' }}>
            <b>OpenStreetMap a ČÚZK</b> – skutečné mapové podklady a katastrální překryv.
          </li>
          <li className="small" style={{ color: 'var(--ink-soft)' }}>
            <b>ČÚZK / RÚIAN</b> – vyhledávání ve všech 6 254 obcích a městech ČR z přibaleného otevřeného seznamu.
          </li>
        </ul>
        <div className="inline-note">
          Režim Skutečná data počítá regionální index z průniků BPEJ a klimatu ERA5-Land / ERA5. V pěti lokalitách používá připravené výřezy, jinde živé dotazy podle geometrie. AOPK vstupuje do samostatných omezení. ČSÚ poskytuje celostátní ekonomickou referenci. Demo scénáře jsou dostupné odděleně; váhy a agronomické převody jsou orientačními pravidly Moje Sady.
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span>Ukazatele a zdroje</span>
          <span className="hint">{rows.length} položek</span>
        </div>
        <div className="segmented" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
          {QUALITY_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={filter === item.key ? 'active' : ''}
              onClick={() => setFilter(item.key)}
              style={{ flex: '1 0 auto' }}
            >
              {item.label}
              {item.key !== 'all' && ` (${counts[item.key as DataQuality]})`}
            </button>
          ))}
        </div>

        {rows.map((row) => (
          <div className="prov-row" key={row.indicator}>
            <div className="prov-head">
              <div>
                <div className="prov-indicator">{row.indicator}</div>
                <div className="prov-source">{row.source.replace(/\bSADY\b/g,'Moje Sady')}</div>
              </div>
              <QualityBadge quality={row.quality} />
            </div>
            <div className="prov-meta">
              <span>
                <b>Období:</b> {row.period} · <b>Rozlišení / rozsah:</b> {row.resolution}
              </span>
              <span>
                <b>Připojení:</b> {row.connected}
              </span>
            </div>
            {row.note && <div className="prov-note">{row.note.replace(/\bSADY\b/g,'Moje Sady')}</div>}
          </div>
        ))}

        {rows.length === 0 && <div className="notice">Pro tento filtr nejsou žádné položky.</div>}

        <div className="footnote">{QUALITY_LABELS[filter === 'all' ? 'demo' : filter]?.hint}</div>
      </div>

      <div className="card">
        <div className="card-title">Zásady hodnocení</div>
        <ul className="principles">
          {DATA_PRINCIPLES.map((item) => (
            <li key={item}>{item.replace(/\bSADY\b/g,'Moje Sady')}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div className="card-title">Stav datových adaptérů</div>
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rozhraní</th>
                <th>Stav</th>
                <th>Poznámka</th>
              </tr>
            </thead>
            <tbody>
              {ADAPTER_SUMMARY.map((adapter) => (
                <tr key={adapter.name}>
                  <td>{adapter.name.startsWith('Nominatim')?'ČÚZK / RÚIAN – obce a města':adapter.name}</td>
                  <td>
                    <span className={`badge ${adapter.status === 'Napojeno' ? 'good' : 'q-unavailable'}`}>
                      {adapter.status}
                    </span>
                  </td>
                  <td>{adapter.name.startsWith('Nominatim')?'Místní našeptávání z úplného přibaleného seznamu obcí ČR. Při psaní se nevolá externí geokodér.':adapter.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="inline-note">
          Regionální statistika výnosu není měřením konkrétní parcely. Skóre v aplikaci není pravděpodobnost úspěchu a
          podpora není jistý příjem.
        </div>
        <div className="link-row" style={{ marginTop: 10 }}>
          <button type="button" className="btn" onClick={onOpenAnalysis}>
            Zpět na mapovou analýzu
          </button>
        </div>
      </div>
    </div>
  );
}
