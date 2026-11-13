import { parcelArea, type ParcelFeature } from './lib/openData';
import {useRegionalData} from './lib/useRegionalData';
import {scoreRegionalArea} from './lib/regionalScoring';
import {makeWorkingArea} from './lib/geometryOperations';
import { useEffect, useMemo, useState } from 'react';
import AreaDetail, { type DetailTab } from './components/AreaDetail';
import ComparisonPanel from './components/ComparisonPanel';
import DemoTour from './components/DemoTour';
import LeftPanel, { type RegionSelection } from './components/LeftPanel';
import ProvenancePanel from './components/ProvenancePanel';
import TopBar from './components/TopBar';
import { DEMO_AREAS } from './data/demoAreas';
import { FRUIT_ORDER, FRUITS, economicsForFruit } from './data/fruitProfiles';
import { DEFAULT_LAYERS, MAP_LAYERS } from './data/layers';
import krajeGeo from './data/geo/kraje.json';
import type { PlaceResult } from './lib/adapters';
import { scoreArea } from './lib/scoring';
import { sumAreaHa, unionAreaHa, bboxOf } from './lib/geo';
import { clearState, loadState, saveState, type PersistedState } from './lib/storage';
import type {
  AnalysisArea,
  AreaGeometry,
  AvailabilityMap,
  EconomicsInputs,
  FruitKey,
  PolygonGeometry,
  SuitabilityResult,
} from './lib/types';
import MapView from './map/MapView';

const EMPTY_REGION: RegionSelection = { kraj: '', okres: '', obec: '', katastr: '' };
const CZ_BBOX: [number, number, number, number] = [12.0, 48.5, 18.9, 51.15];

type Focus = { center?: [number, number]; zoom?: number; bbox?: [number, number, number, number]; nonce: number };

type View = 'analyza' | 'porovnani' | 'zdroje';

const buildDefaultEconomics = (): Record<FruitKey, EconomicsInputs> =>
  Object.fromEntries(FRUIT_ORDER.map((fruit) => [fruit, economicsForFruit(fruit)])) as Record<
    FruitKey,
    EconomicsInputs
  >;

const matchesRegion = (area: AnalysisArea, region: RegionSelection): boolean =>
  (!region.kraj || area.location.kraj === region.kraj) &&
  (!region.okres || area.location.okres === region.okres) &&
  (!region.obec || area.location.obec === region.obec) &&
  (!region.katastr || area.location.katastr === region.katastr);

function boundsOfGeometry(geometry: unknown): [number, number, number, number] | null {
  let minX = 180;
  let minY = 90;
  let maxX = -180;
  let maxY = -90;
  let found = false;
  const walk = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      const lon = value[0] as number;
      const lat = value[1] as number;
      minX = Math.min(minX, lon);
      maxX = Math.max(maxX, lon);
      minY = Math.min(minY, lat);
      maxY = Math.max(maxY, lat);
      found = true;
      return;
    }
    value.forEach(walk);
  };
  walk((geometry as { coordinates?: unknown })?.coordinates);
  return found ? [minX, minY, maxX, maxY] : null;
}

const EMPTY_AVAILABILITY: AvailabilityMap = {
  soil: 'missing',
  climate: 'missing',
  water: 'missing',
  terrain: 'missing',
  access: 'missing',
};

const PARTIAL_AVAILABILITY: AvailabilityMap = {
  soil: 'partial',
  climate: 'partial',
  water: 'partial',
  terrain: 'partial',
  access: 'partial',
};

