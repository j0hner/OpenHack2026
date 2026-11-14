import {area} from '@turf/area';
import type {FeatureCollection,Polygon,MultiPolygon} from 'geojson';
import {containsPoint,geometryBounds,inBounds,locationFor,overlaps} from './openData';
import type {AreaGeometry} from './types';

export const REGIONAL_VERSION='geo-2';
export interface ClimateYear {year:number;temperatureMeanC:number|null;rainfallMm:number|null;et0Mm:number|null;springFrostDays:number|null;summerDays:number|null}
export interface RegionalData {
 key:string; fetchedAt:string; point:[number,number]; source:'snapshot'|'live';
 soil:{parts:{name:string;percent:number}[];coveragePct:number;valid:boolean}|null;
 climate:{years:ClimateYear[];period:string;model:string;resolution:string;grid:[number,number]|null;distanceKm:number|null;rainfallGrid?:[number,number]}|null;
 protected:{name:string;percent:number}[]|null;
 /** Core soil/climate can be used while the independent protection lookup finishes. */
 protectionPending?:boolean;
 errors:string[];
}
export const distanceKm=(a:number[],b:number[])=>{
 const rad=Math.PI/180,dy=(a[1]-b[1])*rad,dx=(a[0]-b[0])*rad;
 const h=Math.sin(dy/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dx/2)**2;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
};
export function geometryKey(g:AreaGeometry){
 const text=JSON.stringify(g);let a=2166136261,b=5381;
 for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}
 return `${REGIONAL_VERSION}-${text.length}-${a>>>0}-${b>>>0}`;
}
/** Choose an interior point, including for concave parcels and polygons with holes. */
export function representativePoint(g:AreaGeometry):[number,number]{
 const [w,s,e,n]=geometryBounds(g),center:[number,number]=[(w+e)/2,(s+n)/2];
 if(containsPoint(g,center))return center;
 const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
 for(const polygon of polygons){
  const ring=polygon[0];
  for(let i=0;i<ring.length-1;i++){
   const p=ring[i],q=ring[i+1],mid=[(p[0]+q[0])/2,(p[1]+q[1])/2];
   for(const epsilon of [1e-5,1e-4,.001,.01,.1]){
    const candidate:[number,number]=[mid[0]+(center[0]-mid[0])*epsilon,mid[1]+(center[1]-mid[1])*epsilon];
    if(containsPoint(g,candidate))return candidate;
   }
  }
 }
 throw Error('Pro geometrii nelze najít vnitřní bod. Zkontrolujte kresbu.');
}
export type RegionalProgress = (data:RegionalData)=>void;
interface RegionalRequest {
 promise:Promise<RegionalData>;
 latest:RegionalData|null;
 listeners:Set<RegionalProgress>;
}
const memory=new Map<string,RegionalRequest>();
const CACHE='sady-regional-geo2';
const TTL=7*86400000;
function cached(key:string):RegionalData|null{
 try{
  localStorage.removeItem('sady-regional-geo1');
  const list:RegionalData[]=JSON.parse(localStorage.getItem(CACHE)??'[]');
  return list.find(d=>d.key===key&&!d.protectionPending&&Date.now()-Date.parse(d.fetchedAt)<TTL)??null;
 }catch{return null;}
}
function save(data:RegionalData){
 if(data.errors.length||data.protectionPending)return;
 try{
  const list:RegionalData[]=JSON.parse(localStorage.getItem(CACHE)??'[]');
  localStorage.setItem(CACHE,JSON.stringify([data,...list.filter(d=>d.key!==data.key)].slice(0,30)));
 }catch{/* Storage is optional. */}
}
async function json(url:string,signal:AbortSignal){
 const r=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(25000)])});
 if(!r.ok)throw Error(`HTTP ${r.status}${r.status===429?' – dosažen limit poskytovatele; zkuste později':''}`);
 const d=await r.json();if(d.error)throw Error(d.reason??d.error.message??'Chyba poskytovatele');return d;
}
async function features(base:string,g:AreaGeometry,signal:AbortSignal,fields='*'):Promise<FeatureCollection<Polygon|MultiPolygon>>{
 const result:FeatureCollection<Polygon|MultiPolygon>={type:'FeatureCollection',features:[]};
 for(let offset=0;offset<2000;offset+=500){
  const p=new URLSearchParams({where:'1=1',geometry:geometryBounds(g).join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:fields,f:'geojson',resultRecordCount:'500',resultOffset:String(offset)});
  const d=await json(`${base}/query?${p}`,signal);
  if(!Array.isArray(d.features))throw Error('Chybí geometrie v odpovědi');
  result.features.push(...d.features);
  if(!d.exceededTransferLimit)return result;
 }
 throw Error('Příliš rozsáhlý výřez; vyberte menší pozemek.');
}
export function soilSummary(g:AreaGeometry,collection:FeatureCollection<Polygon|MultiPolygon>):RegionalData['soil']{
 const unique={...collection,features:[...new Map(collection.features.map(f=>[JSON.stringify(f),f])).values()]};
 const parts=overlaps(g,unique).filter(x=>/^\d{5}$/.test(x.name)&&Number(x.name.slice(1,3))>=1&&Number(x.name.slice(1,3))<=89);
 const sum=parts.reduce((s,p)=>s+p.percent,0);
 return {parts,coveragePct:Math.min(100,sum),valid:sum<=101};
}
export function aggregateWeather(d:{time:string[];[key:string]:unknown}):ClimateYear[]{
 const years:ClimateYear[]=[];
 for(let year=2005;year<=2024;year++){
  const ii=d.time.flatMap((date,i)=>date.startsWith(year+'-')?[i]:[]),days=year%4===0?366:365;
  const get=(key:string,indices=ii)=>indices.map(i=>(d[key] as (number|null)[])[i]);
  const complete=(values:(number|null)[],expected:number)=>values.length===expected&&values.every(v=>v!==null&&Number.isFinite(v));
  const temp=get('temperature_2m_mean'),rain=get('precipitation_sum'),et=get('et0_fao_evapotranspiration'),hot=get('temperature_2m_max');
  const spring=get('temperature_2m_min',ii.filter(i=>['03','04','05'].includes(d.time[i].slice(5,7))));
  const sum=(v:(number|null)[])=>v.reduce<number>((s,n)=>s+(n??0),0);
  years.push({year,temperatureMeanC:complete(temp,days)?sum(temp)/days:null,rainfallMm:complete(rain,days)?sum(rain):null,et0Mm:complete(et,days)?sum(et):null,springFrostDays:complete(spring,92)?spring.filter(v=>v!<0).length:null,summerDays:complete(hot,days)?hot.filter(v=>v!>=25).length:null});
 }
 return years;
}
const weatherMemory=new Map<string,Promise<NonNullable<RegionalData['climate']>>>();
async function weather(point:[number,number],signal:AbortSignal,refresh=false){
 // ERA5's regular 0.25° grid is explicit. Nearby parts sharing this model cell
 // reuse the climate request; parcel soil intersections remain independent.
 const expectedGrid:[number,number]=point.map(v=>Math.round(v*4)/4) as [number,number];
 const key=expectedGrid.join(',');
 if(refresh)weatherMemory.delete(key);
 if(!weatherMemory.has(key)){
 const request=(async()=>{
  const p=new URLSearchParams({latitude:String(point[1]),longitude:String(point[0]),models:'era5',start_date:'2005-01-01',end_date:'2024-12-31',daily:'temperature_2m_mean,temperature_2m_min,temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration',timezone:'Europe/Prague',cell_selection:'nearest',elevation:'nan'});
  const d=await json('https://archive-api.open-meteo.com/v1/archive?'+p,signal);
  if(!d.daily||!Array.isArray(d.daily.time)||!Number.isFinite(d.latitude)||!Number.isFinite(d.longitude))throw Error('Neúplné klimatické souřadnice nebo řada');
  const grid:[number,number]=[d.longitude,d.latitude],distance=distanceKm(point,grid);
  if(distance>50)throw Error('Klimatický grid příliš vzdálený od pozemku');
  if(distanceKm(grid,expectedGrid)>1)throw Error('Odpověď neodpovídá požadovanému gridu ERA5');
  return {years:aggregateWeather(d.daily),period:'2005–2024',model:'ERA5',resolution:'0.25° (~25 km), nikoli mikroklima parcely',grid,distanceKm:distance};
 })().catch(e=>{if(weatherMemory.get(key)===request)weatherMemory.delete(key);throw e;});
 weatherMemory.set(key,request);
 }
 const result=await weatherMemory.get(key)!;
 return {...result,distanceKm:result.grid?distanceKm(point,result.grid):null};
}
async function load(g:AreaGeometry,signal:AbortSignal,onProgress:RegionalProgress,refresh=false):Promise<RegionalData>{
 const point=representativePoint(g),bounds=geometryBounds(g);
 const data:RegionalData={key:geometryKey(g),fetchedAt:new Date().toISOString(),point,source:'live',soil:null,climate:null,protected:null,errors:[]};
 if(!inBounds([bounds[0],bounds[1]],[12,48.5,18.9,51.2])||!inBounds([bounds[2],bounds[3]],[12,48.5,18.9,51.2])){
  data.errors.push('Vyhodnocujeme území ČR. Vyberte pozemek v České republice.');return data;
 }
 if(distanceKm([bounds[0],bounds[1]],[bounds[2],bounds[3]])>3||area(g)>1000000){
  data.errors.push('Plocha je příliš rozsáhlá nebo rozptýlená pro jedno regionální vyhodnocení. Rozdělte ji na části do 100 ha a 3 km úhlopříčky.');return data;
 }
 const snapshot=await locationFor(g).catch(()=>null);
 if(snapshot){
  data.source='snapshot';
  try{data.soil=soilSummary(g,snapshot.layers.bpej);data.protected=['protected','protectedSmall','natura','birds'].flatMap(k=>overlaps(g,snapshot.layers[k]));}catch{data.errors.push('Nepodařil se průnik připravených geometrií.');}
  if(snapshot.climate){const grid=snapshot.climate.grid??null;data.climate={...snapshot.climate,grid,distanceKm:grid?distanceKm(point,grid):null};}
  return data;
 }
 type Result<T>={value:T|null;errors:string[]};
 const attempt=async<T>(label:string,task:()=>Promise<T>):Promise<Result<T>>=>{
  try{return {value:await task(),errors:[]};}catch(e){return {value:null,errors:[`${label}: ${e instanceof Error?e.message:'zdroj nedostupný'}`]};}
 };
 let protectionSettled=false;
 const protection=attempt('AOPK',async()=>{
  const parts=[];
  for(const id of [0,2,6,7])parts.push(...overlaps(g,await features('https://gis.nature.cz/arcgis/rest/services/Aplikace/Opendata/MapServer/'+id,g,signal)));
  return parts;
 }).then(result=>{protectionSettled=true;return result;});
 const [soil,climate]=await Promise.all([
  attempt('BPEJ',async()=>soilSummary(g,await features('https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/28',g,signal,'kod,nazev'))),
  attempt('Klima',()=>weather(point,signal,refresh)),
 ]);
 const core:RegionalData={...data,soil:soil.value,climate:climate.value,errors:[...soil.errors,...climate.errors]};
 // Never mutate this published snapshot: AOPK is independently appended later.
 if(!protectionSettled)onProgress({...core,protectionPending:true});
 const restrictions=await protection;
 return {...core,protected:restrictions.value,errors:[...core.errors,...restrictions.errors],protectionPending:false};
}

