import { FRUITS } from "../data/fruitProfiles";
import {
  SCENARIOS,
  computeEconomics,
  costRevenueRatio,
} from "../lib/economics";
import {
  fmtHa,
  fmtInt,
  fmtKc,
  fmtKcShort,
  fmtNum,
  fmtPct,
} from "../lib/format";
import type {
  AnalysisArea,
  CashFlowYear,
  EconomicsInputs,
  FruitKey,
} from "../lib/types";
import { NumberField, Toggle } from "./ui";

interface Props {
  area: AnalysisArea;
  areaHa: number;
  fruit: FruitKey;
  inputs: EconomicsInputs;
  irrigation: boolean;
  onChange: (patch: Partial<EconomicsInputs>) => void;
  onIrrigationChange: (value: boolean) => void;
  onReset: () => void;
}

function AnnualFlowChart({ flows }: { flows: CashFlowYear[] }) {
  const width = 560;
  const height = 150;
  const padL = 46;
  const padR = 8;
  const padT = 8;
  const padB = 18;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const maxAbs = Math.max(1, ...flows.map((flow) => Math.abs(flow.net)));
  const zeroY = padT + innerH / 2;
  const barW = innerW / flows.length;
  const scale = innerH / 2 / maxAbs;

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Roční peněžní toky v Kč"
    >
      <line
        x1={padL}
        y1={zeroY}
        x2={width - padR}
        y2={zeroY}
        stroke="#c9d6c6"
        strokeWidth="1"
      />
      <text x={4} y={padT + 4} fontSize="9" fill="#6b7d70">
        {fmtKcShort(maxAbs)}
      </text>
      <text x={4} y={height - padB} fontSize="9" fill="#6b7d70">
        {fmtKcShort(-maxAbs)}
      </text>
      {flows.map((flow, index) => {
        const x = padL + index * barW + barW * 0.18;
        const barHeight = Math.abs(flow.net) * scale;
        const y = flow.net >= 0 ? zeroY - barHeight : zeroY;
        return (
          <rect
            key={flow.year}
            x={x}
            y={y}
            width={barW * 0.64}
            height={barHeight}
            fill={flow.net >= 0 ? "#3d9465" : "#b4513c"}
            opacity={flow.year === 0 ? 0.55 : 0.85}
          >
            <title>{`Rok ${flow.year}: ${fmtKc(flow.net)}`}</title>
          </rect>
        );
      })}
      <text x={padL} y={height - 4} fontSize="9" fill="#6b7d70">
        rok 0
      </text>
      <text
        x={width - padR}
        y={height - 4}
        fontSize="9"
        fill="#6b7d70"
        textAnchor="end"
      >
        rok {flows[flows.length - 1]?.year ?? 0}
      </text>
    </svg>
  );
}

function CumulativeChart({
  flows,
  paybackYear,
}: {
  flows: CashFlowYear[];
  paybackYear: number | null;
}) {
  const width = 560;
  const height = 170;
  const padL = 46;
  const padR = 10;
  const padT = 10;
  const padB = 20;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const values = flows.map((flow) => flow.cumulative);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const x = (index: number) =>
    padL + (index / Math.max(1, flows.length - 1)) * innerW;
  const y = (value: number) => padT + (1 - (value - min) / range) * innerH;
  const points = flows
    .map((flow, index) => `${x(index)},${y(flow.cumulative)}`)
    .join(" ");
  const paybackIndex =
    paybackYear == null
      ? -1
      : flows.findIndex((flow) => flow.year === paybackYear);

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Kumulovaná bilance investice"
    >
      <line
        x1={padL}
        y1={y(0)}
        x2={width - padR}
        y2={y(0)}
        stroke="#c9d6c6"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <text x={4} y={y(max) + 3} fontSize="9" fill="#6b7d70">
        {fmtKcShort(max)}
      </text>
      <text x={4} y={y(min) + 3} fontSize="9" fill="#6b7d70">
        {fmtKcShort(min)}
      </text>
      <polyline points={points} fill="none" stroke="#1b5e3d" strokeWidth="2" />
      {paybackIndex >= 0 && (
        <>
          <line
            x1={x(paybackIndex)}
            y1={padT}
            x2={x(paybackIndex)}
            y2={height - padB}
            stroke="#c19a2f"
            strokeWidth="1.4"
            strokeDasharray="4 3"
          />
          <circle
            cx={x(paybackIndex)}
            cy={y(flows[paybackIndex].cumulative)}
            r="3.2"
            fill="#c19a2f"
          />
          <text
            x={x(paybackIndex) + 4}
            y={padT + 9}
            fontSize="9"
            fill="#8a6212"
          >
            návratnost r. {paybackYear}
          </text>
        </>
      )}
      <text x={padL} y={height - 4} fontSize="9" fill="#6b7d70">
        rok 0
      </text>
      <text
        x={width - padR}
        y={height - 4}
        fontSize="9"
        fill="#6b7d70"
        textAnchor="end"
      >
        rok {flows[flows.length - 1]?.year ?? 0}
      </text>
    </svg>
  );
}

