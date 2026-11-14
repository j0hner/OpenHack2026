import { useEffect, useId, useState, type KeyboardEvent } from "react";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconExternalLink,
  IconInfoCircle,
  IconLayersIntersect,
  IconMapPin,
  IconScissors,
  IconX,
} from "@tabler/icons-react";
import { FRUITS, FRUIT_ORDER } from "../data/fruitProfiles";
import { areaHa } from "../lib/geo";
import { fmtHa, fmtInt, fmtNum } from "../lib/format";
import { computeTreeCount } from "../lib/economics";
import { cadastralUrl, mean } from "../lib/openData";
import { validClimateYears } from "../lib/regionalScoring";
import type {
  AnalysisArea,
  CategoryScore,
  EconomicsInputs,
  FruitKey,
  SuitabilityResult,
} from "../lib/types";
import OpenDataPanel from "./OpenDataPanel";

export interface ParcelCardProps {
  area: AnalysisArea;
  score: SuitabilityResult;
  fruit: FruitKey;
  ranking: Record<FruitKey, SuitabilityResult>;
  economicsInputs: EconomicsInputs;
  onFruitChange: (fruit: FruitKey) => void;
  onClose: () => void;
  onSplit: () => void;
  onAnalysis: () => void;
  onRetryData: () => void;
  onEconomicsChange: (value: Partial<EconomicsInputs>) => void;
}
type Tab = "overview" | "soil" | "climate" | "planting" | "data";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Přehled" },
  { id: "soil", label: "Půda" },
  { id: "climate", label: "Klima" },
  { id: "planting", label: "Výsadba" },
  { id: "data", label: "Data" },
];
const shortText = (text: string, limit = 185) =>
  text.length <= limit
    ? text
    : text.slice(0, limit).replace(/\s+\S*$/, "") + "…";
function CategorySummary({
  category,
}: {
  category: CategoryScore | undefined;
}) {
  if (!category)
    return (
      <p className="parcel-empty">
        Pro tuto kategorii nejsou dostupné podklady.
      </p>
    );
  return (
    <section className="parcel-category">
      <div className="parcel-section-heading">
        <h3>{category.label}</h3>
        <strong>
          {category.score === null ? "Bez hodnocení" : `${category.score}/100`}
        </strong>
      </div>
      <p>{category.summary}</p>
    </section>
  );
}

