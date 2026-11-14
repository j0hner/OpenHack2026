import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const originalFetch = globalThis.fetch;
const server = await createServer({server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});
const read = async name => JSON.parse(await readFile(new URL('../public/data/'+name,import.meta.url),'utf8'));
try {
 const c = await server.ssrLoadModule('/src/lib/parcelCoverage.ts');
 const q = await server.ssrLoadModule('/src/lib/coverageData.ts');
 const {geometryKey,soilSummary} = await server.ssrLoadModule('/src/lib/regionalData.ts');
 const {parcelArea} = await server.ssrLoadModule('/src/lib/openData.ts');
 const {parcelEligibility} = await server.ssrLoadModule('/src/lib/parcelEligibility.ts');
 const {scoreRegionalArea} = await server.ssrLoadModule('/src/lib/regionalScoring.ts');
 const index = await read('locations-index.json');
 let checked=0;
 for (const entry of index) {
  const snapshot=await read(entry.file),collection=await read(entry.parcelsFile);
  const candidates=collection.features.filter(f=>parcelEligibility(f).allowed).slice(0,18);
  for (const feature of candidates) {
   const coverage=c.coverageFromSnapshot(feature.geometry,snapshot);
   if(coverage.state==='unknown')continue;
   const area=parcelArea(feature);
   const data={key:geometryKey(feature.geometry),fetchedAt:new Date().toISOString(),point:[0,0],source:'snapshot',soil:soilSummary(feature.geometry,snapshot.layers.bpej),climate:snapshot.climate,errors:[]};
   area.regional={status:'ready',data};
   assert.equal(coverage.state==='sufficient',scoreRegionalArea(area,'apple').overall!==null,'Vrstva a regionální model se musí shodovat na podkladech.');
   assert.equal(c.coverageFromArea(area).state,coverage.state);
   checked++;
  }
 }
 assert(checked>40,'Test musí ověřit skutečné geometrie více lokalit.');
 const geometry={type:'Polygon',coordinates:[[[14.5,50],[14.501,50],[14.501,50.001],[14.5,50.001],[14.5,50]]]};
 const years=Array.from({length:20},(_,i)=>({year:2005+i,temperatureMeanC:10,rainfallMm:600,et0Mm:700,springFrostDays:10,summerDays:40}));
 const data={key:geometryKey(geometry),fetchedAt:'',point:[14.5,50],source:'live',soil:{parts:[{name:'00110',percent:100}],coveragePct:100,valid:true},climate:{years,period:'2005–2024',model:'ERA5',resolution:'0.25°',grid:[14.5,50],distanceKm:0},errors:[]};
 const area={...parcelArea({type:'Feature',properties:{id:123,cisloparcely:'1',druhpozemkukod:2,katastralniuzemi:123456},geometry}),regional:{status:'ready',data}};
 assert.equal(c.coverageFromData(geometry,data).state,'sufficient');
 assert.equal(c.coverageFromData(geometry,data).availableCategories,3);
 assert.equal(c.coverageFromArea({...area,regional:{status:'idle',data:null}}).state,'unknown');
 assert.equal(c.coverageFromArea({...area,regional:undefined}).state,'unknown');
 assert.equal(c.coverageFromArea({...area,regional:{status:'loading',data:null}}).state,'loading');
 assert.equal(c.coverageFromArea({...area,regional:{status:'error',data:null,message:'HTTP 503'}}).state,'error');
 assert.equal(c.coverageFromArea({...area,regional:{status:'ready',data:{...data,key:'another-geometry'}}}).state,'unknown');
 const soilMissing={...data,soil:null};
 assert.equal(c.coverageFromData(geometry,soilMissing).state,'insufficient');
 assert.equal(c.coverageFromData(geometry,soilMissing).availableCategories,2);
 assert.equal(c.coverageFromData(geometry,{...data,soil:{...data.soil,coveragePct:79.99,parts:[{name:'00110',percent:79.99}]}}).state,'insufficient');
 assert.equal(c.coverageFromData(geometry,{...data,soil:{...data.soil,coveragePct:100,parts:[{name:'09010',percent:100}]}}).state,'insufficient','Neznámá HPJ nesmí být vydávána za hodnotitelné pokrytí.');
 assert.equal(c.coverageFromData(geometry,{...data,soil:{...data.soil,valid:false}}).state,'insufficient');
 assert.equal(c.coverageFromData(geometry,{...data,climate:{...data.climate,years:years.slice(0,14)}}).state,'insufficient');
 assert.equal(c.coverageFromData(geometry,{...data,climate:{...data.climate,years:years.slice(0,15)}}).state,'sufficient');
 assert.equal(c.coverageFromData(geometry,{...data,climate:{...data.climate,years:years.slice(0,15).map((y,i)=>i?y:{...y,rainfallMm:null})}}).state,'insufficient');
 assert.equal(c.coverageFromArea({...area,regional:{status:'ready',data:{...soilMissing,errors:['BPEJ: HTTP 503']}}}).state,'error','Selhání API neznamená potvrzenou absenci dat.');
 const huge={type:'Polygon',coordinates:[[[14,50],[14.1,50],[14.1,50.1],[14,50.1],[14,50]]]};
 assert.equal(c.coverageFromData(huge,{...data,key:geometryKey(huge)}).state,'insufficient');
 assert.equal(c.coverageFromArea({...area,geometry:huge,regional:{status:'ready',data:{...data,key:geometryKey(huge),soil:null,climate:null,errors:['Plocha je příliš rozsáhlá.']}}}).state,'insufficient','Známý limit modelu je překážka indexu, nikoli síťová chyba.');
 assert.match(c.coverageDescription(c.unknownCoverage()),/neověřeno/);
 assert.match(q.coverageExtentMessage(null,7),/Přibližte/);
 assert.match(q.coverageExtentMessage([12,48.5,18,51],14),/8 km/);
 assert.match(q.coverageExtentMessage([20,50,21,51],15),/České republice/);
 assert.equal(q.coverageExtentMessage([14.5,50,14.51,50.01],15),'');

 let calls=0;
 globalThis.fetch=async input=>{
  const url=String(input);calls++;
  if(url.endsWith('/data/locations-index.json'))return Response.json(index);
  assert(url.startsWith('https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/5/query?'),'Vrstva nesmí volat počasí nebo půdu na každou parcelu.');
  const params=new URL(url).searchParams;
  assert.equal(params.get('resultRecordCount'),String(q.COVERAGE_LIMIT+1));
  assert.match(params.get('where'),/druhpozemkukod IN/);
  return Response.json({type:'FeatureCollection',exceededTransferLimit:true,features:Array.from({length:205},(_,i)=>({type:'Feature',properties:{id:10000+i,cisloparcely:String(i),druhpozemkukod:i===0?10:2},geometry}))});
 };
 const request=await q.queryCoverageParcels([14.49,49.99,14.52,50.02],new AbortController().signal,{checkData:false});
 assert.equal(request.parcels.length,200);assert.equal(request.truncated,true);
 assert(request.parcels.every(row=>row.coverage.state==='unknown'),'Nové parcely mimo výřezy nemají vymyšlené ani zástupné podklady.');
 assert(request.parcels.every(row=>parcelEligibility(row.feature).allowed));
 assert.equal(calls,2,'Jediný index a jediný ohraničený parcelní dotaz, žádný API fanout.');
 const cached=await q.queryCoverageParcels([14.49,49.99,14.52,50.02],new AbortController().signal,{checkData:false});assert.strictEqual(cached,request);assert.equal(calls,2);
 const abort=new AbortController();abort.abort();await assert.rejects(q.queryCoverageParcels([14.49,49.99,14.52,50.02],abort.signal),{name:'AbortError'});
 globalThis.fetch=async()=>new Response('{}',{status:503});
 await assert.rejects(q.queryCoverageParcels([14.53,50,14.54,50.01],new AbortController().signal),/HTTP 503/);
 let fallbackQueries=0;
 const localGeometry={type:'Polygon',coordinates:[[[16.7301,48.9397],[16.7302,48.9397],[16.7302,48.9398],[16.7301,48.9398],[16.7301,48.9397]]]};
 globalThis.fetch=async input=>{
  if(String(input).startsWith('https://ags.cuzk.gov.cz/')){
   fallbackQueries++;return Response.json({type:'FeatureCollection',features:[{type:'Feature',properties:{id:9000001,cisloparcely:'1',druhpozemkukod:2},geometry:localGeometry}]});
  }
  return new Response('{}',{status:503});
 };
 const fallback=await q.queryCoverageParcels([16.73,48.9396,16.7305,48.9401],new AbortController().signal,{checkData:false});
 assert.equal(fallbackQueries,1,'Nedostupný lokální soubor nesmí potlačit živý katastr jen proto, že jeho bbox je v indexu.');
 assert.equal(fallback.parcels.length,1);assert.equal(fallback.parcels[0].coverage.state,'unknown');assert(fallback.warning);
 let resolveStarted,resolveResponse;
 const started=new Promise(resolve=>{resolveStarted=resolve;});
 globalThis.fetch=async()=>{resolveStarted();return new Promise(resolve=>{resolveResponse=resolve;});};
 const staleController=new AbortController();
 const stale=q.queryCoverageParcels([14.8,50,14.81,50.01],staleController.signal);
 await started;staleController.abort();resolveResponse(Response.json({type:'FeatureCollection',features:[]}));
 await assert.rejects(stale,{name:'AbortError'},'Odpověď předchozího výřezu se po abortu nesmí použít.');
 console.log(JSON.stringify({checks:'OK',realParcelComparisons:checked,thresholds:'80% rated BPEJ / 15 complete years',unknownVsError:true,boundedParcels:200,apiFanout:false}));
} finally {globalThis.fetch=originalFetch;await server.close();}
