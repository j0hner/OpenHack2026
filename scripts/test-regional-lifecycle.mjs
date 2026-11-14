import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const originalFetch=globalThis.fetch,originalStorage=globalThis.localStorage;
const storage=new Map([['sady-regional-geo2','obsolete protection-bearing cache']]);
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const rectangle=west=>({type:'Polygon',coordinates:[[[west,50.1],[west+.001,50.1],[west+.001,50.101],[west,50.101],[west,50.1]]]});
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};
const daily={time:[],temperature_2m_min:[],temperature_2m_max:[],precipitation_sum:[],et0_fao_evapotranspiration:[]};
for(let time=Date.UTC(2005,0,1);time<Date.UTC(2025,0,1);time+=86400000){
 daily.time.push(new Date(time).toISOString().slice(0,10));daily.temperature_2m_min.push(1);daily.temperature_2m_max.push(26);daily.precipitation_sum.push(2);daily.et0_fao_evapotranspiration.push(1);
}
let temperature=10,liveRequests=0;
const weatherCalls=new Map(),soilCalls=new Map(),holds=new Map(),failSoil=new Set();
const cachedData=key=>JSON.parse(storage.get('sady-regional-geo3')??'[]').find(value=>value.key===key);
try{
 const r=await server.ssrLoadModule('/src/lib/regionalData.ts');
 const {scoreRegionalArea}=await server.ssrLoadModule('/src/lib/regionalScoring.ts');
 const {parcelArea}=await server.ssrLoadModule('/src/lib/openData.ts');
 globalThis.fetch=async input=>{
  const url=String(input);
  if(url.startsWith('/data/')||url.startsWith('./data/'))return Response.json(JSON.parse(await readFile(new URL('../public/'+url.replace(/^\.\//,'').replace(/^\//,''),import.meta.url),'utf8')));
  liveRequests++;
  const u=new URL(url),params=u.searchParams;
  if(url.includes('archive-api.open-meteo.com/')){
   const lon=Number(params.get('longitude')),lat=Number(params.get('latitude')),cell=[Math.round(lon*4)/4,Math.round(lat*4)/4];
   const key=cell.join(',');weatherCalls.set(key,(weatherCalls.get(key)??0)+1);
   return Response.json({longitude:cell[0],latitude:cell[1],daily:{...daily,temperature_2m_mean:daily.time.map(()=>temperature)}});
  }
  assert(url.includes('RUIAN/MapServer/28/'),'Detailed analysis must only request its soil and climate sources.');
  const bounds=params.get('geometry').split(',').map(Number),key=String(bounds[0]);
  soilCalls.set(key,(soilCalls.get(key)??0)+1);
  const hold=holds.get(key);
  if(hold){holds.delete(key);hold.started.resolve();await hold.release.promise;}
  if(failSoil.has(key))return new Response('{}',{status:503});
  const geometry={type:'Polygon',coordinates:[[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[2],bounds[3]],[bounds[0],bounds[3]],[bounds[0],bounds[1]]]]};
  return Response.json({type:'FeatureCollection',features:[{type:'Feature',properties:{nazev:'00100'},geometry}]});
 };
 const fixture=JSON.parse(await readFile(new URL('../public/data/locations/demo-d-parcels.json',import.meta.url),'utf8'));
 const prepared=fixture.features.find(feature=>String(feature.properties.id)==='1245682735');
 const snapshot=await r.loadRegionalData(prepared.geometry,new AbortController().signal);
 assert.equal(snapshot.source,'snapshot');assert.equal(liveRequests,0);assert.equal(storage.has('sady-regional-geo2'),false);
 assert.equal('protected' in snapshot,false);assert.equal('protectionPending' in snapshot,false);

 // Views share one exact-geometry request. One view may leave while others wait.
 const geometry=rectangle(14.61),key=r.geometryKey(geometry),hold={started:deferred(),release:deferred()};holds.set('14.61',hold);
 const firstController=new AbortController(),secondController=new AbortController();
 const first=r.loadRegionalData(geometry,firstController.signal);
 const second=r.loadRegionalData(geometry,secondController.signal);
 const firstRejected=assert.rejects(first,{name:'AbortError'});
 await hold.started.promise;assert.equal(cachedData(key),undefined);
 firstController.abort();await firstRejected;
 const reselected=r.loadRegionalData(geometry,new AbortController().signal);
 hold.release.resolve();
 const [result,reselectedResult]=await Promise.all([second,reselected]);
 assert.strictEqual(result,reselectedResult);assert.equal(soilCalls.get('14.61'),1);assert.equal(weatherCalls.get('14.5,50'),1);
 assert.equal(result.key,key);assert(result.soil.coveragePct>99);assert.equal(result.climate.years.length,20);
 assert.equal('protected' in result,false);assert.equal(cachedData(key).key,key);
 const before=JSON.stringify(freeze(result));
 const area=parcelArea({type:'Feature',properties:{id:1,cisloparcely:'1',druhpozemkukod:2,katastralniuzemi:123456},geometry});
 assert.notEqual(scoreRegionalArea({...area,regional:{status:'ready',data:result}},'apple').overall,null);
 assert.equal(JSON.stringify(result),before,'Scoring must not mutate cached source observations.');

 temperature=12;
 const refreshed=await r.loadRegionalData(geometry,new AbortController().signal,true);
 assert.equal(weatherCalls.get('14.5,50'),2);assert.equal(refreshed.climate.years[0].temperatureMeanC,12);
 const other=await r.loadRegionalData(rectangle(14.86),new AbortController().signal);
 assert.notEqual(other.key,key);assert.notDeepEqual(other.point,result.point);
 assert.strictEqual(await r.loadRegionalData(geometry,new AbortController().signal),refreshed);

 // A real core-source failure is explicit and cannot enter persistent cache.
 const failedGeometry=rectangle(15.36);failSoil.add('15.36');
 const failed=await r.loadRegionalData(failedGeometry,new AbortController().signal);
 assert.equal(failed.soil,null);assert(failed.errors.some(error=>error.startsWith('BPEJ:')));
 assert.equal(cachedData(r.geometryKey(failedGeometry)),undefined);
 assert.equal(scoreRegionalArea({...area,geometry:failedGeometry,regional:{status:'ready',data:failed}},'apple').dataStatus,'error');

 // Older in-flight completion must not overwrite a newer forced refresh.
 const racingGeometry=rectangle(15.61),racingKey=r.geometryKey(racingGeometry),oldHold={started:deferred(),release:deferred()};holds.set('15.61',oldHold);
 temperature=7;const old=r.loadRegionalData(racingGeometry,new AbortController().signal);
 await oldHold.started.promise;temperature=13;
 const newer=await r.loadRegionalData(racingGeometry,new AbortController().signal,true);
 oldHold.release.resolve();await old;
 assert.equal(cachedData(racingKey).climate.years[0].temperatureMeanC,13);
 assert.strictEqual(await r.loadRegionalData(racingGeometry,new AbortController().signal),newer);
 const aborted=new AbortController();aborted.abort();
 await assert.rejects(r.loadRegionalData(geometry,aborted.signal),{name:'AbortError'});
 console.log(JSON.stringify({checks:'OK',coreOnly:true,sharedSubscribers:true,abortAndReselect:true,immutableObservations:true,errorFreeCache:true,refreshWeather:true,refreshRace:true,geometryIsolation:true,obsoleteCacheRemoved:true}));
}finally{globalThis.fetch=originalFetch;if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage;await server.close();}
