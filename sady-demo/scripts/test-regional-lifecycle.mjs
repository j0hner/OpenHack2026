import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const originalFetch=globalThis.fetch,originalStorage=globalThis.localStorage;
const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const rectangle=(west,south=.1)=>({type:'Polygon',coordinates:[[[west,50+south],[west+.001,50+south],[west+.001,50+south+.001],[west,50+south+.001],[west,50+south]]]});
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};
const dailyTemplate={time:[],temperature_2m_min:[],temperature_2m_max:[],precipitation_sum:[],et0_fao_evapotranspiration:[]};
for(let time=Date.UTC(2005,0,1);time<Date.UTC(2025,0,1);time+=86400000){
 dailyTemplate.time.push(new Date(time).toISOString().slice(0,10));dailyTemplate.temperature_2m_min.push(1);dailyTemplate.temperature_2m_max.push(26);dailyTemplate.precipitation_sum.push(2);dailyTemplate.et0_fao_evapotranspiration.push(1);
}
let weatherTemperature=10,liveRequests=0;
const weatherCalls=new Map(),soilCalls=new Map(),protectionCalls=new Map();
const holds=new Map(),failProtection=new Set(),failSoil=new Set();
const cachedData=key=>JSON.parse(storage.get('sady-regional-geo2')??'[]').find(value=>value.key===key);
try{
 const r=await server.ssrLoadModule('/src/lib/regionalData.ts');
 const {scoreRegionalArea}=await server.ssrLoadModule('/src/lib/regionalScoring.ts');
 const {parcelArea}=await server.ssrLoadModule('/src/lib/openData.ts');
 globalThis.fetch=async input=>{
  const url=String(input);
  if(url.startsWith('/data/')||url.startsWith('./data/'))return new Response(await readFile(new URL('../public/'+url.replace(/^\.\//,'').replace(/^\//,''),import.meta.url)),{headers:{'Content-Type':'application/json'}});
  liveRequests++;
  const u=new URL(url),params=u.searchParams;
  if(url.includes('archive-api.open-meteo.com/')){
   const lon=Number(params.get('longitude')),lat=Number(params.get('latitude')),cell=[Math.round(lon*4)/4,Math.round(lat*4)/4];
   const key=cell.join(',');weatherCalls.set(key,(weatherCalls.get(key)??0)+1);
   return Response.json({longitude:cell[0],latitude:cell[1],daily:{...dailyTemplate,temperature_2m_mean:dailyTemplate.time.map(()=>weatherTemperature)}});
  }
  const bounds=params.get('geometry').split(',').map(Number),west=bounds[0],key=String(west);
  const geometry={type:'Polygon',coordinates:[[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[2],bounds[3]],[bounds[0],bounds[3]],[bounds[0],bounds[1]]]]};
  if(url.includes('RUIAN/MapServer/28/')){
   soilCalls.set(key,(soilCalls.get(key)??0)+1);
   if(failSoil.has(key))return new Response('{}',{status:503});
   return Response.json({type:'FeatureCollection',features:[{type:'Feature',properties:{nazev:'00100'},geometry}]});
  }
  if(url.includes('gis.nature.cz/')){
   protectionCalls.set(key,(protectionCalls.get(key)??0)+1);
   const hold=holds.get(key);
   if(hold){holds.delete(key);hold.started.resolve();await hold.release.promise;}
   if(failProtection.has(key))return new Response('{}',{status:503});
   const layer=u.pathname.match(/MapServer\/(\d+)\/query/)[1];
   return Response.json({type:'FeatureCollection',features:[{type:'Feature',properties:{nazev:`Ochrana ${west}, vrstva ${layer}`},geometry}]});
  }
  throw Error('Unexpected external API: '+url);
 };

 // Factual prepared parcels stay fast and never launch unnecessary live lookups.
 const fixture=JSON.parse(await readFile(new URL('../public/data/locations/demo-d-parcels.json',import.meta.url),'utf8'));
 const prepared=fixture.features.find(feature=>String(feature.properties.id)==='1245682735');
 const staticProgress=[];
 const snapshot=await r.loadRegionalData(prepared.geometry,new AbortController().signal,false,value=>staticProgress.push(value));
 assert.equal(snapshot.source,'snapshot');assert.equal(liveRequests,0);assert.equal(staticProgress.length,0);
 assert(snapshot.protected!==null);assert(!snapshot.protectionPending);

 // Two subscribers share one geometry request and receive core before slow AOPK.
 const g=rectangle(14.61),key=r.geometryKey(g),hold={started:deferred(),release:deferred()};holds.set('14.61',hold);
 const a=new AbortController(),b=new AbortController(),firstCore=deferred(),secondCore=deferred();
 const aEvents=[],bEvents=[];let firstFinished=false,secondFinished=false;
 const first=r.loadRegionalData(g,a.signal,false,data=>{aEvents.push(freeze(data));firstCore.resolve(data);});
 const second=r.loadRegionalData(g,b.signal,false,data=>{bEvents.push(data);secondCore.resolve(data);});
 first.then(()=>{firstFinished=true;},()=>{});second.then(()=>{secondFinished=true;},()=>{});
 const [core,otherCore]=await Promise.all([firstCore.promise,secondCore.promise,hold.started.promise]);
 assert.strictEqual(core,otherCore);assert.equal(core.key,key);assert.equal(core.protectionPending,true);assert.equal(core.protected,null);
 assert(core.soil.coveragePct>99);assert.equal(core.climate.years.length,20);assert.equal(core.errors.length,0);
 assert.equal(firstFinished,false);assert.equal(secondFinished,false);assert.equal(soilCalls.get('14.61'),1);assert.equal(weatherCalls.get('14.5,50'),1);
 assert.equal(cachedData(key),undefined,'Only final data may enter persistent cache.');
 const coreText=JSON.stringify(core);

 // Deselecting one view detaches only it. A new view reattaches immediately to
 // the usable core and still receives the eventual protection enrichment.
 a.abort();await assert.rejects(first,{name:'AbortError'});
 const c=new AbortController(),lateEvents=[];
 const late=r.loadRegionalData(g,c.signal,false,data=>lateEvents.push(data));
 assert.equal(lateEvents.length,1);assert.strictEqual(lateEvents[0],core);
 hold.release.resolve();
 const [final,lateFinal]=await Promise.all([second,late]);
 assert.strictEqual(final,lateFinal);assert.equal(final.protectionPending,false);assert.equal(final.protected.length,4);
 assert(final.protected.every(item=>item.name.includes('14.61')));assert.equal(protectionCalls.get('14.61'),4);
 assert.equal(JSON.stringify(core),coreText,'Published core snapshots must not be mutated by AOPK completion.');
 assert.equal(aEvents.length,1,'An aborted subscriber receives no subsequent notifications.');assert.equal(bEvents.length,1);
 assert(cachedData(key).protected.length===4&&!cachedData(key).protectionPending);
 const base=parcelArea({type:'Feature',properties:{id:1,cisloparcely:'1',druhpozemkukod:2,katastralniuzemi:123456},geometry:g});
 const coreScore=scoreRegionalArea({...base,regional:{status:'ready',data:core}},'apple');
 const finalScore=scoreRegionalArea({...base,regional:{status:'ready',data:final}},'apple');
 assert.notEqual(coreScore.overall,null);assert.equal(finalScore.overall,coreScore.overall);assert.equal(coreScore.constraints.length,0);assert.equal(finalScore.constraints.length,4);

 // Refresh really refreshes weather too; unrelated parcels remain geometry-keyed.
 weatherTemperature=12;
 const refreshed=await r.loadRegionalData(g,new AbortController().signal,true);
 assert.equal(weatherCalls.get('14.5,50'),2);assert.equal(refreshed.climate.years[0].temperatureMeanC,12);
 const otherGeometry=rectangle(14.86),other=await r.loadRegionalData(otherGeometry,new AbortController().signal);
 assert.notEqual(other.key,key);assert.equal(other.key,r.geometryKey(otherGeometry));assert.notDeepEqual(other.point,final.point);
 assert(other.protected.every(item=>item.name.includes('14.86')));
 const cellCalls=weatherCalls.get('14.5,50');
 const again=await r.loadRegionalData(g,new AbortController().signal);assert.strictEqual(again,refreshed);assert.equal(weatherCalls.get('14.5,50'),cellCalls);

 // A failure of the optional protection source cannot discard usable core or
 // masquerade as a completed, restriction-free protection lookup.
 const badProtectionGeometry=rectangle(15.11),badProtectionKey=r.geometryKey(badProtectionGeometry);
 const failureHold={started:deferred(),release:deferred()};holds.set('15.11',failureHold);failProtection.add('15.11');
 const failureCore=deferred();
 const failure=r.loadRegionalData(badProtectionGeometry,new AbortController().signal,false,data=>failureCore.resolve(data));
 const beforeFailure=await failureCore.promise;
 assert(beforeFailure.soil&&beforeFailure.climate&&beforeFailure.protectionPending);
 failureHold.release.resolve();const afterFailure=await failure;
 assert.equal(afterFailure.protectionPending,false);assert.equal(afterFailure.protected,null);assert(afterFailure.errors.some(error=>error.startsWith('AOPK:')));
 assert(afterFailure.soil&&afterFailure.climate);assert.equal(cachedData(badProtectionKey),undefined);assert.equal(beforeFailure.errors.length,0);

 // Core errors remain explicit in progress and final data.
 const badSoilGeometry=rectangle(15.36),badSoilHold={started:deferred(),release:deferred()};holds.set('15.36',badSoilHold);failSoil.add('15.36');
 const badSoilCore=deferred(),badSoil=r.loadRegionalData(badSoilGeometry,new AbortController().signal,false,data=>badSoilCore.resolve(data));
 const missingSoil=await badSoilCore.promise;assert.equal(missingSoil.soil,null);assert(missingSoil.errors.some(error=>error.startsWith('BPEJ:')));
 badSoilHold.release.resolve();const badSoilFinal=await badSoil;assert.equal(badSoilFinal.soil,null);assert(badSoilFinal.errors.some(error=>error.startsWith('BPEJ:')));

 // An earlier in-flight request must not overwrite a newer refresh in cache.
 const racingGeometry=rectangle(15.61),racingKey=r.geometryKey(racingGeometry),oldHold={started:deferred(),release:deferred()};holds.set('15.61',oldHold);
 const oldCore=deferred();weatherTemperature=7;
 const old=r.loadRegionalData(racingGeometry,new AbortController().signal,false,data=>oldCore.resolve(data));
 await oldCore.promise;weatherTemperature=13;
 const newer=await r.loadRegionalData(racingGeometry,new AbortController().signal,true);
 oldHold.release.resolve();await old;
 assert.equal(cachedData(racingKey).climate.years[0].temperatureMeanC,13);
 assert.strictEqual(await r.loadRegionalData(racingGeometry,new AbortController().signal),newer);

 const alreadyAborted=new AbortController();alreadyAborted.abort();
 await assert.rejects(r.loadRegionalData(g,alreadyAborted.signal),{name:'AbortError'});
 console.log(JSON.stringify({checks:'OK',earlyCore:true,protectionEnrichment:true,sharedSubscribers:true,abortAndReselect:true,immutableSnapshots:true,finalOnlyCache:true,refreshWeather:true,geometryIsolation:true}));
}finally{globalThis.fetch=originalFetch;if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage;await server.close();}
