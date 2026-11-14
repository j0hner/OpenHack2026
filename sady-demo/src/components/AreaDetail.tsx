import OpenDataPanel from './OpenDataPanel';
import {IconAlertTriangle,IconExternalLink,IconInfoCircle,IconMapPin,IconRulerMeasure} from '@tabler/icons-react';
import { cadastralUrl } from '../lib/openData';
import { FRUITS, FRUIT_ORDER } from '../data/fruitProfiles';
import { PROVENANCE } from '../data/provenance';
import { areaHa, centerOf, perimeterM } from '../lib/geo';
import { fmtHa, fmtM, fmtNum } from '../lib/format';
import type { AnalysisArea, Availability, EconomicsInputs, FruitKey, SuitabilityResult } from '../lib/types';
import EconomicsPanel from './EconomicsPanel';
import RecommendationPanel from './RecommendationPanel';
import { Meter, QualityBadge, ScoreGauge, Toggle, VerdictBadge, severityIcon } from './ui';

export type DetailTab = 'prehled' | 'doporuceni' | 'ekonomika' | 'data';

interface Props {
  onRetryData:()=>void;
  area: AnalysisArea;
  score: SuitabilityResult;
  ranking: Record<FruitKey, SuitabilityResult>;
  fruit: FruitKey;
  onFruitChange: (fruit: FruitKey) => void;
  irrigation: boolean;
  onIrrigationChange: (value: boolean) => void;
  economicsInputs: EconomicsInputs;
  onEconomicsChange: (patch: Partial<EconomicsInputs>) => void;
  onResetEconomics: () => void;
  selectedCount: number;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onOpenProvenance: () => void;
  onOpenCompare: () => void;
}

const AVAILABILITY_LABEL: Record<Availability, string> = {
  complete: 'úplné',
  partial: 'částečné',
  missing: 'chybí',
};

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'prehled', label: 'Přehled' },
  { key: 'doporuceni', label: 'Doporučení' },
  { key: 'ekonomika', label: 'Ekonomika' },
  { key: 'data', label: 'Data a nejistoty' },
];