function makeCustomArea(
  geometry: PolygonGeometry,
  region: RegionSelection,
  profileId: string | null,
): AnalysisArea {
  const profile = profileId ? DEMO_AREAS.find((area) => area.id === profileId) : null;
  const attributes = profile
    ? profile.attributes
    : {
        soil: null,
        climate: null,
        water: null,
        terrain: null,
        access: null,
        constraints: null,
      };

  return {
    id: 'custom',
    name: 'Vlastní plocha',
    kind: 'custom',
    landUse: 'vlastní vymezení',
    geometry,
    location: {
      code: 'VLASTNÍ',
      katastr: region.katastr || 'neurčeno',
      obec: region.obec || 'neurčeno',
      okres: region.okres || 'neurčeno',
      kraj: region.kraj || 'neurčeno',
    },
    attributes,
    availability: profile ? { ...PARTIAL_AVAILABILITY } : { ...EMPTY_AVAILABILITY },
    sourceNote: profile
      ? 'Vlastní geometrie + modelový datový profil ukázkové plochy (výslovně označená demo data).'
      : 'Vlastní nakreslená geometrie bez připojených analytických dat. Skutečné otevřené podklady se připojují v pěti připravených výřezech a zobrazují samostatně.',
    story: profile
      ? 'Plocha zakreslená uživatelem s doplněným demo profilem. Slouží k předvedení modelu, ne k rozhodnutí o pozemku.'
      : 'Plocha zakreslená uživatelem. Protože chybí půdní, klimatické i vláhové podklady, výsledek poctivě hlásí „Nedostatek dat“.',
    irrigationAvailable: profile ? profile.irrigationAvailable : false,
  };
}

interface TourStep {
  title: string;
  text: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Celá Česká republika – a co je skutečně vyhodnocené',
    text: 'Mapa pokrývá celou ČR a jde přiblížit až na parcely. Analyticky je ale vyhodnoceno jen 5 ukázkových ploch – zbytek republiky záměrně nebarvíme, aby nevznikla falešná mapa vhodnosti.',
  },
  {
    title: 'Příznivý pozemek A – Haná',
    text: 'Plocha A u Kroměříže má hlubokou černozem, dostatek srážek i dobrý přístup. Podívejte se na tři důvody výsledku a na úplnost podkladů – ta je 100 %, protože jde o předpřipravenou ukázku.',
  },
  {
    title: 'Rizikový pozemek B – Žatecko',
    text: 'Stejný model, jiné podmínky: kvalitní půda, ale jen 410 mm srážek a vysoký index sucha. Pro jabloň je vláha pod mezní hodnotou, proto je výsledek „Rizikový“. Všimněte si i záplavového území – územní kolize se hodnotí zvlášť.',
  },
  {
    title: 'Zapněte závlahu',
    text: 'Přepínač „Modelovat doplňkovou závlahu“ mění vláhovou kategorii a tím i výsledek. Je to modelový předpoklad opatření – ne potvrzení, že je na pozemku zdroj vody a povolení.',
  },
  {
    title: 'Ekonomika se závlahou',
    text: 'Ekonomika se přepočítává ze vstupů: investice, roční náklady, náběh plodnosti i diskont. Závlaha zvyšuje investici, ale modelově i výnos. Podívejte se na návratnost a na scénáře.',
  },
  {
    title: 'Porovnání A, B a D',
    text: 'Tři pozemky vedle sebe: výměra, vhodnost pro stejný druh, rizika, doporučená výsadba, investice i úplnost dat. Společná výměra se počítá sjednocením geometrií, aby se překryvy nezapočítaly dvakrát.',
  },
  {
    title: 'Z čeho vycházíme',
    text: 'Poslední krok: každý ukazatel má zdroj, období, rozlišení a poctivý stav – skutečná data, modelový předpoklad, demo data, nebo nedostupné. Demo výsledky nikdy nevydáváme za skutečný výpočet.',
  },
];