export default function ParcelCard(props: ParcelCardProps) {
  const {
    area,
    score,
    fruit,
    ranking,
    economicsInputs,
    onFruitChange,
    onClose,
    onSplit,
    onAnalysis,
    onRetryData,
    onEconomicsChange,
  } = props;
  const [tab, setTab] = useState<Tab>("overview"),
    id = useId();
  useEffect(() => setTab("overview"), [area.id]);
  const profile = FRUITS[fruit],
    data = area.regional?.data,
    years = validClimateYears(data);
  const rainfall = mean(years.map((year) => year.rainfallMm));
  const soil = score.categories.find((category) => category.key === "soil");
  const climate = score.categories.find(
    (category) => category.key === "climate",
  );
  const water = score.categories.find((category) => category.key === "water");
  const ordered = [...FRUIT_ORDER].sort(
    (a, b) => (ranking[b].overall ?? -1) - (ranking[a].overall ?? -1),
  );
  const mainRisk = [...score.risks].sort(
    (a, b) =>
      ({ high: 0, medium: 1, low: 2 })[a.severity] -
      { high: 0, medium: 1, low: 2 }[b.severity],
  )[0];
  const locality =
    [
      area.location.obec,
      area.location.katastr ? `k. ú. ${area.location.katastr}` : "",
    ]
      .filter(
        (value) =>
          value && !value.includes("neurčeno") && !value.includes("více území"),
      )
      .join(" · ") || "Lokalita podle polohy v mapě";
  const dataLabel =
    area.derivedFrom?.operation === "split"
      ? "Uživatelská část · skutečná data"
      : area.cadastral
        ? "Parcela ČÚZK · skutečná data"
        : "Pracovní plocha · skutečná data";
  const loading = area.regional?.status === "loading";
  const rootParcels = [...new Set(area.derivedFrom?.rootCadastralIds ?? [])]
    .filter((value) => /^\d+$/.test(value) && value !== area.cadastral?.id)
    .map((value) => {
      const index =
        area.derivedFrom?.rootSourceIds?.indexOf(`parcel-${value}`) ?? -1;
      return {
        id: value,
        name:
          index >= 0
            ? (area.derivedFrom?.rootSourceNames?.[index] ??
              `Parcela ČÚZK ${value}`)
            : `Parcela ČÚZK ${value}`,
      };
    });
  const handleTabKey = (
    event: KeyboardEvent<HTMLButtonElement>,
    current: number,
  ) => {
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (event.key === "ArrowLeft")
      next = (current + TABS.length - 1) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    setTab(TABS[next].id);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  };
  return (
    <article
      className={`parcel-card ${score.verdictClass}`}
      aria-label={`Detail pozemku ${area.name}`}
    >
      <header className="parcel-card-header">
        <div className="parcel-card-title">
          <IconLayersIntersect size={19} aria-hidden="true" />
          <h2>{area.name}</h2>
        </div>
        <button
          type="button"
          className="icon-button parcel-close"
          aria-label="Zavřít detail pozemku"
          onClick={onClose}
        >
          <IconX size={19} />
        </button>
        <div className="parcel-card-location">
          <span>
            <IconMapPin size={14} aria-hidden="true" />
            {locality}
          </span>
          <strong>{fmtHa(areaHa(area.geometry))}</strong>
        </div>
        <span className={"parcel-data-kind real"}>{dataLabel}</span>
      </header>
      <nav
        className="parcel-card-tabs"
        role="tablist"
        aria-label="Informace o pozemku"
      >
        {TABS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${id}-${item.id}-tab`}
            aria-controls={`${id}-panel`}
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? "active" : ""}
            onKeyDown={(event) => handleTabKey(event, index)}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div
        className="parcel-card-body"
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${tab}-tab`}
        tabIndex={0}
      >
        <label className="parcel-fruit-field" htmlFor={`${id}-fruit`}>
          <span>Ovocný druh</span>
          <select
            id={`${id}-fruit`}
            value={fruit}
            onChange={(event) => onFruitChange(event.target.value as FruitKey)}
          >
            {FRUIT_ORDER.map((key) => (
              <option key={key} value={key}>
                {FRUITS[key].name}
              </option>
            ))}
          </select>
        </label>
        {tab === "overview" && (
          <>
            <div className="parcel-section-heading">
              <h3>Vhodnost pro sad</h3>
              <details className="parcel-info">
                <summary aria-label="Jak rozumět skóre vhodnosti">
                  <IconInfoCircle size={17} />
                </summary>
                <p>
                  Skóre je orientační soulad podmínek s nároky druhu. Není to
                  pravděpodobnost úspěchu ani předpověď výnosu. Kvalita
                  podkladů: {score.completeness} %.
                </p>
              </details>
            </div>
            <div className={`parcel-score ${score.verdictClass}`}>
              <div>
                <strong>{score.overall ?? "—"}</strong>
                <span>{score.overall === null ? "bez skóre" : "/ 100"}</span>
              </div>
              <span className={`parcel-verdict ${score.verdictClass}`}>
                {score.overall !== null && score.verdictClass === "good" ? (
                  <IconCheck size={17} />
                ) : (
                  <IconInfoCircle size={17} />
                )}{" "}
                {score.verdict}
              </span>
            </div>
            <progress
              className={`parcel-score-progress ${score.verdictClass}`}
              max={100}
              value={score.overall ?? 0}
              aria-label={
                score.overall === null
                  ? "Skóre není dostupné"
                  : `Skóre ${score.overall} ze 100`
              }
            />
            <p className="parcel-score-caption">
              Pro {profile.name.toLocaleLowerCase("cs-CZ")} · regionální index
            </p>
            {score.overall === null ? (
              <div className="parcel-risk missing" role="status">
                <IconAlertTriangle size={18} aria-hidden="true" />
                <div>
                  <strong>
                    {loading ? "Načítám podklady" : "Nedostatek podkladů"}
                  </strong>
                  <p>
                    {shortText(
                      area.regional?.message ??
                        score.reasons[0] ??
                        "Pro spolehlivější hodnocení chybí data.",
                    )}
                  </p>
                </div>
              </div>
            ) : mainRisk ? (
              <div className={`parcel-risk ${mainRisk.severity}`}>
                <IconAlertTriangle size={18} aria-hidden="true" />
                <div>
                  <strong>{mainRisk.label}</strong>
                  <p>{shortText(mainRisk.detail)}</p>
                </div>
              </div>
            ) : (
              <p className="parcel-recommendation">
                {shortText(
                  score.nextSteps[0] ??
                    "Před výsadbou ověřte podmínky přímo na místě.",
                )}
              </p>
            )}
            <div className="parcel-stats">
              <div>
                <span>Pokrytí BPEJ</span>
                <strong>
                  {data?.soil
                    ? `${fmtNum(data.soil.coveragePct)} %`
                    : "Neověřeno"}
                </strong>
              </div>
              <div>
                <span>Srážky v oblasti</span>
                <strong>
                  {rainfall === null
                    ? "Neověřeno"
                    : `${fmtInt(rainfall)} mm/rok`}
                </strong>
              </div>
            </div>
          </>
        )}
        {tab === "soil" && (
          <>
            <CategorySummary category={soil} />
            {data?.soil && (
              <dl className="parcel-data-list">
                <dt>Pokrytí vybrané plochy</dt>
                <dd>{fmtNum(data.soil.coveragePct)} %</dd>
                {data.soil.parts.map((part, index) => (
                  <div key={`${part.name}-${index}`}>
                    <dt>BPEJ {part.name}</dt>
                    <dd>{fmtNum(part.percent)} %</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="parcel-note">
              BPEJ je prostorový podklad. Nenahrazuje půdní rozbor; pH, humus a
              skutečnou hloubku je nutné ověřit.
            </p>
          </>
        )}
        {tab === "climate" && (
          <>
            <CategorySummary category={climate} />
            <CategorySummary category={water} />
            {data?.climate && (
              <p className="parcel-note">
                {data.climate.model} · {data.climate.period}.{" "}
                {data.climate.resolution}. Data popisují širší oblast, nikoli
                mikroklima parcely.
              </p>
            )}
          </>
        )}
        {tab === "planting" && (
          <>
            <div className="parcel-section-heading">
              <h3>Výsadba: {profile.name}</h3>
              <span className="parcel-data-kind assumption">
                Modelový předpoklad
              </span>
            </div>
            <div className="parcel-stats">
              <div>
                <span>Rozestup řad × stromů</span>
                <strong>
                  {fmtNum(economicsInputs.rowSpacingM)} ×{" "}
                  {fmtNum(economicsInputs.treeSpacingM)} m
                </strong>
              </div>
              <div>
                <span>Orientační počet stromů</span>
                <strong>
                  {fmtInt(
                    computeTreeCount(
                      areaHa(area.geometry),
                      economicsInputs.usefulSharePct,
                      economicsInputs.rowSpacingM,
                      economicsInputs.treeSpacingM,
                    ),
                  )}
                </strong>
              </div>
            </div>
            <p className="parcel-note">
              Počet vychází z geometrie a zadaného sponu. Rozmístění, ochranná
              pásma a podnože je třeba ověřit v terénu.
            </p>
            <h3>Porovnání druhů</h3>
            <div className="parcel-fruit-ranking">
              {ordered.map((key) => (
                <button
                  type="button"
                  key={key}
                  className={key === fruit ? "active" : ""}
                  aria-pressed={key === fruit}
                  onClick={() => onFruitChange(key)}
                >
                  <span>{FRUITS[key].name}</span>
                  <progress
                    max={100}
                    value={ranking[key].overall ?? 0}
                    aria-label={`${FRUITS[key].name}: ${ranking[key].overall === null ? "bez hodnocení" : ranking[key].overall + " ze 100"}`}
                  />
                  <strong>
                    {ranking[key].overall === null
                      ? "—"
                      : `${ranking[key].overall}/100`}
                  </strong>
                </button>
              ))}
            </div>
            <h3>Základní péče</h3>
            <p>{profile.pruning}</p>
            <p>{profile.pollination}</p>
            <p className="parcel-note">
              Pěstitelský profil je obecný modelový předpoklad, nikoli měření
              ani potvrzení vhodnosti konkrétní odrůdy.
            </p>
          </>
        )}
        {tab === "data" && (
          <>
            <p className="parcel-note">{area.sourceNote}</p>
            {area.derivedFrom && (
              <p className="parcel-note">
                Uživatelská část z ploch:{" "}
                {area.derivedFrom.sourceNames.join(", ")}. Nejde o změnu
                katastrální parcely.
              </p>
            )}
            {rootParcels.length > 0 && (
              <section className="parcel-origin-links">
                <h3>
                  {rootParcels.length === 1
                    ? "Původní parcela"
                    : "Původní parcely"}
                </h3>
                <p className="parcel-note">
                  Odkazy vedou na původní katastrální parcely. Vybraná plocha je
                  uživatelské vymezení pro plánování výsadby.
                </p>
                <ul>
                  {rootParcels.map((source) => (
                    <li key={source.id}>
                      <a
                        className="parcel-cadastre-link"
                        href={cadastralUrl(source.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <IconExternalLink size={16} aria-hidden="true" />
                        {source.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {area.cadastral && (
              <a
                className="parcel-cadastre-link"
                href={cadastralUrl(area.cadastral.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconExternalLink size={16} aria-hidden="true" /> Oficiální
                katastr ČÚZK
              </a>
            )}
            <OpenDataPanel
              area={area}
              fruit={fruit}
              onEconomicsChange={onEconomicsChange}
              onRetry={onRetryData}
            />
          </>
        )}
      </div>
      <footer className="parcel-card-footer">
        <button
          type="button"
          className="btn primary parcel-analysis-button"
          onClick={onAnalysis}
        >
          Detailní analýza <IconArrowRight size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn parcel-split-button"
          onClick={onSplit}
        >
          <IconScissors size={17} aria-hidden="true" /> Rozdělit pozemek
        </button>
      </footer>
    </article>
  );
}
