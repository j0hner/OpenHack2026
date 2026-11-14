import { useMemo, useState } from "react";
import {
  ALL_CATEGORIES,
  UNASSIGNED_CATEGORY,
  aggregateCategoryScenarios,
  categoryAreas,
  type ParcelCategoryState,
} from "../lib/parcelCategories";
import { FRUITS } from "../data/fruitProfiles";
import { fmtHa, fmtInt, fmtKc, fmtKcShort } from "../lib/format";
import type { AnalysisArea, EconomicsInputs, FruitKey } from "../lib/types";
import "./parcel-categories.css";

export interface CategoryScenariosProps {
  areas: AnalysisArea[];
  state: ParcelCategoryState;
  fruitByArea: Record<string, FruitKey>;
  defaultFruit: FruitKey;
  economicsByFruit: Record<FruitKey, EconomicsInputs>;
  irrigation: boolean;
}
export default function CategoryScenarios(props: CategoryScenariosProps) {
  const [selected, setSelected] = useState(ALL_CATEGORIES),
    [cashflowScenario, setCashflowScenario] = useState("base");
  const scope =
    props.state.categories.some((category) => category.id === selected) ||
    selected === UNASSIGNED_CATEGORY
      ? selected
      : ALL_CATEGORIES;
  const included = useMemo(
    () => categoryAreas(props.areas, props.state, scope),
    [props.areas, props.state, scope],
  );
  const summary = useMemo(
    () =>
      aggregateCategoryScenarios(
        included,
        props.fruitByArea,
        props.defaultFruit,
        props.economicsByFruit,
        props.irrigation,
      ),
    [
      included,
      props.fruitByArea,
      props.defaultFruit,
      props.economicsByFruit,
      props.irrigation,
    ],
  );
  const current =
    summary.scenarios.find((item) => item.scenario.key === cashflowScenario) ??
    summary.scenarios[1];
  const title =
    scope === ALL_CATEGORIES
      ? "Všechny pozemky"
      : scope === UNASSIGNED_CATEGORY
        ? "Bez kategorie"
        : props.state.categories.find((category) => category.id === scope)
            ?.name;
  return (
    <section
      className="card category-scenarios"
      aria-label="Souhrnné scénáře kategorií"
    >
      <div className="card-title">
        <h2>Scénáře celé kategorie</h2>
        <span className="badge q-assumption">Modelové předpoklady</span>
      </div>
      <label className="field category-scope">
        <span className="field-label">Kategorie pro souhrn</span>
        <select
          value={scope}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value={ALL_CATEGORIES}>Všechny pozemky</option>
          <option value={UNASSIGNED_CATEGORY}>Bez kategorie</option>
          {props.state.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <p className="category-help">
        Součet ekonomických plánů podle ovocného druhu a vstupů každého pozemku.
        Jde o scénáře nákladů a budoucích tržeb, nikoli předpověď sklizně nebo
        potvrzení vhodnosti.
      </p>
      {summary.status !== "ready" ? (
        <div
          className={`notice ${summary.status === "overlap" || summary.status === "error" ? "warn" : "info"}`}
          role="status"
        >
          <strong>
            {summary.status === "empty"
              ? "Prázdná kategorie"
              : "Souhrn nelze spočítat"}
          </strong>
          <p>{summary.message}</p>
          {summary.overlaps.length > 0 && (
            <ul>
              {summary.overlaps.map((overlap, index) => (
                <li key={index}>
                  {overlap.first} × {overlap.second}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="category-total-metrics">
            <div>
              <span>Kategorie</span>
              <strong>{title}</strong>
            </div>
            <div>
              <span>Počet pozemků</span>
              <strong>{summary.parcelCount}</strong>
            </div>
            <div>
              <span>Výměra bez překryvu</span>
              <strong>{fmtHa(summary.areaHa)}</strong>
            </div>
            <div>
              <span>Plánovaný počet stromů</span>
              <strong>{fmtInt(summary.scenarios[1].totals.treeCount)}</strong>
            </div>
          </div>
          <div
            className="category-table-scroll"
            tabIndex={0}
            aria-label="Tabulka souhrnných ekonomických scénářů"
          >
            <table className="data-table category-scenario-table">
              <thead>
                <tr>
                  <th>Scénář</th>
                  <th>Investice</th>
                  <th>Roční tržby v plné plodnosti</th>
                  <th>Roční náklady</th>
                  <th>NPV</th>
                  <th>Návratnost</th>
                </tr>
              </thead>
              <tbody>
                {summary.scenarios.map(({ scenario, totals }) => (
                  <tr key={scenario.key}>
                    <th scope="row">
                      {scenario.label}
                      <small>{scenario.note}</small>
                    </th>
                    <td>{fmtKcShort(totals.investment.total)}</td>
                    <td>{fmtKcShort(totals.matureRevenue)}</td>
                    <td>{fmtKcShort(totals.annualCostsMature)}</td>
                    <td>{fmtKcShort(totals.npv)}</td>
                    <td>
                      {totals.paybackYear === null
                        ? "V horizontu nenastává"
                        : `rok ${totals.paybackYear}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="category-help">
            {summary.message} Návratnost se počítá z celkového peněžního toku;
            roky návratnosti jednotlivých parcel se nesčítají.
          </p>
          <details className="category-cashflows">
            <summary>Roční peněžní toky kategorie</summary>
            <label className="field category-scope">
              <span className="field-label">Scénář peněžních toků</span>
              <select
                value={cashflowScenario}
                onChange={(event) => setCashflowScenario(event.target.value)}
              >
                {summary.scenarios.map(({ scenario }) => (
                  <option value={scenario.key} key={scenario.key}>
                    {scenario.label}
                  </option>
                ))}
              </select>
            </label>
            <div
              className="category-table-scroll"
              tabIndex={0}
              aria-label="Roční peněžní toky kategorie"
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rok</th>
                    <th>Tržby</th>
                    <th>Náklady</th>
                    <th>Čistý tok</th>
                    <th>Kumulativně</th>
                  </tr>
                </thead>
                <tbody>
                  {current?.totals.flows.map((flow) => (
                    <tr key={flow.year}>
                      <th scope="row">{flow.year}</th>
                      <td>{fmtKc(flow.revenue)}</td>
                      <td>{fmtKc(flow.costs)}</td>
                      <td>{fmtKc(flow.net)}</td>
                      <td>{fmtKc(flow.cumulative)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      {included.length > 0 && (
        <details className="category-included">
          <summary>Zahrnuté pozemky ({included.length})</summary>
          <ul>
            {included.map((area) => (
              <li key={area.id}>
                <span>{area.name}</span>
                <small>
                  {
                    FRUITS[props.fruitByArea[area.id] ?? props.defaultFruit]
                      .name
                  }
                </small>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