function publish(request:RegionalRequest,data:RegionalData){
 request.latest=data;
 for(const listener of request.listeners){
  try{listener(data);}catch{/* One subscriber cannot interrupt other consumers. */}
 }
}
/** A caller can detach without cancelling the shared geometry request. */
function subscribe(request:RegionalRequest,signal:AbortSignal,onProgress?:RegionalProgress):Promise<RegionalData>{
 return new Promise((resolve,reject)=>{
  let settled=false;
  const progress:RegionalProgress=data=>{if(!settled&&!signal.aborted)onProgress?.(data);};
  const cleanup=()=>{request.listeners.delete(progress);signal.removeEventListener('abort',aborted);};
  const aborted=()=>{
   if(settled)return;
   settled=true;cleanup();reject(new DOMException('Aborted','AbortError'));
  };
  signal.addEventListener('abort',aborted,{once:true});
  if(onProgress)request.listeners.add(progress);
  if(signal.aborted){aborted();return;}
  if(request.latest?.protectionPending){
   try{progress(request.latest);}catch{/* See publish: callbacks are isolated. */}
  }
  request.promise.then(data=>{
   if(settled)return;
   settled=true;cleanup();resolve(data);
  },error=>{
   if(settled)return;
   settled=true;cleanup();reject(error);
  });
 });
}
export function loadRegionalData(g:AreaGeometry,signal:AbortSignal,refresh=false,onProgress?:RegionalProgress):Promise<RegionalData>{
 const key=geometryKey(g);
 if(signal.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
 if(refresh)memory.delete(key);
 if(!memory.has(key)){
  const stored=refresh?null:cached(key);
  const request:RegionalRequest={promise:Promise.resolve(null as unknown as RegionalData),latest:stored,listeners:new Set()};
  // Shared requests have their own lifetime. Selection changes detach subscribers.
  request.promise=stored?Promise.resolve(stored):load(g,AbortSignal.timeout(60000),data=>publish(request,data),refresh).then(data=>{
   request.latest=data;
   // A superseded refresh must not overwrite the newer result in persistent cache.
   if(memory.get(key)===request)save(data);
   return data;
  }).catch(error=>{if(memory.get(key)===request)memory.delete(key);throw error;});
  memory.set(key,request);
 }
 return subscribe(memory.get(key)!,signal,onProgress);
}