export default function AreaDetail(props: Props) {
  const { area, score, fruit, tab } = props;
  const profile = FRUITS[fruit];
  const areaSize = areaHa(area.geometry);

  const completenessTone = score.completeness >= 80 ? 'ok' : score.completeness >= 50 ? 'warn' : 'bad';

  return (
    <div className="full-analysis-content">
      <div className="area-header full-analysis-header">
        <div className="eyebrow">
          Detailní analýza
          <span className={`badge ${area.regional?'q-real':'q-demo'}`}>{area.regional?(area.regional.status==='loading'?'Načítám podklady':score.overall===null?'Skutečné podklady · neúplné':'Skutečná data a orientační model'):'Demo scénář'}</span>
        </div>
        <h2 className="area-title">{area.name}</h2>
        <div className="area-loc">
          <IconMapPin size={16} aria-hidden="true" /> {[area.location.obec,area.location.okres].filter(value=>value&&value!=='neurčeno').join(', ')||`Katastrální území ${area.location.katastr}`}
        </div>
        <div className="area-stats">
          <span className="stat-chip"><IconRulerMeasure size={16} aria-hidden="true" /> Výměra <b>{fmtHa(areaSize)}</b></span>
          <span className="stat-chip">
            Využitelné <b>{fmtHa(areaSize * (props.economicsInputs.usefulSharePct / 100))}</b>
          </span>
          <span className="stat-chip">
            Druh pozemku <b>{area.landUse}</b>
          </span>
        </div>
        <label className="field analysis-fruit-select"><span className="field-label">Ovocný druh</span><select value={fruit} onChange={event=>props.onFruitChange(event.target.value as FruitKey)}>{FRUIT_ORDER.map(key=><option key={key} value={key}>{FRUITS[key].name}</option>)}</select></label>
        <details className="analysis-identification">
          <summary><IconInfoCircle size={17} aria-hidden="true" /> Identifikace a původ plochy</summary>
          <dl className="kv">
            <div className="kv-row"><dt>Identifikace</dt><dd>{area.location.code??'Uživatelská plocha'}</dd></div>
            <div className="kv-row"><dt>Obvod</dt><dd>{fmtM(perimeterM(area.geometry))}</dd></div>
            <div className="kv-row"><dt>Poloha</dt><dd>{fmtNum(centerOf(area.geometry)[1],5)}, {fmtNum(centerOf(area.geometry)[0],5)}</dd></div>
          </dl>
          {area.cadastral&&<p className="small">Evidovaná výměra {area.cadastral.officialAreaM2?.toLocaleString('cs-CZ')??'neuvedena'} m². <a className="analysis-external-link" href={cadastralUrl(area.cadastral.id)} target="_blank" rel="noopener noreferrer">Oficiální katastr <IconExternalLink size={15} aria-hidden="true" /></a></p>}
          <p className="small">{area.story}</p><p className="tiny muted">{area.sourceNote}</p>
        </details>
      </div>

      <div className={`verdict-card ${score.verdictClass}`} style={{ marginTop: 12 }}>
        <ScoreGauge
          score={score.overall}
          verdictClass={score.verdictClass}
          verdict={score.verdict}
          caption={score.overall != null ? `Skóre ${score.overall} ze 100 pro druh ${profile.name.toLowerCase()}` : score.verdict}
        />
        <div>
          <div className="verdict-label">{score.verdict}</div>
          <div className="verdict-caption">
            {score.overall != null
              ? `Orientační shoda podmínek pro ${profile.name.toLowerCase()} · skóre není pravděpodobnost úspěchu.${
                  score.verdictClass === 'risk' && score.overall >= 55 && score.categories.some(c=>c.score!==null&&c.score<30)
                    ? ' Výsledek je „Rizikový“, protože některá kategorie klesla pod mezní hodnotu 30 bodů.'
                    : ''
                }`
              : 'Zásadní podklady chybí, proto skóre záměrně nepočítáme.'}
          </div>
          <div className="completeness">
            <div className="link-row" style={{ marginBottom: 3 }}>
              <span className="tiny muted">Úplnost a kvalita podkladů</span>
              <span className="tiny" style={{ fontWeight: 700 }}>
                {score.completeness} %
              </span>
            </div>
            <Meter value={score.completeness} tone={completenessTone as 'ok' | 'warn' | 'bad'} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 9 }}>
        <Toggle
          checked={props.irrigation && area.irrigationAvailable !== false}
          onChange={props.onIrrigationChange}
          label="Modelovat doplňkovou závlahu"
          description={area.regional?'Změní ekonomický scénář. Regionální skóre neměníme bez doloženého zdroje vody.':'Zlepší hodnocení vláhy, zvýší investici i provozní náklady. Modelový předpoklad, ne potvrzení zdroje vody.'}
          disabled={area.irrigationAvailable === false}
        />
        {area.irrigationAvailable === false && (
          <div className="inline-note">Závlaha u této plochy není v demu dostupná (chybí ověřený zdroj vody).</div>
        )}
      </div>

      <div className="tabs" role="tablist" aria-label="Sekce analýzy">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={tab === item.key ? 'active' : ''}
            onClick={() => props.onTabChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        {tab === 'data' && <OpenDataPanel area={area} fruit={fruit} onEconomicsChange={props.onEconomicsChange} onRetry={props.onRetryData} />}
        {tab === 'prehled' && <Overview score={score} area={area} />}
        {tab === 'doporuceni' && (
          <RecommendationPanel
            area={area}
            areaHa={areaSize}
            fruit={fruit}
            onFruitChange={props.onFruitChange}
            irrigation={props.irrigation}
            ranking={props.ranking}
            inputs={props.economicsInputs}
            onInputsChange={props.onEconomicsChange}
          />
        )}
        {tab === 'ekonomika' && (
          <EconomicsPanel
            area={area}
            areaHa={areaSize}
            fruit={fruit}
            inputs={props.economicsInputs}
            irrigation={props.irrigation}
            onChange={props.onEconomicsChange}
            onIrrigationChange={props.onIrrigationChange}
            onReset={props.onResetEconomics}
          />
        )}
        {tab === 'data' && (
          <DataTab area={area} score={score} onOpenProvenance={props.onOpenProvenance} />
        )}
      </div>

      {props.selectedCount > 1 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-title">Porovnání</div>
          <p className="small" style={{ color: 'var(--ink-soft)' }}>
            Ve výběru máte {props.selectedCount} ploch. Výsledky jednotlivých parcel zůstávají zachované; porovnání
            zobrazí společné ukazatele a společné území bez dvojího započtení překryvů.
          </p>
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={props.onOpenCompare}>
            Otevřít porovnání ({props.selectedCount})
          </button>
        </div>
      )}
    </div>
  );
}

