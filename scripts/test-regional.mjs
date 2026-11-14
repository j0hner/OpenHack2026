import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const originalFetch=globalThis.fetch;
globalThis.fetch=async input=>{
 const path=String(input);assert(path.startsWith('/data/')||path.startsWith('./data/'),'Test nesmí volat živý zdroj: '+path);
 return new Response(await readFile(new URL('../public/'+path.replace(/^\.\//,'').replace(/^\//,''),import.meta.url)),{headers:{'Content-Type':'application/json'}});
};
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const r=await server.ssrLoadModule('/src/lib/regionalData.ts');
 const {scoreRegionalArea}=await server.ssrLoadModule('/src/lib/regionalScoring.ts');
 const {locationIndex,parcelArea,geometryBounds,inBounds}=await server.ssrLoadModule('/src/lib/openData.ts');
 const referenceAreas=[];
 for(const entry of await locationIndex()){
  const collection=JSON.parse(await readFile(new URL('../public/data/'+entry.parcelsFile,import.meta.url)));
  const feature=collection.features.find(f=>{
   const b=geometryBounds(f.geometry);
   return [2,3,4,5,6,7,8].includes(Number(f.properties.druhpozemkukod))&&Number(f.properties.vymeraparcely)>1000&&inBounds([b[0],b[1]],entry.bounds)&&inBounds([b[2],b[3]],entry.bounds);
  });
  assert(feature,'A complete real agricultural parcel must be available in '+entry.id);
  referenceAreas.push(parcelArea(feature));
 }
 const {locationFor}=await server.ssrLoadModule('/src/lib/openData.ts');
 const local={};for(const a of referenceAreas)local[a.id]=!!await locationFor(a.geometry);
 console.log('Prepared real parcel coverage',local);
 const geometry={type:'Polygon',coordinates:[[[14,50],[14.002,50],[14.002,50.002],[14,50.002],[14,50]]]};
 const fc=(name,geom=geometry)=>({type:'FeatureCollection',features:[{type:'Feature',properties:{nazev:name},geometry:geom}]});
 const soil=r.soilSummary(geometry,fc('00100'));assert(Math.abs(soil.coveragePct-100)<.01);
 const hole={type:'Polygon',coordinates:[...geometry.coordinates,[[14.0005,50.0005],[14.0015,50.0005],[14.0015,50.0015],[14.0005,50.0015],[14.0005,50.0005]]]};
 const {containsPoint}=await server.ssrLoadModule('/src/lib/openData.ts');assert(containsPoint(hole,r.representativePoint(hole)));
 const d={key:r.geometryKey(geometry),fetchedAt:new Date().toISOString(),point:[14.001,50.001],source:'live',soil,climate:{years:Array.from({length:20},(_,i)=>({year:2005+i,temperatureMeanC:9,rainfallMm:650,et0Mm:600,springFrostDays:12,summerDays:40})),period:'2005–2024',model:'ERA5',resolution:'25 km',grid:[14,50],distanceKm:.1},terrain:{altitudeM:250,slopeDeg:2,point:[14.001,50.001],scope:'parcel',distanceKm:0},errors:[]};
 const area={...referenceAreas[0],kind:'parcel',geometry,regional:{status:'ready',data:d}};
 const normal=scoreRegionalArea(area,'apple');assert(normal.overall!==null);
 const cold=structuredClone(area);cold.regional.data.climate.years.forEach(y=>{y.temperatureMeanC=3;y.springFrostDays=60;y.summerDays=2;});
 assert(scoreRegionalArea(cold,'apple').overall<normal.overall);
 const dry=structuredClone(area);dry.regional.data.climate.years.forEach(y=>{y.rainfallMm=250;y.et0Mm=900;});
 assert(scoreRegionalArea(dry,'apple').categories.find(c=>c.key==='water').score<normal.categories.find(c=>c.key==='water').score);
 const missing=structuredClone(area);missing.regional.data.soil.coveragePct=79;assert.equal(scoreRegionalArea(missing,'apple').overall,null);
 const short=structuredClone(area);short.regional.data.climate.years=short.regional.data.climate.years.slice(0,14);assert.equal(scoreRegionalArea(short,'apple').overall,null);
 const renamed={...area,name:'Jiný název',location:{...area.location,kraj:'Jiný kraj'}};assert.equal(scoreRegionalArea(renamed,'apple').overall,normal.overall);
 const wrong=fc('00100',{type:'Polygon',coordinates:[[[15,50],[15.002,50],[15.002,50.002],[15,50.002],[15,50]]]});assert.equal(r.soilSummary(geometry,wrong).coveragePct,0);
 const duplicate=r.soilSummary(geometry,{type:'FeatureCollection',features:[...fc('00100').features,...fc('00100').features]});assert(Math.abs(duplicate.coveragePct-100)<.01);
 assert.notEqual(r.geometryKey(geometry),r.geometryKey(hole));
 const raw={time:[],temperature_2m_mean:[],temperature_2m_min:[],temperature_2m_max:[],precipitation_sum:[],et0_fao_evapotranspiration:[]};
 for(let t=Date.UTC(2005,0,1);t<Date.UTC(2006,0,1);t+=86400000){raw.time.push(new Date(t).toISOString().slice(0,10));raw.temperature_2m_mean.push(10);raw.temperature_2m_min.push(-1);raw.temperature_2m_max.push(26);raw.precipitation_sum.push(2);raw.et0_fao_evapotranspiration.push(1);}
 const years=r.aggregateWeather(raw);assert.equal(years[0].springFrostDays,92);assert.equal(years[0].rainfallMm,730);assert.equal(years[1].rainfallMm,null);
 raw.precipitation_sum[0]=null;assert.equal(r.aggregateWeather(raw)[0].rainfallMm,null);
 // Real downloaded BPEJ fixtures must produce geometry-specific coverage.
 const fixture=JSON.parse(await readFile(new URL('../public/data/locations/demo-a.json',import.meta.url)));
 assert(fixture.layers.bpej.features.length>0);assert(r.soilSummary(fixture.layers.bpej.features[0].geometry,fixture.layers.bpej).coveragePct>99);
 const observed=await r.loadRegionalData(referenceAreas[0].geometry,new AbortController().signal);
 for(const a of referenceAreas){const d=await r.loadRegionalData(a.geometry,new AbortController().signal);console.log(a.id,d.soil?.coveragePct,scoreRegionalArea({...a,regional:{status:'ready',data:d}},'apple').overall);}
 assert.equal(observed.source,'snapshot');assert.equal(observed.key,r.geometryKey(referenceAreas[0].geometry));
 const remoteOut=await r.loadRegionalData({type:'Polygon',coordinates:[[[0,0],[.001,0],[.001,.001],[0,.001],[0,0]]]},new AbortController().signal);
 assert.equal(remoteOut.climate,null);assert(remoteOut.errors.length>0);
 const staticFetch=globalThis.fetch;
 globalThis.fetch=async input=>String(input).startsWith('/data/')?staticFetch(input):new Response('{}',{status:503});
 const failedGeometry={type:'Polygon',coordinates:[[[14.61,50.1],[14.611,50.1],[14.611,50.101],[14.61,50.101],[14.61,50.1]]]};
 const failed=await r.loadRegionalData(failedGeometry,new AbortController().signal,true);
 assert.equal(failed.source,'live');assert.equal(failed.soil,null);assert.equal(failed.climate,null);assert.equal('protected' in failed,false);assert.equal(failed.errors.length,2);
 assert.equal(scoreRegionalArea({...area,geometry:failedGeometry,regional:{status:'ready',data:failed}},'apple').overall,null);
 globalThis.fetch=staticFetch;
 const tooLarge={type:'Polygon',coordinates:[[[14,50],[14.1,50],[14.1,50.1],[14,50.1],[14,50]]]};
 const rejected=await r.loadRegionalData(tooLarge,new AbortController().signal);assert(rejected.errors.some(e=>e.includes('rozsáhlá')));
 console.log(JSON.stringify({checks:'OK',temperateScore:normal.overall,coldScore:scoreRegionalArea(cold,'apple').overall,realSoilCoverage:observed.soil.coveragePct}));
}finally{globalThis.fetch=originalFetch;await server.close();}
