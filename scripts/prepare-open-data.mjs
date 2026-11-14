import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out = new URL('../.data-cache/', import.meta.url);
await mkdir(out, {recursive:true});
const areas = [
 ['demo-a',17.4124,49.3049], ['demo-b',13.4735,50.3551],
 ['demo-c',15.816,50.6604], ['demo-d',16.7306,48.9398], ['demo-e',15.8759,49.2148],
];
const receipts=[];
const failures=[];
async function json(url) {
 const r=await fetch(url,{signal:AbortSignal.timeout(45000)});
 if(!r.ok) throw Error(`${r.status}: ${url}`);
 const text=await r.text(); if(text.length>16000000) throw Error('Response too large');
 const value=JSON.parse(text); if(value.error) throw Error(JSON.stringify(value.error));
 receipts.push({url,sha256:createHash('sha256').update(text).digest('hex'),bytes:Buffer.byteLength(text)});
 return value;
}
async function save(name,value){await writeFile(new URL(name,out),JSON.stringify(value));}
const sources={
 parcels:['https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/5','id,cisloparcely,vymeraparcely,druhpozemkukod,katastralniuzemi'],
 bpej:['https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/28','kod,nazev,platiod,platido'],
};
const bundle=await readFile(new URL('locations.json',out),'utf8').then(JSON.parse).catch(()=>({}));
for(const entry of Object.values(bundle))for(const key of ['protected','protectedSmall','natura','birds'])delete entry.layers[key];
await save('locations.json',bundle);
for(const [id,lon,lat] of areas){
 if(bundle[id]?.climate){console.log(id,'already saved');continue;}
 const bounds=[lon-.006,lat-.004,lon+.006,lat+.004];
 const local={center:[lon,lat],bounds,layers:{}};
 for(const [key,[base,fields]] of Object.entries(sources)){
  const features=[];
  for(let offset=0;offset<10000;offset+=500){
   const p=new URLSearchParams({where:'1=1',geometry:bounds.join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:fields,f:'geojson',resultRecordCount:'500',resultOffset:String(offset)});
   const data=await json(`${base}/query?${p}`);
   if(!Array.isArray(data.features))throw Error(`Missing features: ${key}`);
   features.push(...data.features);
   if(!data.exceededTransferLimit){break;}
   if(offset===9500)throw Error('Incomplete snapshot');
  }
  local.layers[key]={type:'FeatureCollection',features};
  console.log(id,key,features.length);
 }
 const qp=new URLSearchParams({latitude:String(lat),longitude:String(lon),start_date:'2005-01-01',end_date:'2024-12-31',daily:'temperature_2m_min,temperature_2m_mean,temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration',models:'era5_land',timezone:'Europe/Prague'});
 const weather=await json(`https://archive-api.open-meteo.com/v1/archive?${qp}`).catch(error=>{failures.push({source:'open-meteo',area:id,error:String(error)});return null;});
 if(!weather)throw Error('Klima nebylo staženo. Respektujte limit API a pokračujte později; neúplná lokalita se neuložila.');
 const years=[]; const d=weather?.daily;
 for(let y=2005;d&&y<=2024;y++){
  const ii=d.time.flatMap((date,i)=>date.startsWith(`${y}-`)?[i]:[]);
  const spring=ii.filter(i=>['03','04','05'].includes(d.time[i].slice(5,7)));
  const values=(key,indices=ii)=>indices.map(i=>d[key][i]).filter(Number.isFinite);
  const sum=a=>a.reduce((s,x)=>s+x,0); const mean=a=>a.length?sum(a)/a.length:null;
  const temp=values('temperature_2m_mean'),rain=values('precipitation_sum'),et=values('et0_fao_evapotranspiration');
  years.push({year:y,temperatureMeanC:mean(temp),rainfallMm:rain.length===ii.length?sum(rain):null,et0Mm:et.length===ii.length?sum(et):null,springFrostDays:values('temperature_2m_min',spring).length===spring.length?values('temperature_2m_min',spring).filter(x=>x<0).length:null,summerDays:values('temperature_2m_max').length===ii.length?values('temperature_2m_max').filter(x=>x>=25).length:null,validTemperatureDays:temp.length,totalDays:ii.length});
 }
 local.climate=weather?{period:'2005–2024',model:'ERA5-Land',resolution:'0.1° (~9 km), nikoli měření na parcele',grid:[weather.longitude,weather.latitude],years}:null;
 bundle[id]=local;
 await save('locations.json',bundle);
}
for(const code of ['ZEM03D','CEN0203B']){
 const data=await json(`https://data.csu.gov.cz/opendata/sady/${code}/distribuce/json`);
 await save(`${code}.json`,data); console.log(code,JSON.stringify(data).length);
}
await save('downloads.json',{downloadedAt:new Date().toISOString(),receipts,failures});
console.log('Saved',receipts.length,'source responses');