function Overview({ score, area }: { score: SuitabilityResult; area: AnalysisArea }) {
  const constraint = area.attributes.constraints;
  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span>Tři hlavní důvody výsledku</span>
          <VerdictBadge verdictClass={score.verdictClass} verdict={score.verdict} />
        </div>
        <ol className="reason-list">
          {score.reasons.map((reason, index) => (
            <li key={reason}>
              <span className="num">{index + 1}</span>
              <span>{reason}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="card">
        <div className="card-title">
          <span>Hlavní rizika</span>
          <span className="hint">závažnost je označena barvou, ikonou i textem</span>
        </div>
        <ul className="risk-list">
          {score.risks.map((risk) => (
            <li key={`${risk.label}-${risk.detail}`} className={risk.severity}>
              <span className="sev" aria-hidden="true">
                {severityIcon(risk.severity)}
              </span>
              <span>
                <b>
                  {risk.label}
                  <span className="badge" style={{ marginLeft: 6, fontWeight: 600 }}>
                    {risk.severity === 'high' ? 'vysoká' : risk.severity === 'medium' ? 'střední' : 'nižší'}
                  </span>
                </b>
                <span className="detail">{risk.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div className="card-title">Doporučené další kroky</div>
        <ol className="step-list">
          {score.nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="card">
        <div className="card-title">
          <span>Územní omezení</span>
          <span className="hint">samostatně od skóre</span>
        </div>
        {score.constraints.length > 0 ? (
          <ul className="risk-list">
            {score.constraints.map((item) => (
              <li key={item.label} className="high">
                <span className="sev" aria-hidden="true">
                  <IconAlertTriangle size={18} />
                </span>
                <span>
                  <b>{item.label}</b>
                  <span className="detail">{item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="notice info">
            {area.regional?(area.regional.data?.protected===null||!area.regional.data?'Ochrana přírody pro tuto plochu není ověřená.':'Ve čtyřech připojených kategoriích AOPK nebyl nalezen průnik. Záplavy Q100 a další právní omezení zůstávají neověřené.'):'V demo podkladech není zjištěný střet. To není potvrzení, že záměr je povolený.'}
          </div>
        )}
        {constraint?.note && <div className="inline-note">{constraint.note}</div>}
      </div>

      <div className="card">
        <div className="card-title">
          <span>Kategorie hodnocení</span>
          <span className="hint">{area.regional?'váhy: půda 35 · klima 40 · vláha 25':'váhy: půda 30 · klima 30 · vláha 20 · terén 10 · provoz 10'}</span>
        </div>
        {score.categories.map((category) => {
          const tone =
            category.score == null ? 'nodata' : category.score >= 75 ? '' : category.score >= 55 ? 'caution' : 'risk';
          return (
            <div className="category-row" key={category.key}>
              <div className="category-head">
                <span className="name">
                  {category.label} <span className="weight">· váha {category.weight} %</span>
                </span>
                <span className="value">
                  {category.score != null ? `${category.score}/100` : '—'}
                  {category.availability !== 'complete' && (
                    <span className="badge nodata" style={{ marginLeft: 5 }}>
                      {AVAILABILITY_LABEL[category.availability]}
                    </span>
                  )}
                </span>
              </div>
              <div className="bar">
                <span className={tone} style={{ width: `${category.score ?? 0}%` }} />
              </div>
              <div className={category.score == null ? 'category-missing' : 'category-summary'}>{category.summary}</div>
            </div>
          );
        })}
        {score.missing.length > 0 && (
          <div className="notice warn" style={{ marginTop: 10 }}>
            <strong>Chybí podklady:</strong> {score.missing.join(', ')}. Chybějící údaje nejsou nahrazené nulou ani
            nízkým rizikem.
          </div>
        )}
        <div className="footnote">
          {area.regional?'Váhy 35 / 40 / 25 jsou orientační pravidla regionálního indexu; nejde o odborně validovanou metodiku.':'Váhy 30 / 30 / 20 / 10 / 10 jsou transparentní návrh pro demo, nikoli odborně validovaná metodika.'}
          Ekonomika, kvalita podkladů a územní kolize se vyhodnocují samostatně.
        </div>
      </div>

      <div className="card">
        <div className="card-title">Předpoklady a nejistoty</div>
        <ul className="plain-list">
          {score.assumptions.map((item) => (
            <li key={item} className="small" style={{ color: 'var(--ink-soft)' }}>
              {item.replace(/\bSADY\b/g,'Moje Sady')}
            </li>
          ))}
          <li className="small" style={{ color: 'var(--ink-soft)' }}>
            Druh pozemku ({area.landUse}) sám o sobě neznamená, že je výsadba sadu povolená.
          </li>
        </ul>
      </div>
    </div>
  );
}

function DataTab({
  area,
  score,
  onOpenProvenance,
}: {
  area: AnalysisArea;
  score: SuitabilityResult;
  onOpenProvenance: () => void;
}) {
  if(area.regional)return <div className="card"><strong>Podklady pro tuto plochu jsou vypsané výše.</strong><p className="small">{score.categories.map(c=>`${c.label}: ${c.score===null?'nedostupné':c.score+'/100 (částečné podklady)'}`).join(' · ')}</p><ul className="plain-list">{score.assumptions.map(text=><li key={text}>{text.replace(/\bSADY\b/g,'Moje Sady')}</li>)}</ul><button type="button" className="btn" onClick={onOpenProvenance}>Otevřít zdroje a nejistoty</button></div>;
  const rows: {
    indicator: string;
    value: string;
    source: string;
    quality: 'demo' | 'assumption' | 'real' | 'unavailable';
    availability: Availability;
  }[] = [
    {
      indicator: 'Půda / BPEJ',
      value: area.attributes.soil
        ? `${area.attributes.soil.soilType}, BPEJ ${area.attributes.soil.bpej}, pH ${fmtNum(area.attributes.soil.ph, 1)}, hloubka ${area.attributes.soil.depthCm} cm`
        : 'Podklad není k dispozici',
      source: area.attributes.soil ? 'Modelový půdní profil ukázkové plochy' : 'BPEJ – nepřipojeno',
      quality: area.attributes.soil ? 'demo' : 'unavailable',
      availability: area.availability.soil,
    },
    {
      indicator: 'Klima',
      value: area.attributes.climate
        ? `Ø ${fmtNum(area.attributes.climate.tempAvgC, 1)} °C, ${area.attributes.climate.rainfallMm} mm, ${area.attributes.climate.frostDays} mrazových dnů`
        : 'Podklad není k dispozici',
      source: area.attributes.climate ? 'Modelový klimatický profil oblasti' : 'ČHMÚ – nepřipojeno',
      quality: area.attributes.climate ? 'assumption' : 'unavailable',
      availability: area.availability.climate,
    },
    {
      indicator: 'Vláha / sucho',
      value: area.attributes.water
        ? `index rizika sucha ${area.attributes.water.droughtRisk}/100, potřeba závlahy ${area.attributes.water.irrigationNeedMm} mm`
        : 'Podklad není k dispozici',
      source: area.attributes.water ? 'Modelový ukazatel vláhové bilance' : 'ČHMÚ / InterSucho – nepřipojeno',
      quality: area.attributes.water ? 'demo' : 'unavailable',
      availability: area.availability.water,
    },
    {
      indicator: 'Terén',
      value: area.attributes.terrain
        ? `sklon ${fmtNum(area.attributes.terrain.slopeDeg, 1)}°, orientace ${area.attributes.terrain.aspect}, ${area.attributes.terrain.altitudeM} m n. m.`
        : 'Podklad není k dispozici',
      source: area.attributes.terrain ? 'Orientační odhad z výškového modelu' : 'Terénní zdroj není připojený',
      quality: area.attributes.terrain ? 'demo' : 'unavailable',
      availability: area.availability.terrain,
    },
    {
      indicator: 'Provoz / dostupnost',
      value: area.attributes.access
        ? `příjezd ${area.attributes.access.roadDistanceM} m, tvar ${area.attributes.access.shapeQuality}/100`
        : 'Podklad není k dispozici',
      source: area.attributes.access ? 'Modelový odhad dostupnosti' : 'RÚIAN / OSM – nepřipojeno',
      quality: area.attributes.access ? 'demo' : 'unavailable',
      availability: area.availability.access,
    },
    {
      indicator: 'Územní omezení',
      value:
        [area.attributes.constraints?.floodZone, area.attributes.constraints?.protectedArea].filter(Boolean).join(', ') ||
        'Bez zjištěného střetu v demo podkladech',
      source: 'VÚV TGM / AOPK ČR – zamýšlené zdroje, v demu ilustrace',
      quality: 'demo',
      availability: area.attributes.constraints ? 'partial' : 'missing',
    },
  ];

  const relevantProvenance = PROVENANCE.filter((row) =>
    ['Půda a BPEJ', 'Teploty, srážky, mrazové dny', 'Sucho a dostupnost vláhy', 'Terén, sklon, expozice', 'Katastrální parcely a RÚIAN'].includes(
      row.indicator,
    ),
  );

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span>Podklady pro tuto plochu</span>
          <span className={`badge ${score.completeness >= 80 ? 'good' : score.completeness >= 50 ? 'caution' : 'nodata'}`}>
            úplnost {score.completeness} %
          </span>
        </div>
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ukazatel</th>
                <th>Hodnota</th>
                <th>Zdroj</th>
                <th>Stav</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.indicator}>
                  <td>{row.indicator}</td>
                  <td>{row.value}</td>
                  <td>
                    <div>{row.source}</div>
                    <div style={{ marginTop: 3 }}>
                      <QualityBadge quality={row.quality} />
                    </div>
                  </td>
                  <td>{AVAILABILITY_LABEL[row.availability]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="footnote">
          Ukázková plocha není skutečná katastrální parcela. Výměra a obvod se počítají z přibalené geometrie
          (WGS84, geodetická aproximace), nikoli z katastru.
        </div>
      </div>

      {score.missing.length > 0 && (
        <div className="card">
          <div className="card-title">Co potřebujeme doplnit</div>
          <ul className="plain-list">
            {score.missing.map((item) => (
              <li key={item} className="small" style={{ color: 'var(--ink-soft)' }}>
                {item} – podklad pro tuto kategorii chybí.
              </li>
            ))}
          </ul>
          <div className="inline-note">
            Chybějící údaj není nula. Pokud chybí půda nebo klima, celkové skóre se nepočítá a zobrazuje se stav
            „Nedostatek dat“.
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <span>Zdroje a jejich stav</span>
          <button type="button" className="link-button" onClick={onOpenProvenance}>
            Celý přehled
          </button>
        </div>
        {relevantProvenance.map((row) => (
          <div className="prov-row" key={row.indicator}>
            <div className="prov-head">
              <div>
                <div className="prov-indicator">{row.indicator}</div>
                <div className="prov-source">{row.source}</div>
              </div>
              <QualityBadge quality={row.quality} />
            </div>
            <div className="prov-meta">
              <span>
                <b>Období:</b> {row.period} · <b>Rozlišení:</b> {row.resolution}
              </span>
              <span>
                <b>Připojení:</b> {row.connected}
              </span>
            </div>
            {row.note && <div className="prov-note">{row.note}</div>}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Předpoklady výpočtu</div>
        <ul className="plain-list">
          {score.assumptions.map((item) => (
            <li key={item} className="small" style={{ color: 'var(--ink-soft)' }}>
              {item.replace(/\bSADY\b/g,'Moje Sady')}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
