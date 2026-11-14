import {useEffect,useState} from 'react';
import type {AnalysisArea,EconomicsInputs,FruitKey} from '../lib/types';
import {mean,staticData} from '../lib/openData';
import {validClimateYears} from '../lib/regionalScoring';
const fmt=(n:number|null|undefined,d=1)=>n==null?'neznámé':n.toLocaleString('cs-CZ',{maximumFractionDigits:d});
type Reference={years:{year:number;pricePerKg:number|null;harvestTonnes:number|null}[];note:string};
export default function RegionalPanel({area,fruit,onEconomicsChange,onRetry}:{area:AnalysisArea;fruit:FruitKey;onEconomicsChange:(v:Partial<EconomicsInputs>)=>void;onRetry:()=>void}){
 const observation=area.regional!,d=observation.data,years=validClimateYears(d);
 const [reference,setReference]=useState<Reference|null>(null);
 useEffect(()=>{let active=true;setReference(null);staticData<Record<FruitKey,Reference>>('economics.json').then(r=>{if(active)setReference(r[fruit]);}).catch(()=>{});return()=>{active=false;};},[fruit]);
 const price=reference?.years.filter(y=>y.pricePerKg!==null).at(-1);
 return <details className="card open-data-card" open>
  <summary><strong>Podklady skutečně použité ve výpočtu</strong></summary>
  <p className="small" role="status">{observation.status==='loading'?'Načítám data podle polygonu a souřadnic pozemku…':observation.status==='error'?observation.message:d?`${d.source==='snapshot'?'Připravený prostorový výřez':'Živé otevřené zdroje'} · zpracováno ${new Date(d.fetchedAt).toLocaleDateString('cs-CZ')}`:'Podklady nejsou dostupné.'}</p>
  {d&&<>
   <p className="tiny">Bod uvnitř plochy: {fmt(d.point[1],5)}, {fmt(d.point[0],5)}. Podklady jsou navázané na tuto geometrii; přejmenování ani hledání lokality hodnocení nemění.</p>
   <dl className="open-data-values">
    <dt>Půda – ČÚZK BPEJ × polygon parcely</dt><dd>{d.soil?`Pokrytí ${fmt(d.soil.coveragePct)} %. ${d.soil.parts.map(p=>`${p.name}: ${fmt(p.percent)} %`).join('; ')||'Bez překryvu s BPEJ.'}`:'Zdroj nedostupný.'} {d.soil&&!d.soil.valid&&'Překrývající se jednotky jsou nejednoznačné.'} pH a humus nejsou známé.</dd>
    <dt>Klima – souřadnice a regionální grid</dt><dd>{d.climate?<>{d.climate.model}, {d.climate.period}; {years.length} úplných let. {d.climate.resolution}.<br/>Grid: {d.climate.grid?`${fmt(d.climate.grid[1],4)}, ${fmt(d.climate.grid[0],4)}`:'souřadnice gridu neuvedeny'}; vzdálenost od bodu plochy {fmt(d.climate.distanceKm)} km.<br/>Ø {fmt(mean(years.map(y=>y.temperatureMeanC)))} °C, srážky {fmt(mean(years.map(y=>y.rainfallMm)))} mm/rok, ET0 {fmt(mean(years.map(y=>y.et0Mm)))} mm/rok; jarní mráz {fmt(mean(years.map(y=>y.springFrostDays)))} dnů/rok.</>:'Zdroj nedostupný.'}</dd>
    {d.climate?.rainfallGrid&&<><dt>Srážky / ET0 – samostatný grid ERA5</dt><dd>{fmt(d.climate.rainfallGrid[1],4)}, {fmt(d.climate.rainfallGrid[0],4)}. Teplota používá jemnější ERA5-Land; souřadnice výše patří teplotnímu gridu.</dd></>}
    <dt>AOPK – průnik s polygonem</dt><dd>{d.protected===null?'Neověřeno – zdroj není dostupný.':d.protected.length?d.protected.map(p=>`${p.name}: ${fmt(p.percent)} %`).join('; '):'Bez průniku ve čtyřech sledovaných kategoriích.'} Q100 a další právní omezení nejsou ověřené.</dd>
   </dl>
   {d.errors.length>0&&<ul className="plain-list">{d.errors.map(e=><li key={e} className="small">{e}</li>)}</ul>}
  </>}
  {observation.status!=='loading'&&<button type="button" className="btn small" onClick={onRetry}>Znovu načíst podklady této plochy</button>}
  <p className="tiny">Souhrnný index vyžaduje alespoň 80 % platného pokrytí BPEJ a 15 úplných klimatických let. Váhy a převod dat na body jsou orientační pravidla Moje Sady; výsledek není pravděpodobnost úspěchu ani předpověď sklizně.</p>
  {reference&&<><p><strong>ČSÚ – ekonomická reference celé ČR</strong></p><table><thead><tr><th>Rok</th><th>Sklizeň ČR (t)</th><th>Kč/kg</th></tr></thead><tbody>{reference.years.map(y=><tr key={y.year}><td>{y.year}</td><td>{fmt(y.harvestTonnes,0)}</td><td>{fmt(y.pricePerKg,2)}</td></tr>)}</tbody></table><p className="tiny">Celostátní statistika není výnos konkrétní parcely. Náklady a výnos t/ha zůstávají uživatelskými scénáři.</p>{price&&<button type="button" className="btn small" onClick={()=>onEconomicsChange({pricePerKg:price.pricePerKg!})}>Použít cenu ČSÚ {price.year} v ekonomice</button>}</>}
  <p className="tiny"><a href={`${import.meta.env.BASE_URL}data/manifest.json`} target="_blank" rel="noreferrer">Zdroje a licence</a> · <a href="https://mapy.vumop.cz/vrstvy.php" target="_blank" rel="noreferrer">Význam skupin HPJ (VÚMOP)</a></p>
 </details>;
}
