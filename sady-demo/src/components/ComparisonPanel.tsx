import { FRUITS } from '../data/fruitProfiles';
import { computeEconomics, computeTreeCount } from '../lib/economics';
import { areaHa } from '../lib/geo';
import { fmtHa, fmtInt, fmtKcShort } from '../lib/format';
import type { AnalysisArea, EconomicsInputs, FruitKey, SuitabilityResult } from '../lib/types';
import { VerdictBadge } from './ui';

interface Props {
  areas: AnalysisArea[];
  scores: Record<string, SuitabilityResult | undefined>;
  fruit: FruitKey;
  irrigation: boolean;
  inputs: EconomicsInputs;
  unionHa: number;
  sumHa: number;
  onSelectArea: (id: string) => void;
  onRemoveArea: (id: string) => void;
  onClearSelection: () => void;
  onAddSamples: () => void;
  onOpenAnalysis: () => void;
  onOpenDetail: (id: string) => void;
}

export default function ComparisonPanel({
  areas,
  scores,
  fruit,
  irrigation,
  inputs,
  unionHa,
  sumHa,
  onSelectArea,
  onRemoveArea,
  onClearSelection,
  onAddSamples,
  onOpenAnalysis,
  onOpenDetail,
}: Props) {
  const profile = FRUITS[fruit];
  const overlap = Math.max(0, sumHa - unionHa);

  if (areas.length < 2) {
    return (
      <div className="empty-state">
        <div className="empty-icon" aria-hidden="true">
          ⚖
        </div>
        <div className="empty-title">Porovnání potřebuje alespoň dvě plochy</div>
        <p className="empty-text">
          Vyberte plochy v seznamu nebo v mapě. Porovnat lze až čtyři pozemky vedle sebe – výměru, vhodnost pro
          stejný druh, rizika, doporučenou výsadbu i ekonomiku.
        </p>
        <button type="button" className="btn primary" onClick={onAddSamples}>
          Přidat ukázky A, B a C
        </button>
        <button type="button" className="btn" onClick={onOpenAnalysis}>
          Zpět na mapovou analýzu
        </button>
        {areas.length === 1 && (
          <p className="tiny muted">Ve výběru je 1 plocha: {areas[0].name}.</p>
        )}
      </div>
    );
  }

  const shown = areas.slice(0, 4);

  return (
    <div>
      <div className="area-header" style={{ marginBottom: 12 }}>
        <div className="eyebrow">
          Porovnání <span className="badge q-demo">model {profile.nameGenitive}</span>
        </div>
        <h2 className="area-title">Srovnání {shown.length} ploch</h2>
        <div className="area-loc">
          Stejný ovocný druh, stejné ekonomické vstupy. Společná výměra je počítaná bez dvojího započtení překryvů.
        </div>
        <div className="area-stats">
          <span className="stat-chip">
            Společná výměra <b>{fmtHa(unionHa)}</b>
          </span>
          <span className="stat-chip">
            Součet výměr <b>{fmtHa(sumHa)}</b>
          </span>
          <span className="stat-chip">
            Překryvy <b>{overlap > 0.0001 ? fmtHa(overlap) : 'žádné'}</b>
          </span>
          <span className="stat-chip">
            Závlaha <b>{irrigation ? 'modelována' : 'ne'}</b>
          </span>
        </div>
        <div className="link-row" style={{ marginTop: 9 }}>
          <button type="button" className="link-button" onClick={onOpenAnalysis}>
            ← Zpět na analýzu
          </button>
          <button type="button" className="link-button" onClick={onAddSamples}>
            Doplňit ukázky A–C
          </button>
          <button type="button" className="link-button" onClick={onClearSelection}>
            Zrušit výběr
          </button>
        </div>
      </div>

      {areas.length > 4 && (
        <div className="notice warn" style={{ marginBottom: 10 }}>
          Ve výběru je {areas.length} ploch, tabulka zobrazuje první čtyři. Ostatní zůstávají vybrané a jejich
          výsledky najdete po otevření detailu.
        </div>
      )}

      <div className="scroll-x card" style={{ padding: 0 }}>
        <table className="compare-table">
          <thead>
            <tr>
              <th>Ukazatel</th>
              {shown.map((area) => (
                <th key={area.id}>
                  <div className="compare-head-name">
                    {area.tag ? `${area.tag} · ` : ''}
                    {area.name.replace('Ukázková plocha ', '')}
                  </div>
                  <div className="compare-head-meta">
                    {area.location.katastr} · {area.location.okres}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                    <button type="button" className="link-button" onClick={() => onOpenDetail(area.id)}>
                      Detail
                    </button>
                    <button type="button" className="link-button" onClick={() => onRemoveArea(area.id)}>
                      Odebrat
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Výměra</th>
              {shown.map((area) => (
                <td key={area.id}>{fmtHa(areaHa(area.geometry))}</td>
              ))}
            </tr>
            <tr>
              <th>Vhodnost pro {profile.name.toLowerCase()}</th>
              {shown.map((area) => {
                const score = scores[area.id];
                return (
                  <td key={area.id}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {score?.overall != null ? <b>{score.overall}/100</b> : <b>—</b>}
                      <VerdictBadge
                        verdictClass={score?.verdictClass ?? 'nodata'}
                        verdict={score?.verdict ?? 'Nedostatek dat'}
                      />
                    </div>
                  </td>
                );
              })}
            </tr>
            <tr>
              <th>Půda / klima / vláha</th>
              {shown.map((area) => {
                const score = scores[area.id];
                const find = (key: string) => score?.categories.find((category) => category.key === key)?.score;
                const text = (value: number | null | undefined) => (value != null ? `${value}` : '—');
                return (
                  <td key={area.id}>
                    {text(find('soil'))} / {text(find('climate'))} / {text(find('water'))}
                    <div className="tiny muted">body 0–100</div>
                  </td>
                );
              })}
            </tr>
            <tr>
              <th>Hlavní rizika</th>
              {shown.map((area) => {
                const score = scores[area.id];
                const top = score?.risks.slice(0, 3).map((risk) => risk.label) ?? [];
                return (
                  <td key={area.id}>
                    {top.length > 0 ? (
                      <ul className="plain-list">
                        {top.map((label) => (
                          <li key={label} className="tiny">
                            • {label}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      '—'
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <th>Doporučená výsadba</th>
              {shown.map((area) => {
                const trees = computeTreeCount(
                  areaHa(area.geometry),
                  inputs.usefulSharePct,
                  inputs.rowSpacingM,
                  inputs.treeSpacingM,
                );
                return (
                  <td key={area.id}>
                    {profile.name}, {inputs.rowSpacingM} × {inputs.treeSpacingM} m
                    <div className="tiny muted">{fmtInt(trees)} stromů při využití {inputs.usefulSharePct} %</div>
                  </td>
                );
              })}
            </tr>
            <tr>
              <th>Investice</th>
              {shown.map((area) => {
                const result = computeEconomics(area, fruit, inputs, {
                  irrigation,
                  subsidy: inputs.subsidy,
                  scenario: { key: 'base', label: 'Základní', yieldFactor: 1, priceFactor: 1, costFactor: 1, note: '' },
                });
                return (
                  <td key={area.id}>
                    <b>{fmtKcShort(result.investment.total)}</b>
                    <div className="tiny muted">{fmtInt(result.treeCount)} stromů</div>
                  </td>
                );
              })}
            </tr>
            <tr>
              <th>NPV / návratnost</th>
              {shown.map((area) => {
                const result = computeEconomics(area, fruit, inputs, {
                  irrigation,
                  subsidy: inputs.subsidy,
                  scenario: { key: 'base', label: 'Základní', yieldFactor: 1, priceFactor: 1, costFactor: 1, note: '' },
                });
                return (
                  <td key={area.id}>
                    <b className={result.npv < 0 ? 'warn-text' : ''}>{fmtKcShort(result.npv)}</b>
                    <div className="tiny muted">
                      {result.paybackYear ? `návratnost rok ${result.paybackYear}` : 'v horizontu se nevrátí'}
                    </div>
                  </td>
                );
              })}
            </tr>
            <tr>
              <th>Úplnost dat</th>
              {shown.map((area) => {
                const score = scores[area.id];
                const completeness = score?.completeness ?? 0;
                return (
                  <td key={area.id}>
                    {completeness} %
                    <div className="meter" style={{ marginTop: 4 }}>
                      <span
                        style={{
                          width: `${completeness}%`,
                          background: completeness >= 80 ? '#2f7d4f' : completeness >= 50 ? '#c19a2f' : '#8a8f98',
                        }}
                      />
                    </div>
                  </td>
                );
              })}
            </tr>
            <tr>
              <th>Výsledek</th>
              {shown.map((area) => (
                <td key={area.id}>
                  {area.story}
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {area.kind === 'sample' ? 'Ukázková plocha – geometrie není katastrální parcela.' : 'Vlastní plocha.'}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Jak číst porovnání</div>
        <ul className="plain-list">
          <li className="small" style={{ color: 'var(--ink-soft)' }}>
            • Skóre je orientační shoda podmínek s nároky druhu, nikoli pravděpodobnost úspěchu.
          </li>
          <li className="small" style={{ color: 'var(--ink-soft)' }}>
            • Plocha s nedostatkem zásadních dat nemá skóre – v porovnání to není nula, ale „—“.
          </li>
          <li className="small" style={{ color: 'var(--ink-soft)' }}>
            • Společná výměra {fmtHa(unionHa)} je počítaná sjednocením geometrií, aby se překryvy nezapočítaly dvakrát.
          </li>
          <li className="small" style={{ color: 'var(--ink-soft)' }}>
            • Ekonomika používá stejné vstupy a modelové ceny; rozdíly mezi plochami vznikají z výměry a délky
            oplocení, ne z rozdílné kvality půdy.
          </li>
        </ul>
        <div className="link-row" style={{ marginTop: 10 }}>
          <button type="button" className="btn small" onClick={() => onSelectArea(shown[0].id)}>
            Vybrat první plochu
          </button>
          <button type="button" className="btn small" onClick={onOpenAnalysis}>
            Zpět na analýzu
          </button>
        </div>
      </div>
    </div>
  );
}
