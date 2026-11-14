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
import ThemeToggle from "./components/ThemeToggle";
import CategoryScenarios from "./components/CategoryScenarios";
import ParcelOverview from "./components/ParcelOverview";
import type { PlantingPlanPanelProps } from "./components/PlantingPlanPanel";
import { usePlantingLayout } from "./lib/usePlantingLayout";
import {
  matchingPlantingPlan,
  type AppliedPlantingPlan,
  type PlantingPlansByArea,
} from "./lib/plantingPlan";
import { normalizeManualInputs, type ManualInputs } from "./lib/manualInputs";
import {
  normalizeCategoryState,
  createCategory,
  renameCategory,
  deleteCategory,
  assignCategory,
  officialParcelNumber,
} from "./lib/parcelCategories";
import { useTheme } from "./lib/theme";
import AnalysisBackdrop from "./components/AnalysisBackdrop";
import ParcelPreview from "./components/ParcelPreview";
import { parcelEligibility } from "./lib/parcelEligibility";
import AreaDetail, { type DetailTab } from "./components/AreaDetail";
import EconomicsPanel from "./components/EconomicsPanel";
import ProvenancePanel from "./components/ProvenancePanel";
import MapView from "./map/MapView";
import { FRUIT_ORDER, economicsForFruit } from "./data/fruitProfiles";
import { initialMapLayers, LAYER_SETTINGS_VERSION } from "./lib/mapPreferences";
import { parcelArea, type ParcelFeature } from "./lib/openData";
import { lookupCadastralParcel, AdapterError } from "./lib/adapters";
import {
  makeWorkingArea,
  mergeGeometries,
  splitGeometryByLine,
} from "./lib/geometryOperations";
import { useRegionalData } from "./lib/useRegionalData";
import { geometryKey } from "./lib/regionalData";
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
  const { regional, manualInputs, plantingPlan, ...rest } = source;
  void regional;
  void manualInputs;
  void plantingPlan;
  return rest;
};

