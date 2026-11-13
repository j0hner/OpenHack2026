import { FRUITS, FRUIT_ORDER } from '../data/fruitProfiles';
import { fmtHa, fmtInt } from '../lib/format';
import { computeTreeCount } from '../lib/economics';
import type { AnalysisArea, EconomicsInputs, FruitKey, SuitabilityResult } from '../lib/types';

interface Props {
  area: AnalysisArea;
  areaHa: number;
  fruit: FruitKey;
  onFruitChange: (fruit: FruitKey) => void;
  irrigation: boolean;
  ranking: Record<FruitKey, SuitabilityResult>;
  inputs: EconomicsInputs;
  onInputsChange: (patch: Partial<EconomicsInputs>) => void;
}

export default function RecommendationPanel({
  area,
  areaHa,
  fruit,
  onFruitChange,
  ranking,
  inputs,
  onInputsChange,
}: Props) {
  const profile = FRUITS[fruit];
  const treeCount = computeTreeCount(areaHa, inputs.usefulSharePct, inputs.rowSpacingM, inputs.treeSpacingM);
  const ordered = [...FRUIT_ORDER].sort((a, b) => {
    const sa = ranking[a].overall;
    const sb = ranking[b].overall;
    if (sa == null && sb == null) return 0;
    if (sa == null) return 1;
    if (sb == null) return -1;
    return sb - sa;
  });

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span>Pořadí druhů pro tuto plochu</span>
          <span className="hint">model 0–100</span>
        </div>
        <div className="fruit-row">
          {ordered.map((key, index) => {
            const item = ranking[key];
            return (
              <button
                key={key}
                type="button"
                className={`fruit-chip${fruit === key ? ' active' : ''}`}
                onClick={() => onFruitChange(key)}
                title={`${FRUITS[key].name}: ${item.verdict}`}
              >
                <span aria-hidden="true">{FRUITS[key].emoji}</span>
                {FRUITS[key].name}
                <span className="rank">
                  {index + 1}. {item.overall != null ? `${item.overall}` : '–'}
                </span>
              </button>
            );
          })}
        </div>
        <div className="inline-note">
          Pořadí vychází z dostupných podkladů pro {area.name.toLowerCase()}. Chybějící kategorie nejsou nahrazené
          nulou; druh s nedostatkem dat se řadí na konec.
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span>
            {profile.emoji} {profile.name} – co očekávat
          </span>
          <span className={`badge ${ranking[fruit].verdictClass}`}>{ranking[fruit].verdict}</span>
        </div>

        <div className="kv">
          <div className="kv-row">
            <span className="k">Orientační spon</span>
            <span className="v">
              {inputs.rowSpacingM} m mezi řadami × {inputs.treeSpacingM} m v řadě
            </span>
          </div>
          <div className="kv-row">
            <span className="k">Využitelná plocha</span>
            <span className="v">
              {fmtHa(areaHa * (inputs.usefulSharePct / 100))} z {fmtHa(areaHa)} ({inputs.usefulSharePct} %)
            </span>
          </div>
          <div className="kv-row">
            <span className="k">Orientační počet stromů</span>
            <span className="v">{fmtInt(treeCount)} ks</span>
          </div>
          <div className="kv-row">
            <span className="k">Náběh plodnosti</span>
            <span className="v">
              {profile.bearingYears} roky do prvních plodů, plná plodnost ~{profile.bearingYears + profile.fullBearingYears} let
            </span>
          </div>
          <div className="kv-row">
            <span className="k">Modelový výnos v plné plodnosti</span>
            <span className="v">
              {inputs.matureYieldTPerHa} t/ha ({(inputs.matureYieldTPerHa * 1000).toLocaleString('cs-CZ')} kg/ha)
            </span>
          </div>
          <div className="kv-row">
            <span className="k">Opylování</span>
            <span className="v">{profile.needsPollinator ? 'nutný opylovač' : 'částečně samosprašná'}</span>
          </div>
        </div>

        <div className="divider" />

        <div className="form-grid">
          <label className="field">
            <span className="field-label">Vzdálenost řad</span>
            <span className="input-unit">
              <input
                type="number"
                min={2}
                max={8}
                step={0.5}
                value={inputs.rowSpacingM}
                onChange={(event) => onInputsChange({ rowSpacingM: Number(event.target.value) || 0 })}
              />
              <span className="unit">m</span>
            </span>
          </label>
          <label className="field">
            <span className="field-label">Vzdálenost v řadě</span>
            <span className="input-unit">
              <input
                type="number"
                min={1}
                max={6}
                step={0.5}
                value={inputs.treeSpacingM}
                onChange={(event) => onInputsChange({ treeSpacingM: Number(event.target.value) || 0 })}
              />
              <span className="unit">m</span>
            </span>
          </label>
          <label className="field span-2">
            <span className="field-label">
              Podíl využitelné plochy <span className="muted">{inputs.usefulSharePct} %</span>
            </span>
            <input
              type="range"
              min={50}
              max={100}
              step={1}
              value={inputs.usefulSharePct}
              onChange={(event) => onInputsChange({ usefulSharePct: Number(event.target.value) })}
              aria-label="Podíl využitelné plochy"
            />
            <span className="field-note">Rezerva na cesty, souvratě, obratiště a ochranné pásy.</span>
          </label>
        </div>

        <div className="notice good" style={{ marginTop: 9 }}>
          <strong>{fmtInt(treeCount)} stromů</strong> při sponu {inputs.rowSpacingM} × {inputs.treeSpacingM} m a využití{' '}
          {inputs.usefulSharePct} % plochy. Počet se přepočítává okamžitě; počítá se z výměry plochy, ne z počtu
          parcel.
        </div>

        <div className="inline-note">
          Spon a pěstitelské parametry jsou modelové předpoklady pro pěstování {profile.nameGenitive.toLowerCase()}. Před
          výsadbou je nutné je upravit podle podnože, odrůdy a doporučení odborníka.
        </div>
      </div>

      <div className="card">
        <div className="card-title">Výhody a rizika druhu</div>
        <div className="two-col" style={{ display: 'grid', gap: 10 }}>
          <div>
            <div className="tiny" style={{ fontWeight: 700, marginBottom: 4 }}>
              Výhody
            </div>
            <ul className="plain-list">
              {profile.advantages.map((item) => (
                <li key={item} className="small" style={{ color: 'var(--ink-soft)' }}>
                  + {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="tiny" style={{ fontWeight: 700, marginBottom: 4 }}>
              Rizika
            </div>
            <ul className="plain-list">
              {profile.risks.map((item) => (
                <li key={item} className="small" style={{ color: 'var(--ink-soft)' }}>
                  – {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Péče, řez, závlaha a opylování</div>
        <div className="kv">
          <div className="kv-row" style={{ display: 'grid' }}>
            <span className="k">Řez a tvarování</span>
            <span className="v" style={{ textAlign: 'left', fontWeight: 500 }}>
              {profile.pruning}
            </span>
          </div>
          <div className="kv-row" style={{ display: 'grid' }}>
            <span className="k">Závlaha</span>
            <span className="v" style={{ textAlign: 'left', fontWeight: 500 }}>
              {profile.irrigation}
            </span>
          </div>
          <div className="kv-row" style={{ display: 'grid' }}>
            <span className="k">Opylení</span>
            <span className="v" style={{ textAlign: 'left', fontWeight: 500 }}>
              {profile.pollination}
            </span>
          </div>
          <div className="kv-row" style={{ display: 'grid' }}>
            <span className="k">Ochrana porostu</span>
            <span className="v" style={{ textAlign: 'left', fontWeight: 500 }}>
              {profile.protection}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
