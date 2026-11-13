import {useEffect,useState} from 'react';
import {locationFor,mean,overlaps,staticData,type LocationData} from '../lib/openData';
import type {AnalysisArea,EconomicsInputs,FruitKey} from '../lib/types';
type Reference={years:{year:number;harvestTonnes:number|null;pricePerKg:number|null}[];note:string};
const fmt=(n:number|null,d=1)=>n===null?'nezjištěno':n.toLocaleString('cs-CZ',{maximumFractionDigits:d});
export default function OpenDataPanel({area,fruit,onEconomicsChange}:{area:AnalysisArea;fruit:FruitKey;onEconomicsChange:(v:Partial<EconomicsInputs>)=>void}){
 const [data,setData]=useState<LocationData|null>(null),[state,setState]=useState('Načítám otevřená data…');
 const [reference,setReference]=useState<Reference|null>(null);
 useEffect(()=>{let active=true;setData(null);setState('Načítám otevřená data…');
  locationFor(area.geometry).then(d=>{if(active){setData(d);setState(d?'':'Mimo pět připravených výřezů. Půdní, klimatické a územní podklady zde nejsou stažené.');}}).catch(()=>{if(active)setState('Datový výřez se nepodařilo načíst. Zkuste obnovit stránku.');});
  return()=>{active=false;};
 },[area.geometry]);
 useEffect(()=>{let active=true;setReference(null);staticData<Record<FruitKey,Reference>>('economics.json').then(d=>{if(active)setReference(d[fruit]);}).catch(()=>{});return()=>{active=false;};},[fruit]);
 let soil:{name:string;percent:number}[]=[],protectedPct:number|null=null,joinError=false;
 if(data)try{
  soil=overlaps(area.geometry,data.layers.bpej);
  const protectedParts=['protected','protectedSmall','natura','birds'].flatMap(k=>overlaps(area.geometry,data.layers[k]));
  // Overlapping legal designations are reported separately, never summed into a false area percentage.
  protectedPct=protectedParts.length;
 }catch{joinError=true;}
 const climate=data?.climate; const latestPrice=reference?.years.filter(y=>y.pricePerKg!==null).at(-1);
 return <details className="card open-data-card" open={area.kind==='parcel'}>
  <summary><strong>Skutečná otevřená data pro plochu</strong> <span className="badge q-real">ČÚZK · Copernicus · AOPK · ČSÚ</span></summary>
  <p className="small">{area.kind==='sample'?'Následující údaje jsou skutečné podklady. Skóre výše je samostatný, označený modelový scénář.':'Chybějící půdní rozbor a provozní údaje se nedoplňují demo hodnotami; celkové skóre zůstává nedostupné.'}</p>
  {state&&<p role="status">{state}</p>}
  {data&&<dl className="open-data-values">
   <dt>BPEJ – podíl plochy</dt><dd>{joinError?'Prostorový průnik se nepodařil.':soil.length?soil.map((x,i)=><span key={i}>{x.name}: {fmt(x.percent)} %; </span>):'Plocha není pokryta staženou BPEJ; půdní vlastnosti neznáme.'}</dd>
   <dt>Teplota / srážky</dt><dd>{climate?`${fmt(mean(climate.years.map(y=>y.temperatureMeanC)))} °C / ${fmt(mean(climate.years.map(y=>y.rainfallMm)))} mm ročně`:'nezjištěno'}</dd>
   <dt>Mrazové dny březen–květen</dt><dd>{climate?`${fmt(mean(climate.years.map(y=>y.springFrostDays)))} dnů/rok (Tmin < 0 °C)`:'nezjištěno'}</dd>
   <dt>Výška / orientační sklon středu lokality</dt><dd>{fmt(data.terrain.centerAltitudeM)} m / {fmt(data.terrain.slopeDeg)}°. {data.terrain.note}</dd>
   <dt>Ochrana přírody</dt><dd>{joinError?'nezjištěno':`${protectedPct} průniků s vybranými kategoriemi ochrany.`} Nejde o povolení výsadby. Q100: neověřeno, otevřený zdroj není připojen.</dd>
  </dl>}
  {climate&&<p className="tiny">ERA5-Land přes Open-Meteo, {climate.period}; {climate.resolution}. Mrazové dny nejsou pravděpodobnost poškození květů. Půdní pH, humus a vydatnost závlahy se z těchto podkladů neurčují.</p>}
  {reference&&<><p><strong>ČSÚ – skutečné referenční statistiky ČR</strong></p><table className="data-table"><thead><tr><th>Rok</th><th>Sklizeň v ČR (t)</th><th>Cena výrobce (Kč/kg)</th></tr></thead><tbody>{reference.years.map(y=><tr key={y.year}><td>{y.year}</td><td>{fmt(y.harvestTonnes,0)}</td><td>{fmt(y.pricePerKg,2)}</td></tr>)}</tbody></table><p className="tiny">{reference.note} Výnos v t/ha zůstává uživatelským předpokladem, pokud jej sada pro daný druh neposkytuje.</p>{latestPrice&&<button type="button" className="btn" onClick={()=>onEconomicsChange({pricePerKg:latestPrice.pricePerKg!})}>Použít cenu ČSÚ {latestPrice.year} v ekonomice</button>}</>}
  <p className="tiny"><a href={`${import.meta.env.BASE_URL}data/manifest.json`} target="_blank" rel="noopener noreferrer">Zdroje, licence a rozsah stažených dat</a></p>
 </details>;
}