export default function App() {
  const [theme, setTheme] = useTheme();
  const [boot] = useState(() => loadState());
  const [fruit] = useState<FruitKey>(boot?.fruit ?? "apple");
  const [fruitByArea, setFruitByArea] = useState<Record<string, FruitKey>>(
    boot?.fruitByArea ?? {},
  );
  const [parcels, setParcels] = useState<AnalysisArea[]>(boot?.parcels ?? []);
  const [workingAreas, setWorkingAreas] = useState<AnalysisArea[]>(() =>
    restoreWorking(boot),
  );
  const [categoryState, setCategoryState] = useState(() =>
    normalizeCategoryState(
      { categories: boot?.parcelCategories, assignments: boot?.categoryByArea },
      [...parcels, ...workingAreas].map((area) => area.id),
    ),
  );
  const [names, setNames] = useState<Record<string, string>>(
    boot?.areaNames ?? {},
  );
  const [manualByArea, setManualByArea] = useState<
    Record<string, ManualInputs>
  >(boot?.manualByArea ?? {});
  const [plantingPlans, setPlantingPlans] = useState<PlantingPlansByArea>(
    boot?.plantingPlans ?? {},
  );
  const [plantingVisible, setPlantingVisible] = useState(
    boot?.plantingVisible !== false,
  );
  const [plantingMapNonce, setPlantingMapNonce] = useState(0);
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
  const [layers, setLayers] = useState(() => initialMapLayers(boot));
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
        cadastral: a.cadastral
          ? {
              ...a.cadastral,
              parcelNumber: officialParcelNumber(a) ?? undefined,
            }
          : undefined,
        name: names[a.id] ?? a.name,
        manualInputs: manualByArea[a.id],
        plantingPlan: plantingPlans[a.id]?.[fruitByArea[a.id] ?? fruit],
      })),
    [
      parcels,
      workingAreas,
      names,
      manualByArea,
      plantingPlans,
      fruitByArea,
      fruit,
    ],
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
  const applyPlanting = useCallback((id: string, plan: AppliedPlantingPlan) => {
    setPlantingPlans((previous) => ({
      ...previous,
      [id]: { ...previous[id], [plan.fruit]: plan },
    }));
  }, []);
  const planting = usePlantingLayout(active, currentFruit, applyPlanting);
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
      layerSettingsVersion: LAYER_SETTINGS_VERSION,
      parcelCategories: categoryState.categories,
      categoryByArea: categoryState.assignments,
      manualByArea,
      plantingPlans,
      plantingVisible,
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
    categoryState,
    manualByArea,
    plantingPlans,
    plantingVisible,
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
    if (view !== "analyzy") setView("mapa");
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
    const existing = parcels.find((parcel) => parcel.id === a.id);
    if (!existing && parcels.length >= 50) {
      setToast(
        "Lze uložit nejvýše 50 katastrálních parcel. Nejdříve odstraňte nepotřebný pozemek.",
      );
      return false;
    }
    if (
      existing &&
      geometryKey(existing.geometry) !== geometryKey(a.geometry)
    ) {
      setManualByArea((previous) => {
        const next = { ...previous };
        delete next[a.id];
        return next;
      });
      setPlantingPlans((previous) => {
        const next = { ...previous };
        delete next[a.id];
        return next;
      });
    }
    setParcels((previous) => [...previous.filter((p) => p.id !== a.id), a]);
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
  const onManualChange = (value: ManualInputs | undefined) => {
    if (!active) return;
    setManualByArea((previous) => {
      const next = { ...previous };
      const normalized = normalizeManualInputs(value);
      if (normalized) next[active.id] = normalized;
      else delete next[active.id];
      return next;
    });
  };
  const onEconomicsChange = (patch: Partial<EconomicsInputs>) =>
    setEconomics((previous) => ({
      ...previous,
      [currentFruit]: { ...previous[currentFruit], ...patch },
    }));
  const deleteAreas = (ids: string[]) => {
    const removed = new Set(ids.filter((id) => areaIndex.has(id)));
    if (!removed.size) return;
    setParcels((items) => items.filter((area) => !removed.has(area.id)));
    setWorkingAreas((items) => items.filter((area) => !removed.has(area.id)));
    setNames((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([id]) => !removed.has(id)),
      ),
    );
    setFruitByArea((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([id]) => !removed.has(id)),
      ),
    );
    setManualByArea((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([id]) => !removed.has(id)),
      ),
    );
    setPlantingPlans((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([id]) => !removed.has(id)),
      ),
    );
    setCategoryState((previous) => ({
      ...previous,
      assignments: Object.fromEntries(
        Object.entries(previous.assignments).filter(([id]) => !removed.has(id)),
      ),
    }));
    setHistory((items) =>
      items.filter(
        (record) =>
          !removed.has(record.source.id) &&
          !record.childIds.some((id) => removed.has(id)),
      ),
    );
    setSelectedIds((selected) => selected.filter((id) => !removed.has(id)));
    if (activeId && removed.has(activeId)) {
      setActiveId(null);
      setDetailOpen(false);
    }
    if (splitSourceId && removed.has(splitSourceId)) {
      cancelSplit();
    }
    setToast(
      removed.size === 1
        ? "Pozemek byl odstraněn z aplikace."
        : `Odstraněno ${removed.size} pozemků z aplikace.`,
    );
  };
  const deleteArea = (id: string) => deleteAreas([id]);
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
          categoryBefore: categoryState.assignments[splitSource.id]
            ? { [splitSource.id]: categoryState.assignments[splitSource.id] }
            : {},
        },
      ].slice(-10),
    );
    setWorkingAreas((previous) => [...previous, ...created]);
    setCategoryState((previous) => {
      const assignments = { ...previous.assignments };
      const inherited = assignments[splitSource.id];
      delete assignments[splitSource.id];
      if (inherited)
        for (const child of created) assignments[child.id] = inherited;
      return { ...previous, assignments };
    });
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
    setManualByArea((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(
          ([id]) => !record.childIds.includes(id),
        ),
      ),
    );
    setPlantingPlans((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(
          ([id]) => !record.childIds.includes(id),
        ),
      ),
    );
    setCategoryState((previous) => {
      const assignments = { ...previous.assignments };
      for (const id of record.childIds) delete assignments[id];
      if (record.categoryBefore !== undefined) {
        delete assignments[source.id];
        const restored = record.categoryBefore[source.id];
        if (previous.categories.some((category) => category.id === restored))
          assignments[source.id] = restored;
      }
      return { ...previous, assignments };
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
      // A later merge depends on these shapes. Undoing an earlier split would
      // restore overlapping parents alongside the new merged plan.
      const consumed = new Set(selected.map((area) => area.id));
      setHistory((items) =>
        items.filter(
          (record) =>
            !consumed.has(record.source.id) &&
            !record.childIds.some((id) => consumed.has(id)),
        ),
      );
      setCategoryState((previous) => {
        const assignments = { ...previous.assignments };
        const sourceCategory = assignments[selected[0].id];
        const sameCategory =
          !!sourceCategory &&
          selected.every((area) => assignments[area.id] === sourceCategory);
        if (sameCategory) {
          for (const source of selected) delete assignments[source.id];
          assignments[created.id] = sourceCategory;
        }
        return { ...previous, assignments };
      });
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
    if (next === "analyzy" && view !== "analyzy") {
      setActiveId(null);
      setDetailTab("prehled");
    }
    setView(next);
    if (next === "mapa") setMobileList(false);
  };
  const closeAnalysis = useCallback(() => setView("mapa"), []);
  const plantingPanelProps: PlantingPlanPanelProps | undefined = active
    ? {
        area: active,
        fruit: currentFruit,
        applied: matchingPlantingPlan(active, currentFruit),
        layout: planting.layout,
        busy: planting.busy,
        error: planting.error,
        onGenerate: (settings, profileId) => {
          setPlantingVisible(true);
          planting.calculate(settings, profileId);
        },
        onClear: () => {
          planting.clear();
          setPlantingPlans((previous) => {
            const next = { ...previous },
              records = { ...next[active.id] };
            delete records[currentFruit];
            if (Object.keys(records).length) next[active.id] = records;
            else delete next[active.id];
            return next;
          });
        },
        onShowMap: () => {
          setView("mapa");
          setDetailOpen(true);
          setMobileList(false);
          setPlantingVisible(true);
          setPlantingMapNonce((value) => value + 1);
          setFocus({ bbox: bboxOf(active.geometry), nonce: Date.now() });
        },
        showOnMap: plantingVisible,
        onVisibilityChange: setPlantingVisible,
      }
    : undefined;
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
          onManualChange,
          planting: active ? plantingPanelProps : undefined,
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
          <ThemeToggle theme={theme} onChange={setTheme} />
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
        onDeleteSelected={deleteAreas}
        onMerge={mergeSelected}
        categoryControl={{
          state: categoryState,
          onCreate: (name) =>
            setCategoryState(createCategory(categoryState, name)),
          onRename: (id, name) =>
            setCategoryState(renameCategory(categoryState, id, name)),
          onDelete: (id) => setCategoryState(deleteCategory(categoryState, id)),
          onAssign: (ids, categoryId) =>
            setCategoryState(
              assignCategory(
                categoryState,
                ids.filter((id) => areaIndex.has(id)),
                categoryId,
              ),
            ),
        }}
      />
      <main className="map-stage">
        <MapView
          areas={areas}
          scores={scores}
          selectedIds={selectedIds}
          activeId={activeId}
          layers={layers}
          focus={focus}
          detailOpen={detailOpen && view === "mapa"}
          plantingLayout={
            plantingVisible && !splitSourceId ? planting.layout : null
          }
          plantingFruit={currentFruit}
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
                onManualChange={onManualChange}
                onEconomicsChange={onEconomicsChange}
                planting={plantingPanelProps}
                plantingMapNonce={plantingMapNonce}
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
          <AnalysisBackdrop
            enabled={view === "analyzy"}
            onClose={closeAnalysis}
          >
            <section className="workspace-panel" aria-label={titles[view]}>
              <div className="workspace-panel-scroll">
                <div className="workspace-panel-heading">
                  <div>
                    <span className="eyebrow">Moje pozemky</span>
                    <h1>{titles[view]}</h1>
                  </div>
                  {view === "analyzy" ? (
                    <button
                      className="icon-button"
                      type="button"
                      onClick={closeAnalysis}
                      aria-label="Zavřít detailní analýzu"
                      title="Zavřít detailní analýzu"
                    >
                      <IconX size={20} />
                    </button>
                  ) : (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => setView("mapa")}
                    >
                      <IconMap size={17} /> Zpět na mapu
                    </button>
                  )}
                </div>
                {view === "analyzy" && (
                  <label className="field analysis-area-picker">
                    <span className="field-label">Pozemek k analýze</span>
                    <select
                      value={activeId ?? ""}
                      onChange={(event) => {
                        if (event.target.value) selectArea(event.target.value);
                        else setActiveId(null);
                      }}
                    >
                      <option value="">Vyberte pozemek…</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {view === "analyzy" &&
                  (fullDetailProps ? (
                    <AreaDetail {...fullDetailProps} />
                  ) : (
                    <div className="panel-empty">
                      <IconInfoCircle size={26} />
                      <h2>Nejprve vyberte pozemek</h2>
                      <p>
                        Vyberte ho v seznamu nebo v poli nad tímto přehledem.
                        Analýza zůstane při změně pozemku otevřená.
                      </p>
                      <button
                        className="btn primary"
                        onClick={() => setView("mapa")}
                      >
                        Otevřít mapu
                      </button>
                    </div>
                  ))}
                {view === "scenare" && (
                  <>
                    <details className="scenario-explanation">
                      <summary>
                        <IconInfoCircle size={17} aria-hidden="true" /> Co jsou
                        scénáře?
                      </summary>
                      <p>
                        Scénář ukazuje, jak by se při zadaných cenách, nákladech
                        a výnosech mohla vyvíjet ekonomika sadu. Konzervativní,
                        základní a příznivá varianta mění tyto předpoklady.
                        Nejde o předpověď úrody ani zaručený zisk. Pro kategorii
                        se sčítají peněžní toky jejích pozemků.
                      </p>
                    </details>
                    <CategoryScenarios
                      areas={areas}
                      state={categoryState}
                      fruitByArea={fruitByArea}
                      defaultFruit={fruit}
                      economicsByFruit={economics}
                      irrigation={irrigation}
                    />
                    <section className="individual-scenario">
                      <h2>
                        Ekonomika pozemku
                        {active ? ` · ${active.name}` : ""}
                      </h2>
                      {active ? (
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
                            Náklady a budoucí výnos jsou modelové vstupy, nikoli
                            příslib výsledku.
                          </p>
                        </div>
                      )}
                    </section>
                  </>
                )}
                {view === "pozemky" && (
                  <ParcelOverview
                    areas={areas}
                    fruitForArea={(area) => areaFruit(area.id)}
                    scoreForArea={(area) => scores[area.id]}
                    onSelect={selectArea}
                  />
                )}
                {view === "data" && (
                  <ProvenancePanel onOpenAnalysis={() => setView("mapa")} />
                )}
              </div>
            </section>
          </AnalysisBackdrop>
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
