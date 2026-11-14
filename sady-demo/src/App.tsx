import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowBackUp,
  IconCheck,
  IconInfoCircle,
  IconList,
  IconMap,
  IconScissors,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import SideNav, { type AppView } from "./components/SideNav";
import ParcelList from "./components/ParcelList";
import ParcelCard from "./components/ParcelCard";
import LocationSearch from "./components/LocationSearch";
import Dialog from "./components/Dialog";
import ParcelPreview from "./components/ParcelPreview";
import { parcelEligibility } from "./lib/parcelEligibility";
import AreaDetail, { type DetailTab } from "./components/AreaDetail";
import EconomicsPanel from "./components/EconomicsPanel";
import ProvenancePanel from "./components/ProvenancePanel";
import MapView from "./map/MapView";
import { FRUITS, FRUIT_ORDER, economicsForFruit } from "./data/fruitProfiles";
import { DEFAULT_LAYERS } from "./data/layers";
import { parcelArea, type ParcelFeature } from "./lib/openData";
import { lookupCadastralParcel, AdapterError } from "./lib/adapters";
import {
  makeWorkingArea,
  mergeGeometries,
  splitGeometryByLine,
} from "./lib/geometryOperations";
import { useRegionalData } from "./lib/useRegionalData";
import { scoreRegionalArea } from "./lib/regionalScoring";
import { areaHa, bboxOf } from "./lib/geo";
import { fmtHa } from "./lib/format";
import {
  loadState,
  saveState,
  type PersistedState,
  type SplitRecord,
} from "./lib/storage";
import type {
  AnalysisArea,
  EconomicsInputs,
  FruitKey,
  SuitabilityResult,
} from "./lib/types";

type Focus = {
  bbox?: [number, number, number, number];
  center?: [number, number];
  zoom?: number;
  nonce: number;
};
const EMPTY_REGION = { kraj: "", okres: "", obec: "", katastr: "" };
const CZ: [number, number, number, number] = [12, 48.5, 18.9, 51.15];
const titles: Record<AppView, string> = {
  mapa: "Mapa a plánování výsadby",
  analyzy: "Analýza pozemku",
  pozemky: "Přehled pozemků",
  scenare: "Ekonomické scénáře",
  data: "Otevřená data a podklady",
  nastaveni: "Nastavení aplikace",
};
const defaults = () =>
  Object.fromEntries(
    FRUIT_ORDER.map((f) => [f, economicsForFruit(f)]),
  ) as Record<FruitKey, EconomicsInputs>;
function restoreWorking(boot: Partial<PersistedState> | null): AnalysisArea[] {
  const areas = boot?.workingAreas ?? [];
  if (!boot?.drawnGeometry || areas.some((a) => a.id === "custom"))
    return areas;
  return [
    ...areas,
    {
      id: "custom",
      name: boot.areaNames?.custom ?? "Dříve uložená plocha",
      kind: "custom",
      landUse: "starší pracovní vymezení",
      geometry: boot.drawnGeometry,
      location: {
        code: "PRACOVNÍ",
        katastr: "neurčeno",
        obec: "neurčeno",
        okres: "neurčeno",
        kraj: "neurčeno",
      },
      attributes: {
        soil: null,
        climate: null,
        water: null,
        terrain: null,
        access: null,
        constraints: null,
      },
      availability: {
        soil: "missing",
        climate: "missing",
        water: "missing",
        terrain: "missing",
        access: "missing",
      },
      sourceNote: "Zachované dřívější uživatelské vymezení.",
      story: "Starší uložená pracovní plocha; není oficiální parcelou.",
    },
  ];
}
const rawSource = (source: AnalysisArea): AnalysisArea => {
  const { regional, ...rest } = source;
  void regional;
  return rest;
};