export default function EconomicsPanel({
  area,
  areaHa,
  fruit,
  inputs,
  irrigation,
  onChange,
  onIrrigationChange,
  onReset,
}: Props) {
  const profile = FRUITS[fruit];
  const result = computeEconomics(area, fruit, inputs, {
    irrigation,
    subsidy: inputs.subsidy,
    scenario: SCENARIOS[1],
  });
  const ratio = costRevenueRatio(result);

  const scenarioResults = SCENARIOS.map((scenario) => ({
    scenario,
    result: computeEconomics(area, fruit, inputs, {
      irrigation,
      subsidy: inputs.subsidy,
      scenario,
    }),
  }));

  const irrigationCompare = [false, true].map((value) => ({
    label: value ? "Se závlahou" : "Bez závlahy",
    result: computeEconomics(area, fruit, inputs, {
      irrigation: value,
      subsidy: inputs.subsidy,
      scenario: SCENARIOS[1],
    }),
    enabled: value,
  }));

  const subsidyCompare = [false, true].map((value) => ({
    label: value ? "S modelovou podporou" : "Bez podpory",
    result: computeEconomics(area, fruit, inputs, {
      irrigation,
      subsidy: value,
      scenario: SCENARIOS[1],
    }),
    enabled: value,
  }));

  return (
    <div className="economics-panel analysis-section-content">
      <details className="card economics-inputs">
        <summary className="economics-inputs-summary">
          Upravit vstupy ekonomického scénáře
        </summary>
        <div className="card-title">
          <span>Vstupy výpočtu</span>
          <button type="button" className="link-button" onClick={onReset}>
            Výchozí hodnoty
          </button>
        </div>

        <div className="notice" style={{ marginBottom: 10 }}>
          Ekonomika vychází z výměry {fmtHa(areaHa)}, sponu {inputs.rowSpacingM}{" "}
          × {inputs.treeSpacingM} m a využití {inputs.usefulSharePct} % plochy.
          Náklady, ceny a budoucí výnos jsou vstupy scénáře, nikoli měřený výnos
          tohoto pozemku. Cenu lze převzít z referencí ČSÚ v záložce Data.
        </div>

        <div className="form-grid">
          <NumberField
            label="Sazenice"
            value={inputs.saplingCost}
            unit="Kč/ks"
            min={0}
            step={10}
            onChange={(v) => onChange({ saplingCost: v })}
          />
          <NumberField
            label="Výsadba"
            value={inputs.plantingCost}
            unit="Kč/ks"
            min={0}
            step={10}
            onChange={(v) => onChange({ plantingCost: v })}
          />
          <NumberField
            label="Oplocení"
            value={inputs.fenceCostPerM}
            unit="Kč/m"
            min={0}
            step={10}
            onChange={(v) => onChange({ fenceCostPerM: v })}
          />
          <NumberField
            label="Závlaha – investice"
            value={inputs.irrigationCostPerHa}
            unit="Kč/ha"
            min={0}
            step={1000}
            onChange={(v) => onChange({ irrigationCostPerHa: v })}
          />
          <NumberField
            label="Roční náklady plochy"
            value={inputs.annualCostPerHa}
            unit="Kč/ha"
            min={0}
            step={1000}
            onChange={(v) => onChange({ annualCostPerHa: v })}
          />
          <NumberField
            label="Roční náklady na strom"
            value={inputs.annualCostPerTree}
            unit="Kč/ks"
            min={0}
            step={5}
            onChange={(v) => onChange({ annualCostPerTree: v })}
          />
          <NumberField
            label="Výnos v plné plodnosti"
            value={inputs.matureYieldTPerHa}
            unit="t/ha"
            min={0}
            step={1}
            onChange={(v) => onChange({ matureYieldTPerHa: v })}
          />
          <NumberField
            label="Realizační cena"
            value={inputs.pricePerKg}
            unit="Kč/kg"
            min={0}
            step={1}
            onChange={(v) => onChange({ pricePerKg: v })}
          />
          <NumberField
            label="Náběh plodnosti"
            value={inputs.yearsToBearing}
            unit="roky"
            min={0}
            max={15}
            onChange={(v) => onChange({ yearsToBearing: v })}
          />
          <NumberField
            label="Náběh na plný výnos"
            value={inputs.rampYears}
            unit="roky"
            min={1}
            max={15}
            onChange={(v) => onChange({ rampYears: v })}
          />
          <NumberField
            label="Horizont hodnocení"
            value={inputs.horizonYears}
            unit="let"
            min={5}
            max={40}
            onChange={(v) => onChange({ horizonYears: v })}
          />
          <NumberField
            label="Diskontní sazba"
            value={inputs.discountRatePct}
            unit="%"
            min={0}
            max={15}
            step={0.5}
            onChange={(v) => onChange({ discountRatePct: v })}
          />
          <NumberField
            label="Modelová podpora"
            value={inputs.subsidyPerHa}
            unit="Kč/ha"
            min={0}
            step={5000}
            onChange={(v) => onChange({ subsidyPerHa: v })}
          />
        </div>

        <div className="divider" />

        <div className="field" style={{ marginBottom: 8 }}>
          <span className="field-label">Nakládání s pozemkem</span>
          <div className="segmented">
            <button
              type="button"
              className={inputs.landMode === "lease" ? "active" : ""}
              onClick={() => onChange({ landMode: "lease" })}
            >
              Pacht
            </button>
            <button
              type="button"
              className={inputs.landMode === "purchase" ? "active" : ""}
              onClick={() => onChange({ landMode: "purchase" })}
            >
              Koupě
            </button>
          </div>
        </div>
        {inputs.landMode === "lease" ? (
          <div className="form-grid">
            <NumberField
              label="Pacht"
              value={inputs.leasePerHaYear}
              unit="Kč/ha/rok"
              min={0}
              step={500}
              onChange={(v) => onChange({ leasePerHaYear: v })}
            />
          </div>
        ) : (
          <div className="form-grid">
            <NumberField
              label="Cena pozemku"
              value={inputs.landPricePerHa}
              unit="Kč/ha"
              min={0}
              step={50000}
              onChange={(v) => onChange({ landPricePerHa: v })}
            />
          </div>
        )}

        <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
          <Toggle
            checked={irrigation}
            onChange={onIrrigationChange}
            label="Modelovat závlahu"
            description={
              area.regional
                ? "Zvýší investici a provozní náklady. Bez doložených údajů nenavyšujeme budoucí výnos."
                : "Zvýší investici i roční náklady a modelově upraví výnos. Není potvrzením dostupnosti vody."
            }
            disabled={area.irrigationAvailable === false}
          />
          <Toggle
            checked={inputs.subsidy}
            onChange={(value) => onChange({ subsidy: value })}
            label="Zahrnout modelovou podporu"
            description="Potenciální podpora vyžadující ověření podmínek, nikoli jistý příjem."
          />
        </div>
        {area.irrigationAvailable === false && (
          <div className="inline-note warn-text">
            U této plochy není závlaha v demu uvažovaná (chybí ověřený zdroj
            vody). Přepínač je proto vypnutý.
          </div>
        )}
      </details>

      <div className="card economics-result-card">
        <div className="card-title">
          <span>Modelový výsledek pro {profile.name.toLowerCase()}</span>
          <span className="hint">{fmtInt(result.treeCount)} stromů</span>
        </div>

        <div className="summary-grid">
          <div className="metric">
            <div className="label">Počáteční investice</div>
            <div className="value">{fmtKcShort(result.investment.total)}</div>
            <div className="sub">
              včetně{" "}
              {inputs.landMode === "purchase"
                ? "koupě pozemku"
                : "výsadby a oplocení"}
            </div>
          </div>
          <div className="metric">
            <div className="label">Roční náklady v plné plodnosti</div>
            <div className="value">{fmtKcShort(result.annualCostsMature)}</div>
            <div className="sub">provoz, řez, ochrana, sklizeň</div>
          </div>
          <div className={`metric ${result.npv >= 0 ? "good" : "bad"}`}>
            <div className="label">Čistá současná hodnota (NPV)</div>
            <div className="value">{fmtKcShort(result.npv)}</div>
            <div className="sub">
              při diskontu {fmtNum(inputs.discountRatePct, 1)} %
            </div>
          </div>
          <div className={`metric ${result.paybackYear ? "good" : "warn"}`}>
            <div className="label">Návratnost investice</div>
            <div className="value small-value">
              {result.paybackYear
                ? `rok ${result.paybackYear}`
                : "v horizontu se nevrátí"}
            </div>
            <div className="sub">
              {result.paybackYear
                ? `kumulovaně kladné od ${result.paybackYear}. roku`
                : `horizont ${inputs.horizonYears} let`}
            </div>
          </div>
        </div>

        <div className="inline-note">
          NPV je dnešní hodnota budoucích peněžních toků po odečtení investice.
          Kladná hodnota při zvolené diskontní sazbě znamená, že se investice v
          horizontu vrátí; není to zaručený zisk.
        </div>

        <div className="breakdown" style={{ marginTop: 10 }}>
          <div className="breakdown-row">
            <span>
              Stromy ({fmtInt(result.treeCount)} ks × sazenice + výsadba)
            </span>
            <span>{fmtKc(result.investment.trees)}</span>
          </div>
          <div className="breakdown-row">
            <span>Oplocení</span>
            <span>{fmtKc(result.investment.fence)}</span>
          </div>
          <div className="breakdown-row">
            <span>Závlaha</span>
            <span>
              {result.investment.irrigation > 0
                ? fmtKc(result.investment.irrigation)
                : "nezahrnuto"}
            </span>
          </div>
          <div className="breakdown-row">
            <span>Pozemek</span>
            <span>
              {result.investment.land > 0
                ? fmtKc(result.investment.land)
                : "pacht, bez koupě"}
            </span>
          </div>
          <div className="breakdown-row total">
            <span>Celkem</span>
            <span>{fmtKc(result.investment.total)}</span>
          </div>
        </div>

        {result.subsidyTotal > 0 && (
          <div className="notice good" style={{ marginTop: 9 }}>
            Modelová podpora {fmtKc(result.subsidyTotal)} je zahrnutá v 1. roce.
            Jde o potenciální podporu, nikoli o přiznanou dotaci.
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <span>Peněžní toky</span>
          <span className="hint">včetně let před plnou plodností</span>
        </div>
        <div className="chart-wrap">
          <AnnualFlowChart flows={result.flows} />
          <div className="chart-legend">
            <span>
              <span
                className="chart-swatch"
                style={{ background: "#3d9465" }}
              />{" "}
              kladný roční tok
            </span>
            <span>
              <span
                className="chart-swatch"
                style={{ background: "#b4513c" }}
              />{" "}
              záporný roční tok
            </span>
            <span>
              <span
                className="chart-swatch"
                style={{ background: "#b8c9bc" }}
              />{" "}
              rok 0 = investice
            </span>
          </div>
        </div>
        <div className="chart-wrap" style={{ marginTop: 8 }}>
          <CumulativeChart
            flows={result.flows}
            paybackYear={result.paybackYear}
          />
          <div className="chart-note">
            Kumulovaná bilance: součet toků od investice. Průsečík s nulou =
            návratnost.
          </div>
        </div>
        {result.paybackYear == null && (
          <div className="notice warn" style={{ marginTop: 9 }}>
            <strong>
              Investice se ve zvoleném horizontu {inputs.horizonYears} let
              nevrátí.
            </strong>{" "}
            Zkuste prodloužit horizont, upravit cenu nebo výnos – nebo zvažte
            jiný druh či menší rozsah výsadby.
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <span>Scénáře</span>
          <span className="hint">modelové multiplikátory</span>
        </div>
        <div className="scroll-x">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Scénář</th>
                <th className="num">Tržby v plné plodnosti</th>
                <th className="num">Roční náklady</th>
                <th className="num">NPV</th>
                <th className="num">Návratnost</th>
              </tr>
            </thead>
            <tbody>
              {scenarioResults.map(({ scenario, result: scenarioResult }) => (
                <tr key={scenario.key}>
                  <td>
                    {scenario.label}
                    <div className="tiny muted">{scenario.note}</div>
                  </td>
                  <td className="num">
                    {fmtKcShort(scenarioResult.matureRevenue)}
                  </td>
                  <td className="num">
                    {fmtKcShort(scenarioResult.annualCostsMature)}
                  </td>
                  <td
                    className={`num ${scenarioResult.npv >= 0 ? "" : "warn-text"}`}
                  >
                    {fmtKcShort(scenarioResult.npv)}
                  </td>
                  <td className="num">
                    {scenarioResult.paybackYear
                      ? `rok ${scenarioResult.paybackYear}`
                      : "nevrátí se"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="inline-note">
          Scénáře mění výnos, cenu a náklady. Nepředstavují pravděpodobnost ani
          garanci výsledku.
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span>Závlaha a podpora</span>
          <span className="hint">porovnání variant</span>
        </div>
        <div className="scroll-x">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Varianta</th>
                <th className="num">Investice</th>
                <th className="num">Roční náklady</th>
                <th className="num">NPV</th>
                <th className="num">Návratnost</th>
              </tr>
            </thead>
            <tbody>
              {[...irrigationCompare, ...subsidyCompare].map((variant) => (
                <tr key={variant.label}>
                  <td>
                    {variant.label}
                    {variant.enabled && variant.label.startsWith("Se") ? (
                      <div className="tiny muted">modelová varianta</div>
                    ) : null}
                  </td>
                  <td className="num">
                    {fmtKcShort(variant.result.investment.total)}
                  </td>
                  <td className="num">
                    {fmtKcShort(variant.result.annualCostsMature)}
                  </td>
                  <td
                    className={`num ${variant.result.npv >= 0 ? "" : "warn-text"}`}
                  >
                    {fmtKcShort(variant.result.npv)}
                  </td>
                  <td className="num">
                    {variant.result.paybackYear
                      ? `rok ${variant.result.paybackYear}`
                      : "nevrátí se"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="inline-note">
          Závlaha zvyšuje investici a roční náklady. Budoucí výnos bez
          doložených vstupů automaticky nenavyšujeme. Podpora je modelová částka{" "}
          {fmtKc(inputs.subsidyPerHa)} na hektar, vyžaduje ověření podmínek.
        </div>
        {ratio != null && (
          <div className="inline-note">
            Poměr ročních nákladů k tržbám v plné plodnosti:{" "}
            {fmtPct(ratio * 100, 0)}.
          </div>
        )}
      </div>
    </div>
  );
}