export default function App() {
  const [boot] = useState<Partial<PersistedState> | null>(() => loadState());

  const [mode, setMode] = useState<'demo' | 'custom'>(boot?.modelVersion==='geo-1' ? boot.mode??'custom' : 'custom');
  const [fruit, setFruit] = useState<FruitKey>(boot?.fruit ?? 'apple');
  const [irrigation, setIrrigation] = useState<boolean>(boot?.irrigation ?? false);
  const [region, setRegion] = useState<RegionSelection>(boot?.region ?? EMPTY_REGION);
  const [layers, setLayers] = useState<Record<string, boolean>>({ ...DEFAULT_LAYERS, ...(boot?.layers ?? {}) });
  const [showKraje, setShowKraje] = useState(true);
  const [economicsByFruit, setEconomicsByFruit] = useState<Record<FruitKey, EconomicsInputs>>(() => {
    const base = buildDefaultEconomics();
    if (boot?.economicsByFruit) {
      for (const key of FRUIT_ORDER) {
        const saved = boot.economicsByFruit[key];
        if (saved) base[key] = { ...base[key], ...saved };
      }
    }
    return base;
  });

  const [parcels, setParcels] = useState<AnalysisArea[]>(boot?.parcels ?? []);
  const [workingAreas, setWorkingAreas] = useState<AnalysisArea[]>(boot?.workingAreas ?? []);
  const [areaNames, setAreaNames] = useState<Record<string, string>>(boot?.areaNames ?? {});
  const [hiddenSampleIds, setHiddenSampleIds] = useState<string[]>(boot?.hiddenSampleIds ?? []);
  const bootSelected = (boot?.selectedIds ?? []).filter((id) =>
    id === 'custom' ? Boolean(boot?.drawnGeometry) : [...DEMO_AREAS, ...parcels, ...workingAreas].some((area) => area.id === id) && !hiddenSampleIds.includes(id),
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(boot ? bootSelected : ['demo-a']);
  const [activeId, setActiveId] = useState<string | null>(boot ? (boot?.activeId && bootSelected.includes(boot.activeId) ? boot.activeId : bootSelected[0] ?? null) : 'demo-a');
  const [drawnGeometry, setDrawnGeometry] = useState<PolygonGeometry | null>(boot?.drawnGeometry ?? null);
  const [customProfileId, setCustomProfileId] = useState<string | null>(boot?.demoProfileId ?? null);

  const [view, setView] = useState<View>('analyza');
  const [detailTab, setDetailTab] = useState<DetailTab>('prehled');
  const [drawMode, setDrawMode] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [searchMarker, setSearchMarker] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  const customArea = useMemo(
    () => (drawnGeometry ? { ...makeCustomArea(drawnGeometry, region, customProfileId), name: areaNames.custom || 'Vlastní plocha' } : null),
    [drawnGeometry, region, customProfileId, areaNames.custom],
  );

  const storedAreas = useMemo<AnalysisArea[]>(
    () => [...DEMO_AREAS.filter(area => !hiddenSampleIds.includes(area.id)), ...parcels, ...workingAreas, ...(customArea ? [customArea] : [])]
      .map(area => areaNames[area.id] ? { ...area, name: areaNames[area.id] } : area),
    [customArea, parcels, workingAreas, areaNames, hiddenSampleIds],
  );

  const {areas:allAreas,retry:retryRegional}=useRegionalData(storedAreas,selectedIds,mode==='custom');
  const areaIndex = useMemo(() => new Map(allAreas.map((area) => [area.id, area])), [allAreas]);

  const visibleAreas = useMemo(
    () => allAreas.filter((area) => area.kind !== 'sample' || matchesRegion(area, region)),
    [allAreas, region, customArea],
  );

  const scores = useMemo<Record<string, SuitabilityResult>>(() => {
    const mapped: Record<string, SuitabilityResult> = {};
    for (const area of allAreas) {
      mapped[area.id] = area.regional ? scoreRegionalArea(area,fruit) : scoreArea(area, fruit, {
        irrigation: irrigation && area.irrigationAvailable !== false,
      });
    }
    return mapped;
  }, [allAreas, fruit, irrigation]);

  const rankings = useMemo<Record<string, Record<FruitKey, SuitabilityResult>>>(() => {
    const mapped: Record<string, Record<FruitKey, SuitabilityResult>> = {};
    for (const area of allAreas) {
      const perArea = {} as Record<FruitKey, SuitabilityResult>;
      for (const key of FRUIT_ORDER) {
        perArea[key] = area.regional ? scoreRegionalArea(area,key) : scoreArea(area, key, { irrigation: irrigation && area.irrigationAvailable !== false });
      }
      mapped[area.id] = perArea;
    }
    return mapped;
  }, [allAreas, irrigation]);

  const selectedAreas = useMemo(
    () => selectedIds.map((id) => areaIndex.get(id)).filter((area): area is AnalysisArea => Boolean(area)),
    [selectedIds, areaIndex],
  );

  const activeArea = activeId ? areaIndex.get(activeId) ?? null : null;
  const inputs = economicsByFruit[fruit] ?? economicsForFruit(fruit);

  const unionHa = useMemo(() => unionAreaHa(selectedAreas.map((area) => area.geometry)), [selectedAreas]);
  const sumHa = useMemo(() => sumAreaHa(selectedAreas.map((area) => area.geometry)), [selectedAreas]);

  /* ---------- ukládání do localStorage ---------- */
  useEffect(() => {
    saveState({
      modelVersion:'geo-1',
      mode,
      fruit,
      irrigation,
      selectedIds,
      activeId,
      region,
      layers,
      economicsByFruit,
      drawnGeometry,
      demoProfileId: customProfileId,
      parcels,
      workingAreas,
      areaNames,
      hiddenSampleIds,
    });
  }, [mode, fruit, irrigation, selectedIds, activeId, region, layers, economicsByFruit, drawnGeometry, customProfileId, parcels, workingAreas, areaNames, hiddenSampleIds]);

  /* ---------- toast ---------- */
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const focusArea = (area: AnalysisArea) => {
    setFocus({ bbox: bboxOf(area.geometry), nonce: Date.now() });
  };

  const handleSelectArea = (id: string) => {
    setView('analyza');
    if (selectedIds.includes(id)) {
      const next = selectedIds.filter((item) => item !== id);
      setSelectedIds(next);
      if (activeId === id) setActiveId(next[next.length - 1] ?? null);
      return;
    }
    setSelectedIds([...selectedIds, id]);
    setActiveId(id);
    const area = areaIndex.get(id);
    if (area) focusArea(area);
  };

  const handleRemoveArea = (id: string) => {
    const next = selectedIds.filter((item) => item !== id);
    setSelectedIds(next);
    if (activeId === id) setActiveId(next[next.length - 1] ?? null);
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
    setActiveId(null);
  };

  const handleRenameArea = (id: string, value: string) => {
    const name = value.trim();
    if (!areaIndex.has(id) || !name || name.length > 100) return;
    setAreaNames(previous => ({ ...previous, [id]: name }));
    setToast({ text: `Pozemek přejmenován na „${name}“. Název je uložený pouze v této aplikaci.` });
  };

  const handleDeleteArea = (id: string) => {
    const area = areaIndex.get(id);
    if (!area) return;
    const remaining = selectedIds.filter(item => item !== id);
    setSelectedIds(remaining);
    if (activeId === id) setActiveId(remaining[remaining.length - 1] ?? null);
    setAreaNames(previous => { const next = { ...previous }; delete next[id]; return next; });
    if (area.kind === 'sample') {
      setHiddenSampleIds(previous => [...new Set([...previous, id])]);
      setToast({ text: 'Ukázková plocha byla skryta. Tlačítko Obnovit demo ji vrátí.' });
    } else if (id === 'custom') {
      setDrawnGeometry(null);
      setCustomProfileId(null);
      setDrawMode(false);
      setDrawPoints([]);
      setToast({ text: 'Vlastní plocha byla smazána z této aplikace.' });
    } else if (area.kind === 'parcel') {
      setParcels(previous => previous.filter(parcel => parcel.id !== id));
      setToast({ text: 'Parcela byla smazána z uložených pozemků této aplikace. V katastru zůstává beze změny.' });
    } else {
      setWorkingAreas(previous => previous.filter(item => item.id !== id));
      setToast({ text: 'Pracovní plocha byla smazána. Původní pozemky zůstávají uložené.' });
    }
  };

  const handleSplitArea = (sourceId:string,parts:AreaGeometry[]) => {
    const source=areaIndex.get(sourceId);
    if(!source||parts.length<2)return;
    if(workingAreas.length+parts.length>100){setToast({text:'Lze uložit nejvýše 100 pracovních ploch. Nejprve smažte nepotřebné části.',error:true});return;}
    try{
      const created=parts.map((geometry,index)=>makeWorkingArea(geometry,`${source.name.slice(0,85)} – část ${index+1}`,[source],'split'));
      setWorkingAreas(previous=>[...previous,...created]);
      setSelectedIds(created.map(a=>a.id));setActiveId(created[0].id);
      setMode('custom');setView('analyza');setDetailTab('prehled');
      setFocus({bbox:bboxOf(source.geometry),nonce:Date.now()});
      setToast({text:`Vytvořeno ${created.length} samostatných částí. Původní plocha zůstává uložená; výběr nyní obsahuje nové části.`});
    }catch(error){setToast({text:error instanceof Error?error.message:'Rozdělení se nepodařilo.',error:true});}
  };

  const handleMergeAreas = (sourceIds:string[],geometry:AreaGeometry,name:string) => {
    const sources=sourceIds.map(id=>areaIndex.get(id)).filter((a):a is AnalysisArea=>Boolean(a));
    if(sources.length<2)return;
    if(workingAreas.length>=100){setToast({text:'Lze uložit nejvýše 100 pracovních ploch. Nejprve smažte nepotřebné části.',error:true});return;}
    try{
      const created=makeWorkingArea(geometry,name,sources,'merge');
      setWorkingAreas(previous=>[...previous,created]);setSelectedIds([created.id]);setActiveId(created.id);
      setMode('custom');setView('analyza');setDetailTab('prehled');
      setFocus({bbox:bboxOf(geometry),nonce:Date.now()});
      setToast({text:'Spojená pracovní plocha je uložená a vybraná. Původní pozemky zůstávají uložené; překryvy se počítají jednou.'});
    }catch(error){setToast({text:error instanceof Error?error.message:'Spojení se nepodařilo.',error:true});}
  };

  const handleRegionChange = (next: RegionSelection) => {
    setRegion(next);
    const match = DEMO_AREAS.find((area) => matchesRegion(area, next));
    if (match) {
      focusArea(match);
      return;
    }
    if (next.kraj) {
      const feature = (krajeGeo as unknown as { features: { properties: { name: string }; geometry: unknown }[] }).features.find(
        (item) => item.properties.name === next.kraj,
      );
      const bbox = feature ? boundsOfGeometry(feature.geometry) : null;
      if (bbox) {
        setFocus({ bbox, nonce: Date.now() });
        return;
      }
    }
    setFocus({ bbox: CZ_BBOX, nonce: Date.now() });
  };

  const handleKrajClick = (name: string) => {
    const next: RegionSelection = { kraj: name, okres: '', obec: '', katastr: '' };
    setRegion(next);
    const feature = (krajeGeo as unknown as { features: { properties: { name: string }; geometry: unknown }[] }).features.find(
      (item) => item.properties.name === name,
    );
    const bbox = feature ? boundsOfGeometry(feature.geometry) : null;
    if (bbox) setFocus({ bbox, nonce: Date.now() });
  };

  const handleParcelSelect = (feature: ParcelFeature) => {
    const selected = parcelArea(feature);
    setParcels(previous => [...previous.filter(p => p.id !== selected.id), selected].slice(-50));
    setSelectedIds(previous => [...new Set([...previous, selected.id])]);
    setActiveId(selected.id);
    setMode('custom');
    setView('analyza');
    setDetailTab('prehled');
    setFocus({bbox:bboxOf(selected.geometry),nonce:Date.now()});
  };

  const handleFruitChange = (next: FruitKey) => setFruit(next);

  const updateEconomics = (patch: Partial<EconomicsInputs>) => {
    setEconomicsByFruit((previous) => ({
      ...previous,
      [fruit]: { ...previous[fruit], ...patch },
    }));
  };

  const resetEconomics = () => {
    setEconomicsByFruit((previous) => ({ ...previous, [fruit]: economicsForFruit(fruit) }));
    setToast({ text: `Ekonomické vstupy pro ${FRUITS[fruit].name.toLowerCase()} vráceny na výchozí hodnoty.` });
  };

  const handleToggleLayer = (id: string) => {
    setLayers((previous) => ({ ...previous, [id]: !previous[id] }));
  };

  const handleSelectPlace = (place: PlaceResult) => {
    setSearchMarker({ lat: place.lat, lon: place.lon, label: place.label });
    setFocus({ center: [place.lon, place.lat], zoom: 14, nonce: Date.now() });
    setView('analyza');
    setToast({ text: 'Lokalita nalezena v Nominatim / OpenStreetMap. Přibližuji mapu.' });
  };

  const handleModeChange = (next: 'demo' | 'custom') => {
    setMode(next);
    setView('analyza');
    if (next === 'custom') {
      setToast({
        text: 'Režim vlastního pozemku: data se pokusíme ověřit ve veřejných zdrojích, jinak je zobrazíme jako nedostupná.',
      });
    }
  };

  /* ---------- kreslení ---------- */
  const handleStartDraw = () => {
    setMode('custom');
    setView('analyza');
    setDrawMode(true);
    const existing = drawnGeometry?.coordinates[0]?.slice(0, -1).map(([lon, lat]) => [lon, lat] as [number, number]);
    setDrawPoints(existing && existing.length >= 3 ? existing : []);
  };

  const handleFinishDraw = () => {
    if (drawPoints.length < 3) return;
    const ring = [...drawPoints, drawPoints[0]];
    setDrawnGeometry({ type: 'Polygon', coordinates: [ring] });
    setDrawMode(false);
    setDrawPoints([]);
    setSelectedIds((previous) => (previous.includes('custom') ? previous : [...previous, 'custom']));
    setActiveId('custom');
    setDetailTab('prehled');
    setMode('custom');
    setView('analyza');
    setToast({ text: 'Vlastní plocha uložena. Výměra a obvod se počítají z nakreslené geometrie.' });
  };

  const handleCancelDraw = () => {
    setDrawMode(false);
    setDrawPoints([]);
  };

  const handleDeleteCustom = () => {
    handleDeleteArea('custom');
  };

  const handleVertexMove = (index: number, lonLat: [number, number]) => {
    setDrawPoints((previous) => previous.map((point, i) => (i === index ? lonLat : point)));
  };

  const handleResetDemo = () => {
    clearState();
    setParcels([]);
    setWorkingAreas([]);
    setAreaNames({});
    setHiddenSampleIds([]);
    setMode('demo');
    setFruit('apple');
    setIrrigation(false);
    setSelectedIds(['demo-a']);
    setActiveId('demo-a');
    setRegion(EMPTY_REGION);
    setLayers({ ...DEFAULT_LAYERS });
    setShowKraje(true);
    setDrawnGeometry(null);
    setCustomProfileId(null);
    setDrawMode(false);
    setDrawPoints([]);
    setSearchMarker(null);
    setTourStep(null);
    setView('analyza');
    setDetailTab('prehled');
    setEconomicsByFruit(buildDefaultEconomics());
    setFocus({ bbox: CZ_BBOX, nonce: Date.now() });
    setToast({ text: 'Demo bylo obnoveno do výchozího stavu včetně vymazaného místního uložení.' });
  };

  /* ---------- ukázková prezentace ---------- */
  const runTourStep = (step: number) => {
    setView('analyza');
    const areaA = areaIndex.get('demo-a');
    const areaB = areaIndex.get('demo-b');
    switch (step) {
      case 0:
        setMode('demo');
        setFruit('apple');
        setIrrigation(false);
        setDetailTab('prehled');
        setSearchMarker(null);
        setFocus({ bbox: CZ_BBOX, nonce: Date.now() });
        break;
      case 1:
        setMode('demo');
        setFruit('apple');
        setIrrigation(false);
        setRegion({ kraj: 'Zlínský kraj', okres: 'Kroměříž', obec: 'Kroměříž', katastr: 'Bílany' });
        setSelectedIds(['demo-a']);
        setActiveId('demo-a');
        setDetailTab('prehled');
        if (areaA) focusArea(areaA);
        break;
      case 2:
        setMode('demo');
        setFruit('apple');
        setIrrigation(false);
        setRegion({ kraj: 'Ústecký kraj', okres: 'Louny', obec: 'Staňkovice', katastr: 'Staňkovice u Žatce' });
        setSelectedIds(['demo-b']);
        setActiveId('demo-b');
        setDetailTab('prehled');
        if (areaB) focusArea(areaB);
        break;
      case 3:
        setIrrigation(true);
        setDetailTab('prehled');
        break;
      case 4:
        setDetailTab('ekonomika');
        break;
      case 5:
        setSelectedIds(['demo-a', 'demo-b', 'demo-d']);
        setActiveId('demo-b');
        setView('porovnani');
        break;
      case 6:
        setView('zdroje');
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (tourStep == null) return;
    runTourStep(tourStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStep]);

  const startTour = () => {
    setHiddenSampleIds([]);
    setTourStep(0);
    runTourStep(0);
  };

  const activeLayers = MAP_LAYERS.filter((layer) => layers[layer.id]);
  const scopeLabel = region.kraj
    ? `Oblast: ${region.kraj}${region.okres ? ` · ${region.okres}` : ''}${region.katastr ? ` · ${region.katastr}` : ''}`
    : 'Zobrazena celá Česká republika';

  return (
    <div className="app">
      <TopBar
        view={view}
        onViewChange={setView}
        mode={mode}
        onModeChange={handleModeChange}
        onStartTour={startTour}
        onReset={handleResetDemo}
      />

      <div className="workspace">
        <LeftPanel
          mode={mode}
          region={region}
          onRegionChange={handleRegionChange}
          areas={visibleAreas}
          allDemoCount={DEMO_AREAS.length}
          scores={scores}
          fruitName={FRUITS[fruit].name}
          selectedIds={selectedIds}
          activeId={activeId}
          activeArea={activeArea}
          selectedAreas={selectedAreas}
          onSplitArea={handleSplitArea}
          onMergeAreas={handleMergeAreas}
          onSelectArea={handleSelectArea}
          onRemoveArea={handleRemoveArea}
          onRenameArea={handleRenameArea}
          onDeleteArea={handleDeleteArea}
          onClearSelection={handleClearSelection}
          layers={layers}
          onToggleLayer={handleToggleLayer}
          showKraje={showKraje}
          onToggleKraje={() => setShowKraje((value) => !value)}
          onSelectPlace={handleSelectPlace}
          onParcelSelect={handleParcelSelect}
          customProfileId={customProfileId}
          onCustomProfileChange={(id) => {
            setCustomProfileId(id);
            setToast({
              text: id
                ? 'Doplněn modelový datový profil. Jde o výslovně označená demo data, ne o skutečné podklady.'
                : 'Modelový profil odebrán. Vlastní plocha bude hlásit nedostatek dat.',
            });
          }}
          drawMode={drawMode}
          drawPoints={drawPoints.length}
          customArea={customArea}
          onStartDraw={handleStartDraw}
          onFinishDraw={handleFinishDraw}
          onCancelDraw={handleCancelDraw}
          onDeleteCustom={handleDeleteCustom}
          activeLayers={activeLayers}
        />

        <MapView
          onParcelSelect={handleParcelSelect}
          areas={visibleAreas}
          scores={scores}
          selectedIds={selectedIds}
          activeId={activeId}
          layers={layers}
          showKraje={showKraje}
          selectedKraj={region.kraj}
          focus={focus}
          drawMode={drawMode}
          drawPoints={drawPoints}
          customGeometry={drawnGeometry}
          searchMarker={searchMarker}
          scopeLabel={scopeLabel}
          mode={mode}
          onAreaClick={handleSelectArea}
          onMapClick={(lonLat) => {
            if (!drawMode) return;
            setDrawPoints((previous) => [...previous, lonLat]);
          }}
          onVertexMove={handleVertexMove}
          onKrajClick={handleKrajClick}
          onHome={() => setFocus(null)}
          onStartDraw={handleStartDraw}
          onFinishDraw={handleFinishDraw}
          onCancelDraw={handleCancelDraw}
          onClearSelection={handleClearSelection}
        />

        <aside className="panel panel-right" aria-label="Detail pozemku a výsledky">
          <div className="right-scroll">
            {view === 'analyza' &&
              (activeArea ? (
                <AreaDetail
                  onRetryData={()=>retryRegional(activeArea)}
                  key={activeArea.id}
                  area={activeArea}
                  score={scores[activeArea.id]}
                  ranking={rankings[activeArea.id]}
                  fruit={fruit}
                  onFruitChange={handleFruitChange}
                  irrigation={irrigation}
                  onIrrigationChange={(value) => {
                    setIrrigation(value);
                    if (value && activeArea.irrigationAvailable === false) {
                      setToast({
                        text: 'Závlaha není u této plochy dostupná – chybí ověřený zdroj vody.',
                        error: true,
                      });
                    }
                  }}
                  economicsInputs={inputs}
                  onEconomicsChange={updateEconomics}
                  onResetEconomics={resetEconomics}
                  selectedCount={selectedCount(selectedIds)}
                  tab={detailTab}
                  onTabChange={setDetailTab}
                  onOpenProvenance={() => setView('zdroje')}
                  onOpenCompare={() => setView('porovnani')}
                />
              ) : (
                <div className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    ⌖
                  </div>
                  <div className="empty-title">Vyberte pozemek</div>
                  <p className="empty-text">
                    Klikněte na ukázkovou plochu v mapě nebo v seznamu, anebo nakreslete vlastní plochu. Zjistíte
                    podmínky, rizika, doporučenou výsadbu i orientační ekonomiku.
                  </p>
                  <div className="quick-areas">
                    {DEMO_AREAS.slice(0, 3).map((area) => (
                      <button
                        key={area.id}
                        type="button"
                        className="btn"
                        onClick={() => {
                          setHiddenSampleIds(previous => previous.filter(id => id !== area.id));
                          setSelectedIds([area.id]);
                          setActiveId(area.id);
                          focusArea(area);
                        }}
                      >
                        {area.tag} · {area.location.katastr}
                      </button>
                    ))}
                  </div>
                  <div className="notice" style={{ textAlign: 'left' }}>
                    <strong>Poctivé pokrytí:</strong> mapa je celorepubliková, ale analyticky vyhodnocených je jen{' '}
                    {DEMO_AREAS.length} ukázkových ploch. Ostatní území není vydávané za vypočtenou vhodnost.
                  </div>
                </div>
              ))}

            {view === 'porovnani' && (
              <ComparisonPanel
                areas={selectedAreas}
                scores={scores}
                fruit={fruit}
                irrigation={irrigation}
                inputs={inputs}
                unionHa={unionHa}
                sumHa={sumHa}
                onSelectArea={handleSelectArea}
                onRemoveArea={handleRemoveArea}
                onClearSelection={handleClearSelection}
                onAddSamples={() => {
                  setHiddenSampleIds(previous => previous.filter(id => !['demo-a', 'demo-b', 'demo-c'].includes(id)));
                  setSelectedIds(['demo-a', 'demo-b', 'demo-c']);
                  setActiveId('demo-a');
                }}
                onOpenAnalysis={() => setView('analyza')}
                onOpenDetail={(id) => {
                  setActiveId(id);
                  setDetailTab('prehled');
                  setView('analyza');
                  const area = areaIndex.get(id);
                  if (area) focusArea(area);
                }}
              />
            )}

            {view === 'zdroje' && <ProvenancePanel onOpenAnalysis={() => setView('analyza')} />}
          </div>
        </aside>
      </div>

      {tourStep != null && (
        <DemoTour
          step={tourStep}
          total={TOUR_STEPS.length}
          title={TOUR_STEPS[tourStep].title}
          text={TOUR_STEPS[tourStep].text}
          onNext={() => setTourStep((step) => (step == null ? null : Math.min(TOUR_STEPS.length - 1, step + 1)))}
          onClose={() => setTourStep(null)}
          onRestart={() => {
            setTourStep(0);
            runTourStep(0);
          }}
        />
      )}

      {toast && <div className={`toast${toast.error ? ' error' : ''}`}>{toast.text}</div>}
    </div>
  );
}

function selectedCount(ids: string[]): number {
  return ids.length;
}