export default function App() {
  const [boot] = useState(() => loadState());
  const [fruit] = useState<FruitKey>(boot?.fruit ?? "apple");
  const [fruitByArea, setFruitByArea] = useState<Record<string, FruitKey>>(
    boot?.fruitByArea ?? {},
  );
  const [parcels, setParcels] = useState<AnalysisArea[]>(boot?.parcels ?? []);
  const [workingAreas, setWorkingAreas] = useState<AnalysisArea[]>(() =>
    restoreWorking(boot),
  );
  const [names, setNames] = useState<Record<string, string>>(
    boot?.areaNames ?? {},
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(
    boot?.selectedIds ?? [],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [view, setView] = useState<AppView>("mapa");
  const [detailTab, setDetailTab] = useState<DetailTab>("prehled");
  const [economics, setEconomics] = useState<Record<FruitKey, EconomicsInputs>>(
    () => {
      const base = defaults();
      for (const f of FRUIT_ORDER)
        if (boot?.economicsByFruit?.[f])
          base[f] = { ...base[f], ...boot.economicsByFruit[f] };
      return base;
    },
  );
  const [irrigation, setIrrigation] = useState(boot?.irrigation ?? false);
  const [layers, setLayers] = useState({ ...DEFAULT_LAYERS, ...boot?.layers });
  const [showKraje, setShowKraje] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [searchMarker, setSearchMarker] = useState<{
    lat: number;
    lon: number;
    label: string;
  } | null>(null);
  const [mobileList, setMobileList] = useState(false);
  const [addOpen, setAddOpen] = useState(false),
    [parcelNumber, setParcelNumber] = useState(""),
    [territory, setTerritory] = useState(""),
    [lookupState, setLookupState] = useState(""),
    [lookupError, setLookupError] = useState("");
  const [lookupPreview, setLookupPreview] = useState<ParcelFeature | null>(
    null,
  );
  const [splitSourceId, setSplitSourceId] = useState<string | null>(null),
    [splitPoints, setSplitPoints] = useState<[number, number][]>([]);
  const [history, setHistory] = useState<SplitRecord[]>(
    boot?.splitHistory ?? [],
  );
  const [toast, setToast] = useState("");
  const lookupRequest = useRef(0);
  const sourceAreas = useMemo(
    () =>
      [...parcels, ...workingAreas].map((a) => ({
        ...a,
        name: names[a.id] ?? a.name,
      })),
    [parcels, workingAreas, names],
  );
  const { areas, retry } = useRegionalData(sourceAreas, [
    ...new Set([...selectedIds, ...(activeId ? [activeId] : [])]),
  ]);
  const areaIndex = useMemo(
    () => new Map(areas.map((a) => [a.id, a])),
    [areas],
  );
  const active = activeId ? (areaIndex.get(activeId) ?? null) : null;
  const areaFruit = useCallback(
    (id: string) => fruitByArea[id] ?? fruit,
    [fruitByArea, fruit],
  );
  const currentFruit = active ? areaFruit(active.id) : fruit;
  const inputs = economics[currentFruit];
  const evaluate = useCallback(
    (a: AnalysisArea, f: FruitKey) => scoreRegionalArea(a, f),
    [],
  );
  const scores = useMemo(
    () =>
      Object.fromEntries(
        areas.map((a) => [a.id, evaluate(a, areaFruit(a.id))]),
      ) as Record<string, SuitabilityResult>,
    [areas, evaluate, areaFruit],
  );
  const ranking = useMemo(
    () =>
      active
        ? (Object.fromEntries(
            FRUIT_ORDER.map((f) => [f, evaluate(active, f)]),
          ) as Record<FruitKey, SuitabilityResult>)
        : null,
    [active, evaluate],
  );
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => areaIndex.get(id))
        .filter((a): a is AnalysisArea => !!a),
    [selectedIds, areaIndex],
  );
  const splitSource = splitSourceId ? areaIndex.get(splitSourceId) : null;
  const split = useMemo(() => {
    if (!splitSource || splitPoints.length < 2)
      return { parts: null, error: "" };
    try {
      return {
        parts: splitGeometryByLine(splitSource.geometry, splitPoints),
        error: "",
      };
    } catch (e) {
      return {
        parts: null,
        error: e instanceof Error ? e.message : "Čára pozemek nerozděluje.",
      };
    }
  }, [splitSource?.geometry, splitPoints]);
  useEffect(() => {
    saveState({
      modelVersion: "moje-sady-2",
      fruit,
      fruitByArea,
      irrigation,
      selectedIds,
      activeId,
      region: EMPTY_REGION,
      layers,
      economicsByFruit: economics,
      drawnGeometry: null,
      parcels,
      workingAreas,
      areaNames: names,
      splitHistory: history,
    });
  }, [
    fruit,
    fruitByArea,
    irrigation,
    selectedIds,
    activeId,
    layers,
    economics,
    parcels,
    workingAreas,
    names,
    history,
  ]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const closeAdd = useCallback(() => {
    lookupRequest.current++;
    setLookupState("");
    setAddOpen(false);
    setLookupPreview(null);
    setLookupError("");
  }, []);
  const cancelSplit = useCallback(() => {
    setSplitSourceId(null);
    setSplitPoints([]);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        ((e.target as HTMLElement)?.tagName === "SELECT" && e.key === "Escape")
      )
        return;
      if (e.key === "Escape") {
        if (splitSourceId) cancelSplit();
        else {
          closeAdd();
          setDetailOpen(false);
        }
      }
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        )
      ) {
        e.preventDefault();
        document
          .querySelector<HTMLInputElement>(".location-search-input")
          ?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [cancelSplit, closeAdd, splitSourceId]);
  const selectArea = (id: string) => {
    const a = areaIndex.get(id);
    if (!a) return;
    cancelSplit();
    setSelectedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setActiveId(id);
    setDetailOpen(true);
    setView("mapa");
    setMobileList(false);
    setFocus({ bbox: bboxOf(a.geometry), nonce: Date.now() });
  };
  const addParcel = (feature: ParcelFeature) => {
    const eligibility = parcelEligibility(feature);
    if (!eligibility.allowed) {
      setToast(eligibility.reason);
      return false;
    }
    const a = parcelArea(feature);
    setParcels((previous) =>
      [...previous.filter((p) => p.id !== a.id), a].slice(-50),
    );
    setSelectedIds((ids) => [...new Set([...ids, a.id])]);
    setActiveId(a.id);
    setDetailOpen(true);
    setView("mapa");
    setMobileList(false);
    setFocus({ bbox: bboxOf(a.geometry), nonce: Date.now() });
    cancelSplit();
    return true;
  };
  const onFruitChange = (f: FruitKey) => {
    if (active) setFruitByArea((previous) => ({ ...previous, [active.id]: f }));
  };
  const onEconomicsChange = (patch: Partial<EconomicsInputs>) =>
    setEconomics((previous) => ({
      ...previous,
      [currentFruit]: { ...previous[currentFruit], ...patch },
    }));
  const deleteArea = (id: string) => {
    const a = areaIndex.get(id);
    if (!a) return;
    if (a.kind === "parcel")
      setParcels((items) => items.filter((p) => p.id !== id));
    else setWorkingAreas((items) => items.filter((p) => p.id !== id));
    {
      setNames((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      setFruitByArea((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
    }
    setSelectedIds((ids) => ids.filter((x) => x !== id));
    if (activeId === id) {
      setActiveId(null);
      setDetailOpen(false);
      cancelSplit();
    }
    setToast("Pozemek byl odstraněn z aplikace. Katastr zůstává beze změny.");
  };
  const startSplit = () => {
    if (!active) return;
    setSplitSourceId(active.id);
    setSplitPoints([]);
    setView("mapa");
    setDetailOpen(true);
    setFocus({ bbox: bboxOf(active.geometry), nonce: Date.now() });
  };
  const confirmSplit = () => {
    if (!splitSource || !split.parts) return;
    if (workingAreas.length + split.parts.length > 100) {
      setToast("Nejprve smažte nepotřebné pracovní části; limit je 100 ploch.");
      return;
    }
    const created = split.parts.map((g, i) =>
      makeWorkingArea(
        g,
        `${splitSource.name.slice(0, 80)} – část ${i + 1}`,
        [splitSource],
        "split",
      ),
    );
    setHistory((previous) =>
      [
        ...previous,
        {
          id: crypto.randomUUID(),
          source: rawSource(splitSource),
          childIds: created.map((a) => a.id),
          selectedIds: [...selectedIds],
          fruit: areaFruit(splitSource.id),
        },
      ].slice(-10),
    );
    setWorkingAreas((previous) => [...previous, ...created]);
    setFruitByArea((previous) => ({
      ...previous,
      ...Object.fromEntries(
        created.map((a) => [a.id, areaFruit(splitSource.id)]),
      ),
    }));
    setSelectedIds(created.map((a) => a.id));
    setActiveId(created[0].id);
    cancelSplit();
    setDetailOpen(true);
    setToast(
      `Vznikly ${created.length} uživatelské části. Každé můžete přiřadit vlastní ovocný druh.`,
    );
  };
  const undoSplit = () => {
    const record = history.at(-1);
    if (!record) return;
    const source = record.source;
    setWorkingAreas((items) => {
      const kept = items.filter((a) => !record.childIds.includes(a.id));
      return source.kind === "custom" && !kept.some((a) => a.id === source.id)
        ? [...kept, source]
        : kept;
    });
    if (source.kind === "parcel")
      setParcels((items) =>
        items.some((a) => a.id === source.id) ? items : [...items, source],
      );
    setHistory((items) => items.slice(0, -1));
    setSelectedIds([
      ...new Set([
        ...record.selectedIds.filter(
          (id) => areaIndex.has(id) && !record.childIds.includes(id),
        ),
        source.id,
      ]),
    ]);
    setActiveId(source.id);
    setFruitByArea((previous) => {
      const next = { ...previous };
      for (const id of record.childIds) delete next[id];
      next[source.id] ??= record.fruit;
      return next;
    });
    setNames((previous) => {
      const next = { ...previous };
      for (const id of record.childIds) delete next[id];
      return next;
    });
    cancelSplit();
    setDetailOpen(true);
    setView("mapa");
    setFocus({ bbox: bboxOf(source.geometry), nonce: Date.now() });
    setToast("Rozdělení bylo vráceno. Původní plocha je znovu vybraná.");
  };
  const mergeSelected = (name: string) => {
    if (selected.length < 2) {
      setToast("Pro spojení označte alespoň dva pozemky.");
      return;
    }
    try {
      if (workingAreas.length >= 100)
        throw Error("Lze uložit nejvýše 100 pracovních ploch.");
      const created = makeWorkingArea(
        mergeGeometries(selected.map((a) => a.geometry)),
        name,
        selected,
        "merge",
      );
      setWorkingAreas((items) => [...items, created]);
      setFruitByArea((previous) => ({
        ...previous,
        [created.id]: currentFruit,
      }));
      setSelectedIds([created.id]);
      setActiveId(created.id);
      setDetailOpen(true);
      setView("mapa");
      setFocus({ bbox: bboxOf(created.geometry), nonce: Date.now() });
      setToast("Plochy jsou spojené. Originály zůstávají uložené.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Spojení se nepodařilo.");
    }
  };
  const navigate = (next: AppView) => {
    cancelSplit();
    setView(next);
    if (next === "mapa") setMobileList(false);
  };
  const fullDetailProps =
    active && ranking
      ? {
          area: active,
          score: scores[active.id],
          ranking,
          fruit: currentFruit,
          onFruitChange,
          irrigation,
          onIrrigationChange: setIrrigation,
          economicsInputs: inputs,
          onEconomicsChange,
          onResetEconomics: () =>
            setEconomics((previous) => ({
              ...previous,
              [currentFruit]: economicsForFruit(currentFruit),
            })),
          selectedCount: selected.length,
          tab: detailTab,
          onTabChange: setDetailTab,
          onOpenProvenance: () => setView("data"),
          onOpenCompare: () => setView("pozemky"),
          onRetryData: () => retry(active),
        }
      : null;
  return (
    <div className={`app-shell${mobileList ? " show-parcels" : ""}`}>
      <SideNav view={view} onChange={navigate} />
      <header className="workspace-header">
        <div className="workspace-heading">
          <span className="eyebrow">Plánujte s jistotou</span>
          <strong>{titles[view]}</strong>
        </div>
        <div className="top-search">
          <IconSearch size={18} className="top-search-icon" />
          <LocationSearch
            onSelect={(place) => {
              setFocus({ bbox: place.bounds, nonce: Date.now() });
              setSearchMarker({
                lat: place.lat,
                lon: place.lon,
                label: place.label,
              });
              setView("mapa");
              setDetailOpen(false);
              cancelSplit();
            }}
          />
          <kbd>/</kbd>
        </div>
        <div className="header-actions">
          {history.length > 0 && (
            <button
              type="button"
              className="icon-button undo-split"
              onClick={undoSplit}
              aria-label="Vrátit poslední rozdělení"
              title="Vrátit poslední rozdělení"
            >
              <IconArrowBackUp size={20} />
              <span>Vrátit rozdělení</span>
            </button>
          )}
          <button
            type="button"
            className="icon-button mobile-parcels-toggle"
            onClick={() => setMobileList((v) => !v)}
            aria-expanded={mobileList}
            aria-label="Zobrazit seznam pozemků"
          >
            <IconList size={21} />
          </button>
          <span className="data-mode">Otevřená data</span>
        </div>
      </header>
      <ParcelList
        areas={areas}
        scores={scores}
        fruits={fruitByArea}
        defaultFruit={fruit}
        selectedIds={selectedIds}
        activeId={activeId}
        onSelect={selectArea}
        onToggle={(id) =>
          setSelectedIds((ids) =>
            ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
          )
        }
        onAdd={() => {
          setLookupError("");
          setAddOpen(true);
        }}
        onRename={(id, name) =>
          setNames((previous) => ({ ...previous, [id]: name }))
        }
        onDelete={deleteArea}
        onMerge={mergeSelected}
      />
      <main className="map-stage">
        <MapView
          areas={areas}
          scores={scores}
          selectedIds={selectedIds}
          activeId={activeId}
          layers={layers}
          showKraje={showKraje}
          focus={focus}
          detailOpen={detailOpen && view === "mapa"}
          splitMode={!!splitSourceId}
          splitPoints={splitPoints}
          splitPreview={split.parts}
          searchMarker={searchMarker}
          onAreaClick={selectArea}
          onParcelSelect={addParcel}
          onSplitPoint={(point) =>
            setSplitPoints((points) =>
              points.length < 2 ? [...points, point] : points,
            )
          }
          onSplitPointMove={(index, point) =>
            setSplitPoints((points) =>
              points.map((p, i) => (i === index ? point : p)),
            )
          }
          onCancelSplit={cancelSplit}
          onHome={() => {
            setFocus({ bbox: CZ, nonce: Date.now() });
            setDetailOpen(false);
            cancelSplit();
          }}
          onToggleLayer={(id) =>
            setLayers((previous) => ({ ...previous, [id]: !previous[id] }))
          }
          onToggleKraje={() => setShowKraje((v) => !v)}
        />
        {view === "mapa" &&
          detailOpen &&
          active &&
          !splitSourceId &&
          ranking && (
            <div className="floating-detail">
              <ParcelCard
                area={active}
                score={scores[active.id]}
                ranking={ranking}
                fruit={currentFruit}
                economicsInputs={inputs}
                onFruitChange={onFruitChange}
                onClose={() => setDetailOpen(false)}
                onSplit={startSplit}
                onAnalysis={() => setView("analyzy")}
                onRetryData={() => retry(active)}
                onEconomicsChange={onEconomicsChange}
              />
            </div>
          )}
        {view === "mapa" && splitSourceId && splitSource && (
          <section
            className="floating-detail split-card"
            aria-label="Rozdělit pozemek"
          >
            <header>
              <div>
                <span className="eyebrow">Uživatelské části</span>
                <h2>Rozdělit pozemek</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Zavřít rozdělení"
                onClick={cancelSplit}
              >
                <IconX size={19} />
              </button>
            </header>
            <p>
              <strong>{splitSource.name}</strong>
            </p>
            <p>
              Klikněte na začátek přímé čáry před hranicí pozemku a na její
              konec za protější hranicí. Body můžete potom posunout.
            </p>
            <div className="cut-step">
              <IconScissors size={22} />
              <span>
                {splitPoints.length === 0
                  ? "1. Určete začátek čáry"
                  : splitPoints.length === 1
                    ? "2. Určete konec čáry"
                    : "3. Zkontrolujte vzniklé části"}
              </span>
            </div>
            {split.error && (
              <p className="notice error" role="alert">
                {split.error}
              </p>
            )}
            {split.parts && (
              <ul className="cut-preview">
                {split.parts.map((g, i) => (
                  <li key={i}>
                    <span>Část {i + 1}</span>
                    <strong>{fmtHa(areaHa(g))}</strong>
                  </li>
                ))}
              </ul>
            )}
            <p className="tiny muted">
              Originál zůstane uložený. Jde o plánování výsadby, nikoli změnu
              katastru.
            </p>
            <div className="cut-buttons">
              <button
                type="button"
                className="btn primary"
                disabled={!split.parts}
                onClick={confirmSplit}
              >
                <IconCheck size={17} />
                Potvrdit rozdělení
              </button>
              <button type="button" className="btn" onClick={cancelSplit}>
                Zrušit
              </button>
              {splitPoints.length > 0 && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setSplitPoints([])}
                >
                  Nakreslit čáru znovu
                </button>
              )}
            </div>
          </section>
        )}
        {view === "mapa" && !detailOpen && !splitSourceId && (
          <div className="map-welcome">
            <IconMap size={18} />
            <span>
              Vyberte pozemek ze seznamu nebo přibližte mapu a klikněte na
              parcelu.
            </span>
          </div>
        )}
        {view !== "mapa" && (
          <section className="workspace-panel" aria-label={titles[view]}>
            <div className="workspace-panel-heading">
              <div>
                <span className="eyebrow">Moje pozemky</span>
                <h1>{titles[view]}</h1>
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => setView("mapa")}
              >
                <IconMap size={17} />
                Zpět na mapu
              </button>
            </div>
            {view === "analyzy" &&
              (fullDetailProps ? (
                <AreaDetail {...fullDetailProps} />
              ) : (
                <div className="panel-empty">
                  <IconInfoCircle size={26} />
                  <h2>Nejprve vyberte pozemek</h2>
                  <p>
                    Vyberte ho v seznamu nebo kliknutím do katastrální mapy.
                  </p>
                  <button
                    className="btn primary"
                    onClick={() => setView("mapa")}
                  >
                    Otevřít mapu
                  </button>
                </div>
              ))}
            {view === "scenare" &&
              (active ? (
                <EconomicsPanel
                  area={active}
                  areaHa={areaHa(active.geometry)}
                  fruit={currentFruit}
                  inputs={inputs}
                  irrigation={irrigation}
                  onChange={onEconomicsChange}
                  onIrrigationChange={setIrrigation}
                  onReset={() =>
                    setEconomics((previous) => ({
                      ...previous,
                      [currentFruit]: economicsForFruit(currentFruit),
                    }))
                  }
                />
              ) : (
                <div className="panel-empty">
                  <h2>Vyberte pozemek pro ekonomický scénář</h2>
                  <p>
                    Náklady a budoucí výnos jsou modelové vstupy, nikoli příslib
                    výsledku.
                  </p>
                </div>
              ))}
            {view === "pozemky" && (
              <>
                <p className="section-description">
                  Každý pozemek i jeho části mohou mít vlastní ovocný druh.
                  Přejmenování a pracovní hranice se ukládají v tomto
                  prohlížeči.
                </p>
                <div className="plot-table-wrap">
                  <table className="plot-table">
                    <thead>
                      <tr>
                        <th>Pozemek</th>
                        <th>Výměra</th>
                        <th>Ovocný druh</th>
                        <th>Vhodnost</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {areas.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <strong>{a.name}</strong>
                            <small>
                              {a.derivedFrom
                                ? "Uživatelská část"
                                : a.cadastral
                                  ? "Katastrální parcela"
                                  : "Uživatelská plocha"}
                            </small>
                          </td>
                          <td>{fmtHa(areaHa(a.geometry))}</td>
                          <td>{FRUITS[areaFruit(a.id)].name}</td>
                          <td>
                            {scores[a.id].overall === null
                              ? "Nedostatek dat"
                              : scores[a.id].overall + "/100"}
                          </td>
                          <td>
                            <button
                              className="btn small"
                              onClick={() => selectArea(a.id)}
                            >
                              Otevřít
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {view === "data" && (
              <ProvenancePanel onOpenAnalysis={() => setView("mapa")} />
            )}
            {view === "nastaveni" && (
              <div className="settings-grid">
                <section className="card">
                  <h2>Podklady hodnocení</h2>
                  <p>
                    Hodnocení používá pouze skutečné otevřené podklady přiřazené
                    geometrií a souřadnicemi pozemku. Chybějící údaje zůstávají
                    neznámé.
                  </p>
                  <p className="small">
                    Regionální index kombinuje BPEJ a klimatické řady. Není
                    pravděpodobností úspěchu. Ekonomické vstupy a pěstitelské
                    nároky jsou označené modelové předpoklady.
                  </p>
                </section>
                <section className="card">
                  <h2>Vaše data</h2>
                  <p>
                    Názvy, ovocné druhy, přidané parcely, uživatelské části a
                    posledních deset rozdělení se ukládají v tomto prohlížeči.
                    Kliknutí do mapy otevře náhled; pozemek uloží až tlačítko
                    Přidat pozemek.
                  </p>
                </section>
                <section className="card">
                  <h2>Jak přidat pozemek</h2>
                  <p>
                    Použijte katastrální mapu nebo vyhledání parcelního čísla.
                    Nový polygon se nekreslí; čárou můžete dělit již vybranou
                    plochu.
                  </p>
                  <button className="btn" onClick={() => setAddOpen(true)}>
                    Vyhledat parcelu
                  </button>
                </section>
              </div>
            )}
          </section>
        )}
      </main>
      {addOpen && (
        <Dialog title="Přidat parcelu z katastru" onClose={closeAdd}>
          <p>
            Vyplňte parcelní číslo a přesný název nebo šestimístný kód
            katastrálního území. Parcelu lze také vybrat přímo v mapě.
          </p>
          {!lookupPreview ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const request = ++lookupRequest.current;
                setLookupState("loading");
                setLookupError("");
                try {
                  const feature = await lookupCadastralParcel(
                    parcelNumber,
                    territory,
                  );
                  if (request !== lookupRequest.current) return;
                  const eligibility = parcelEligibility(feature);
                  if (!eligibility.allowed) {
                    setLookupError(eligibility.reason);
                    return;
                  }
                  setLookupPreview(feature);
                } catch (error) {
                  if (request !== lookupRequest.current) return;
                  setLookupError(
                    error instanceof AdapterError
                      ? error.message + ". " + error.detail
                      : error instanceof Error
                        ? error.message
                        : "Parcelu se nepodařilo najít.",
                  );
                } finally {
                  if (request === lookupRequest.current) setLookupState("");
                }
              }}
            >
              <label className="field">
                <span>Parcelní číslo</span>
                <input
                  required
                  placeholder="např. 1234/5"
                  value={parcelNumber}
                  onChange={(e) => {
                    lookupRequest.current++;
                    setLookupState("");
                    setLookupError("");
                    setParcelNumber(e.target.value);
                  }}
                />
              </label>
              <label className="field">
                <span>Katastrální území nebo jeho kód</span>
                <input
                  required
                  placeholder="např. Bílany nebo 604038"
                  value={territory}
                  onChange={(e) => {
                    lookupRequest.current++;
                    setLookupState("");
                    setLookupError("");
                    setTerritory(e.target.value);
                  }}
                />
              </label>
              {lookupError && (
                <p className="notice error" role="alert">
                  {lookupError}
                </p>
              )}
              <button
                className="btn primary"
                disabled={lookupState === "loading"}
              >
                {lookupState === "loading"
                  ? "Hledám parcelu…"
                  : "Vyhledat parcelu"}
              </button>
            </form>
          ) : (
            <ParcelPreview
              feature={lookupPreview}
              embedded
              onAdd={() => {
                if (addParcel(lookupPreview)) closeAdd();
              }}
              onClose={() => setLookupPreview(null)}
            />
          )}
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
