import type {ParcelFeature} from '../lib/openData';
import { useMemo, useState } from 'react';
import { MAP_LAYERS } from '../data/layers';
import { KRAJE, okresyForKraj, obceForOkres } from '../data/regions';
import { AdapterError, lookupCadastralParcel, searchPlaces, type PlaceResult } from '../lib/adapters';
import { areaHa, perimeterM } from '../lib/geo';
import { fmtHa, fmtM } from '../lib/format';
import type { AnalysisArea, MapLayerDef, SuitabilityResult } from '../lib/types';
import { QualityBadge, VerdictBadge } from './ui';
import GeometryTools from './GeometryTools';
import type {AreaGeometry} from '../lib/types';

export interface RegionSelection {
  kraj: string;
  okres: string;
  obec: string;
  katastr: string;
}

interface LeftPanelProps {
  mode: 'demo' | 'custom';
  region: RegionSelection;
  onRegionChange: (region: RegionSelection) => void;
  areas: AnalysisArea[];
  allDemoCount: number;
  scores: Record<string, SuitabilityResult | undefined>;
  fruitName: string;
  selectedIds: string[];
  activeId: string | null;
  activeArea: AnalysisArea | null;
  selectedAreas: AnalysisArea[];
  onSplitArea: (sourceId:string,parts:AreaGeometry[])=>void;
  onMergeAreas: (sourceIds:string[],geometry:AreaGeometry,name:string)=>void;
  onSelectArea: (id: string) => void;
  onRemoveArea: (id: string) => void;
  onRenameArea: (id: string, name: string) => void;
  onDeleteArea: (id: string) => void;
  onClearSelection: () => void;
  layers: Record<string, boolean>;
  onToggleLayer: (id: string) => void;
  showKraje: boolean;
  onToggleKraje: () => void;
  onParcelSelect: (parcel:ParcelFeature)=>void;
  onSelectPlace: (place: PlaceResult) => void;
  customProfileId: string | null;
  onCustomProfileChange: (id: string | null) => void;
  drawMode: boolean;
  drawPoints: number;
  customArea: AnalysisArea | null;
  onStartDraw: () => void;
  onFinishDraw: () => void;
  onCancelDraw: () => void;
  onDeleteCustom: () => void;
  activeLayers: MapLayerDef[];
}

