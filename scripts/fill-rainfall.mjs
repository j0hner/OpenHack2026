import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../public/data/',import.meta.url);
const index=JSON.parse(await readFile(new URL('locations-index.json',root),'utf8'));
const cachePath=new URL('../.data-cache/locations.json',import.meta.url);
const cache=await readFile(cachePath,'utf8').then(JSON.parse).catch(()=>null);
for(const entry of index){
 const path=new URL(entry.file,root),d=JSON.parse(await readFile(path,'utf8'));
 if(d.climate?.years.every(y=>y.rainfallMm!==null&&y.et0Mm!==null)){
  if(cache?.[entry.id])cache[entry.id].climate=d.climate;
  continue;
 }
 const p=new URLSearchParams({latitude:String(entry.center[1]),longitude:String(entry.center[0]),start_date:'2005-01-01',end_date:'2024-12-31',daily:'precipitation_sum,et0_fao_evapotranspiration',models:'era5',timezone:'Europe/Prague'});
 const r=await fetch('https://archive-api.open-meteo.com/v1/archive?'+p,{signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error('Open-Meteo '+r.status);
 const v=await r.json();if(v.error||!v.daily)throw Error(JSON.stringify(v));
 for(const y of d.climate.years){
  const ii=v.daily.time.flatMap((date,i)=>date.startsWith(y.year+'-')?[i]:[]);
  for(const [key,target]of [['precipitation_sum','rainfallMm'],['et0_fao_evapotranspiration','et0Mm']]){
   const values=ii.map(i=>v.daily[key][i]);
   if(values.length!==y.totalDays||!values.every(Number.isFinite))throw Error('Incomplete '+entry.id+' '+y.year+' '+key);
   y[target]=values.reduce((s,x)=>s+x,0);
  }
 }
 d.climate.model='ERA5-Land (teplota) + ERA5 (srážky, ET0)';
 d.climate.resolution='teplota 0.1° (~9 km), srážky / ET0 0.25° (~25 km); nikoli měření na parcele';
 d.climate.rainfallGrid=[v.longitude,v.latitude];
 await writeFile(path,JSON.stringify(d));console.log(entry.id,d.climate.years[0].rainfallMm);
 if(cache?.[entry.id])cache[entry.id].climate=d.climate;
}
if(cache)await writeFile(cachePath,JSON.stringify(cache));