export default function LeftPanel(props: LeftPanelProps) {
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'ok' | 'error' | 'empty'>('idle');
  const [searchError, setSearchError] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [parcelNumber, setParcelNumber] = useState('');
  const [parcelKatastr, setParcelKatastr] = useState(props.region.katastr);
  const [parcelState, setParcelState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [parcelError, setParcelError] = useState<{ message: string; detail: string } | null>(null);

  const okresy = useMemo(() => (props.region.kraj ? okresyForKraj(props.region.kraj) : []), [props.region.kraj]);
  const obce = useMemo(() => (props.region.okres ? obceForOkres(props.region.okres) : []), [props.region.okres]);
  const katastry = useMemo(() => obce.find((obec) => obec.name === props.region.obec)?.katastry ?? [], [obce, props.region.obec]);

  const hasRegionFilter = Boolean(props.region.kraj || props.region.okres || props.region.obec || props.region.katastr);

  const handleSearch = async () => {
    setSearchState('loading');
    setSearchError('');
    try {
      const found = await searchPlaces(query);
      setResults(found);
      setSearchState(found.length > 0 ? 'ok' : 'empty');
    } catch (error) {
      setSearchState('error');
      setSearchError(
        error instanceof AdapterError ? `${error.message}. ${error.detail}` : 'Vyhledávání se nepodařilo.',
      );
    }
  };

  const handleParcel = async () => {
    setParcelState('loading');
    setParcelError(null);
    try {
      const parcel=await lookupCadastralParcel(parcelNumber, parcelKatastr);
      props.onParcelSelect(parcel);
    } catch (error) {
      setParcelState('error');
      setParcelError({
        message: error instanceof AdapterError ? error.message : 'Parcelu se nepodařilo ověřit',
        detail: error instanceof AdapterError ? error.detail : 'Neznámá chyba.',
      });
    } finally {
      setParcelState((state) => (state === 'loading' ? 'idle' : state));
    }
  };

  const updateRegion = (patch: Partial<RegionSelection>) => {
    props.onRegionChange({ ...props.region, ...patch });
  };

  return (
    <aside className="panel panel-left" aria-label="Vyhledávání a výběr pozemků">
      <section className="panel-section">
        <div className="section-head">
          <div className="section-title with-icon">
            <span aria-hidden="true">⌕</span> Najít lokalitu
          </div>
        </div>
        <div className="search-box">
          <input
            type="search"
            placeholder="Obec, k. ú. nebo adresa (min. 3 znaky)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleSearch();
            }}
            aria-label="Vyhledat lokalitu"
          />
          <button type="button" className="btn" onClick={() => void handleSearch()} disabled={searchState === 'loading'}>
            {searchState === 'loading' ? '…' : 'Hledat'}
          </button>
        </div>
        <div className={`search-status${searchState === 'error' ? ' error' : ''}`}>
          {searchState === 'idle' && 'Vyhledávání běží přes Nominatim (OpenStreetMap).'}
          {searchState === 'loading' && 'Hledám v otevřených datech…'}
          {searchState === 'ok' && `${results.length} výsledků ze zdroje Nominatim / OSM.`}
          {searchState === 'empty' && 'Nic nenalezeno. Zkuste jiný název nebo vyberte kraj v mapě.'}
          {searchState === 'error' && searchError}
        </div>
        {results.length > 0 && (
          <ul className="search-results">
            {results.map((place) => (
              <li key={`${place.lat}-${place.lon}-${place.label}`}>
                <button
                  type="button"
                  onClick={() => {
                    props.onSelectPlace(place);
                    setResults([]);
                    setSearchState('idle');
                  }}
                >
                  <span>{place.label}</span>
                  <span className="place-type">
                    {place.type} · {place.source}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel-section">
        <div className="section-head">
          <div className="section-title">Výběr oblasti</div>
          {hasRegionFilter && (
            <button
              type="button"
              className="link-button"
              onClick={() => props.onRegionChange({ kraj: '', okres: '', obec: '', katastr: '' })}
            >
              Zrušit filtr
            </button>
          )}
        </div>
        <div className="region-grid">
          <label className="field">
            <span>Kraj</span>
            <select
              value={props.region.kraj}
              onChange={(event) => updateRegion({ kraj: event.target.value, okres: '', obec: '', katastr: '' })}
            >
              <option value="">Celá Česká republika</option>
              {KRAJE.map((kraj) => (
                <option key={kraj.code} value={kraj.name}>
                  {kraj.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Okres</span>
            <select
              value={props.region.okres}
              disabled={!props.region.kraj}
              onChange={(event) => updateRegion({ okres: event.target.value, obec: '', katastr: '' })}
            >
              <option value="">{props.region.kraj ? 'Všechny okresy' : 'Nejprve zvolte kraj'}</option>
              {okresy.map((okres) => (
                <option key={okres} value={okres}>
                  {okres}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Obec</span>
            <select
              value={props.region.obec}
              disabled={!props.region.okres || obce.length === 0}
              onChange={(event) => updateRegion({ obec: event.target.value, katastr: '' })}
            >
              <option value="">
                {!props.region.okres
                  ? 'Nejprve zvolte okres'
                  : obce.length === 0
                    ? 'V demu bez obcí'
                    : 'Všechny obce'}
              </option>
              {obce.map((obec) => (
                <option key={obec.name} value={obec.name}>
                  {obec.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Katastrální území</span>
            <select
              value={props.region.katastr}
              disabled={!props.region.obec || katastry.length === 0}
              onChange={(event) => updateRegion({ katastr: event.target.value })}
            >
              <option value="">{katastry.length === 0 ? 'Bez dostupných k. ú.' : 'Všechna k. ú.'}</option>
              {katastry.map((katastr) => (
                <option key={katastr} value={katastr}>
                  {katastr}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field-note" style={{ marginTop: 7 }}>
          Kraje a okresy odpovídají členění ČR. Obce a katastrální území jsou v demu jen u připravených lokalit –
          úplný číselník RÚIAN není přibalen.
        </div>
      </section>

      <section className="panel-section">
        <div className="section-head">
          <div className="section-title">
            Pozemky a plochy <span className="muted">({props.areas.length})</span>
          </div>
          {props.selectedIds.length > 0 && (
            <button type="button" className="link-button" onClick={props.onClearSelection}>
              Zrušit výběr
            </button>
          )}
        </div>

        {props.selectedIds.length > 0 && (
          <div className="selection-chips" style={{ marginBottom: 9 }}>
            {props.selectedIds.map((id) => {
              const area = props.areas.find((item) => item.id === id);
              return (
                <span className="chip" key={id}>
                  {area ? area.name : id}
                  <button type="button" onClick={() => props.onRemoveArea(id)} aria-label={`Odebrat ${area?.name ?? id} z výběru`}>
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {props.areas.length === 0 && (
          <div className="notice">
            <strong>Pro tuto oblast nejsou ukázkové plochy.</strong> Demo neobsahuje vyhodnocení všech pozemků ČR.
            Zvolte jiný kraj, vyhledejte lokalitu nebo nakreslete vlastní plochu.
          </div>
        )}

        <div className="area-list">
          {props.areas.map((area) => {
            const score = props.scores[area.id];
            const selected = props.selectedIds.includes(area.id);
            const verdictClass = score?.verdictClass ?? 'nodata';
            return (
              <div key={area.id} className="saved-area-entry" data-area-id={area.id}>
              <button
                type="button"
                style={{width:'100%'}}
                className={`area-card${selected ? ' selected' : ''}${props.activeId === area.id ? ' active' : ''}`}
                onClick={() => props.onSelectArea(area.id)}
                aria-pressed={selected}
              >
                <span className={`tag ${verdictClass}`}>{area.tag ?? 'V'}</span>
                <span>
                  <span className="area-name" style={{overflowWrap:'anywhere'}}>{area.name}</span>
                  <span className="area-meta">
                    {area.location.katastr} · {fmtHa(areaHa(area.geometry))} · {area.landUse}
                  </span>
                  <span className="area-verdict">
                    <VerdictBadge verdictClass={verdictClass} verdict={score?.verdict ?? 'Nevyhodnoceno'} />
                    {score?.overall != null && <span className="muted tiny">{score.overall}/100 pro {props.fruitName.toLowerCase()}</span>}
                  </span>
                </span>
                <span className="area-check" aria-hidden="true">
                  {selected ? '✓' : ''}
                </span>
              </button>
              <div className="link-row" style={{justifyContent:'flex-end',gap:8,padding:'5px 3px'}}>
                <button type="button" className="link-button" aria-label={`Přejmenovat ${area.name}`} onClick={() => {
                  setEditingId(area.id); setNameDraft(area.name); setNameError(''); setDeletingId(null);
                }}>Přejmenovat</button>
                <button type="button" className="link-button" aria-label={`${area.kind==='sample'?'Skrýt ukázku':'Smazat pozemek'} ${area.name}`} onClick={() => {
                  setDeletingId(area.id); setEditingId(null);
                }}>{area.kind==='sample'?'Skrýt ukázku':'Smazat pozemek'}</button>
              </div>
              {editingId===area.id && <form className="notice info" onSubmit={event => {
                event.preventDefault(); const name=nameDraft.trim();
                if(!name || name.length>100){setNameError('Název musí obsahovat 1 až 100 znaků.');return;}
                props.onRenameArea(area.id,name); setEditingId(null); setNameError('');
              }} onKeyDown={event => {if(event.key==='Escape'){setEditingId(null);setNameError('');}}}>
                <label className="field"><span>Název pozemku v aplikaci</span><input autoFocus maxLength={100} aria-label={`Nový název pro ${area.name}`} value={nameDraft} onChange={event => {setNameDraft(event.target.value);setNameError('');}}/></label>
                {nameError&&<p role="alert">{nameError}</p>}
                <div className="link-row" style={{marginTop:8}}><button type="submit" className="btn small primary">Uložit název</button><button type="button" className="btn small" onClick={()=>setEditingId(null)}>Zrušit</button></div>
              </form>}
              {deletingId===area.id && <div className="notice warn" role="group" aria-label={`Potvrzení odstranění ${area.name}`}>
                <p>{area.kind==='sample'?'Ukázku skryjete ze seznamu i mapy. Vrátí ji Obnovit demo.':'Pozemek a jeho výběr se smažou z této aplikace. Údaje v katastru tím neměníte.'}</p>
                <div className="link-row" style={{marginTop:8}}><button type="button" className="btn small danger" onClick={()=>{props.onDeleteArea(area.id);setDeletingId(null);}}>{area.kind==='sample'?'Potvrdit skrytí':'Potvrdit smazání'}</button><button type="button" className="btn small" onClick={()=>setDeletingId(null)}>Zrušit</button></div>
              </div>}
              </div>
            );
          })}
        </div>

        <div className="footnote">
          Připraveno je {props.allDemoCount} ukázkových ploch. Křížek ruší pouze výběr. Smazat pozemek odstraní uloženou parcelu nebo kresbu; ukázku lze skrýt. Názvy měníte pouze v této aplikaci.
        </div>
      </section>

      <GeometryTools activeArea={props.activeArea} selectedAreas={props.selectedAreas} onSplit={props.onSplitArea} onMerge={props.onMergeAreas}/>

      {props.mode === 'custom' && (
        <section className="panel-section">
          <div className="section-head">
            <div className="section-title">Vlastní pozemek</div>
          </div>

          <div className="notice info">
            Skutečné parcely vybírejte přes katastrální vrstvu nebo číslo a k. ú. V pěti lokalitách používáme připravené výřezy,
            jinde živé prostorové dotazy. Chybějící podklady nenahrazujeme demo profilem.
          </div>

          <div className="accordion" style={{ marginTop: 9 }}>
            <details>
              <summary>Ověření parcely v ČÚZK</summary>
              <div className="accordion-body">
                <div className="region-grid">
                  <label className="field">
                    <span>Parcelní číslo</span>
                    <input
                      value={parcelNumber}
                      onChange={(event) => setParcelNumber(event.target.value)}
                      placeholder="např. 1234/5"
                    />
                  </label>
                  <label className="field">
                    <span>Katastrální území</span>
                    <input
                      value={parcelKatastr}
                      onChange={(event) => setParcelKatastr(event.target.value)}
                      placeholder="např. Bílany nebo 604038"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: 8 }}
                  onClick={() => void handleParcel()}
                  disabled={parcelState === 'loading'}
                >
                  {parcelState === 'loading' ? 'Ověřuji…' : 'Vyhledat parcelu'}
                </button>
                {parcelState === 'error' && parcelError && (
                  <div className="notice error" style={{ marginTop: 8 }}>
                    <strong>{parcelError.message}.</strong> {parcelError.detail}
                  </div>
                )}
                <div className="field-note" style={{ marginTop: 7 }}>
                  Zdroj: ČÚZK RÚIAN REST, bez klíče. Pro jednoznačné hledání lze zadat šestimístný kód k. ú. Parcely lze vybírat také kliknutím v zapnuté katastrální mapě.
                </div>
              </div>
            </details>
          </div>

          <div className="divider" />

          <div className="section-title" style={{ marginBottom: 6 }}>
            Vlastní plocha
          </div>
          <div className="link-row">
            <div className="tiny muted">
              {props.drawMode ? `Kreslení: ${props.drawPoints} vrcholů` : props.customArea ? 'Plocha je zakreslená' : 'Zatím nezakresleno'}
            </div>
            {!props.drawMode && !props.customArea && (
              <button type="button" className="btn small" onClick={props.onStartDraw}>
                ✎ Kreslit
              </button>
            )}
          </div>
          {props.drawMode && (
            <div className="link-row" style={{ marginTop: 6 }}>
              <button type="button" className="btn small primary" onClick={props.onFinishDraw} disabled={props.drawPoints < 3}>
                Dokončit
              </button>
              <button type="button" className="btn small" onClick={props.onCancelDraw}>
                Zrušit
              </button>
            </div>
          )}
          {props.customArea && (
            <div style={{ marginTop: 8 }}>
              <div className="kv">
                <div className="kv-row">
                  <span className="k">Výměra</span>
                  <span className="v">{fmtHa(areaHa(props.customArea.geometry))}</span>
                </div>
                <div className="kv-row">
                  <span className="k">Obvod</span>
                  <span className="v">{fmtM(perimeterM(props.customArea.geometry))}</span>
                </div>
                <div className="kv-row">
                  <span className="k">Označení</span>
                  <span className="v">{props.customArea.name}</span>
                </div>
              </div>
              <div className="link-row" style={{ marginTop: 7 }}>
                <button type="button" className="btn small" onClick={props.onStartDraw}>
                  Upravit kresbu
                </button>
                <button type="button" className="btn small danger" onClick={props.onDeleteCustom}>
                  Smazat plochu
                </button>
              </div>
            </div>
          )}

          <div className="field-note" style={{ marginTop: 5 }}>
            Vlastní geometrie používá podklady podle skutečné polohy. Mimo připravené výřezy se dotazujeme
            stejných otevřených zdrojů živě; profil jiné lokality se nepřiřazuje.
          </div>
        </section>
      )}

      <section className="panel-section">
        <div className="section-head">
          <div className="section-title">Mapové vrstvy</div>
          <span className="badge outline">{props.activeLayers.length} aktivní</span>
        </div>

        <label className="layer" style={{ marginBottom: 7 }}>
          <span className="layer-head">
            <span className="switch">
              <input type="checkbox" checked={props.showKraje} onChange={props.onToggleKraje} />
              <span />
            </span>
            <span className="layer-name">Hranice krajů</span>
            <QualityBadge quality="real" />
          </span>
          <span className="layer-body">
            <span className="layer-desc">Kliknutím na kraj v mapě omezíte výběr oblasti. Zdroj: Eurostat NUTS 2021.</span>
          </span>
        </label>

        <div className="layers">
          {MAP_LAYERS.map((layer) => (
            <div className="layer" key={layer.id}>
              <label className="layer-head" style={{ cursor: 'pointer' }}>
                <span className="switch">
                  <input
                    type="checkbox"
                    checked={Boolean(props.layers[layer.id])}
                    disabled={layer.quality === 'unavailable'}
                    onChange={() => props.onToggleLayer(layer.id)}
                  />
                  <span />
                </span>
                <span className="layer-name">{layer.name}</span>
                <QualityBadge quality={layer.quality} />
              </label>
              <div className="layer-body">
                <div className="layer-desc">{layer.description}</div>
                <div className="layer-meta">
                  <span className={`badge ${layer.usedInModel ? 'good' : 'outline'}`}>
                    {layer.usedInModel ? 'Vstupuje do výpočtu' : 'Jen k zobrazení'}
                  </span>
                </div>
                <div className="legend">
                  {layer.legend.map((item) => (
                    <span className="legend-item" key={item.label}>
                      <span className="legend-swatch" style={{ background: item.color }} />
                      {item.label}
                    </span>
                  ))}
                </div>
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  {layer.source}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
