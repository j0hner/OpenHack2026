import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {area} from '@turf/area';
import {intersect} from '@turf/intersect';
import {readFile} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {splitGeometry,splitGeometryByLine,mergeGeometries,makeWorkingArea}=await server.ssrLoadModule('/src/lib/geometryOperations.ts');
 const {containsPoint}=await server.ssrLoadModule('/src/lib/openData.ts');
 const rect=(w,s,e,n)=>({type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]});
 const source=rect(14,50,14.004,50.004),parentArea=area(source);
 const near=(a,b)=>assert(Math.abs(a-b)<Math.max(.1,a*.00001),`${a} vs ${b}`);
 const halves=splitGeometry(source,'north-south',2,30);assert.equal(halves.length,2);near(halves.reduce((s,g)=>s+area(g),0),parentArea);assert(area(halves[0])<area(halves[1]));
 const thirds=splitGeometry(source,'east-west',3);assert.equal(thirds.length,3);near(thirds.reduce((s,g)=>s+area(g),0),parentArea);
 near(area(mergeGeometries(halves)),parentArea);
 const holeRing=rect(14.001,50.001,14.003,50.003).coordinates[0];
 const donut={...source,coordinates:[source.coordinates[0],holeRing]};
 const quarters=splitGeometry(donut,'north-south',4);near(quarters.reduce((s,g)=>s+area(g),0),area(donut));
 const rejoined=mergeGeometries(quarters);near(area(rejoined),area(donut));assert.equal(containsPoint(rejoined,[14.002,50.002]),false);assert(containsPoint(rejoined,[14.0005,50.0005]));
 const overlap=rect(14.002,50,14.006,50.004);const union=mergeGeometries([source,overlap]);assert(area(union)<area(source)+area(overlap));near(area(union),area(rect(14,50,14.006,50.004)));
 const island=rect(14.01,50,14.014,50.004);const disjoint=mergeGeometries([source,island]);assert.equal(disjoint.type,'MultiPolygon');near(area(disjoint),area(source)+area(island));
 const islandParts=splitGeometry(disjoint,'east-west',2);assert.equal(islandParts.length,2);assert(islandParts.every(g=>g.type==='MultiPolygon'));near(islandParts.reduce((s,g)=>s+area(g),0),area(disjoint));
 const irregular={type:'Polygon',coordinates:[[[14,50],[14.004,50],[14.004,50.001],[14.001,50.001],[14.001,50.004],[14,50.004],[14,50]]]};
 const lParts=splitGeometry(irregular,'north-south',3);near(lParts.reduce((s,g)=>s+area(g),0),area(irregular));
 const assertLineSplit=(geometry,line)=>{
  const parts=splitGeometryByLine(geometry,line);assert.equal(parts.length,2);
  near(parts.reduce((s,g)=>s+area(g),0),area(geometry));parts.forEach(part=>assert(area(part)>=1));
  const overlap=intersect({type:'FeatureCollection',features:parts.map(geometry=>({type:'Feature',properties:{},geometry}))});
  assert(!overlap||area(overlap)<.1,'Split parts must not overlap');
  near(area(mergeGeometries(parts)),area(geometry));
  return parts;
 };
 assertLineSplit(source,[[13.999,50.002],[14.005,50.002]]);
 assertLineSplit(source,[[14.002,49.999],[14.002,50.005]]);
 const diagonalParts=assertLineSplit(source,[[13.999,49.999],[14.005,50.005]]);
 const reverseParts=assertLineSplit(source,[[14.005,50.005],[13.999,49.999]]);
 near(area(diagonalParts[0]),area(reverseParts[1]));
 const donutParts=assertLineSplit(donut,[[13.999,50.002],[14.005,50.002]]);
 donutParts.forEach(part=>assert(!containsPoint(part,[14.002,50.002]),'A split cannot fill a hole'));
 const multiLineParts=assertLineSplit(disjoint,[[13.999,50.002],[14.015,50.002]]);
 assert(multiLineParts.every(p=>p.type==='MultiPolygon'));
 assertLineSplit(irregular,[[14.0005,49.999],[14.0005,50.005]]);
 // Short finite segment must not cut a second island via an infinite extension.
 assert.throws(()=>splitGeometryByLine(disjoint,[[13.999,50.002],[14.005,50.002]]),/příliš krátká/);
 // A separator that never crosses either island is not a drawn parcel cut.
 assert.throws(()=>splitGeometryByLine(disjoint,[[14.007,49.999],[14.007,50.005]]),/neprotíná/);
 assert.throws(()=>splitGeometryByLine(source,[[13.999,49.999],[14.005,49.999]]));
 assert.throws(()=>splitGeometryByLine(source,[[13.999,50],[14.005,50]]));
 assert.throws(()=>splitGeometryByLine(source,[[13.999,50.001],[14.001,49.999]]));
 assert.throws(()=>splitGeometryByLine(source,[[14.001,50.001],[14.003,50.003]]),/mimo vnější hranici/);
 assert.throws(()=>splitGeometryByLine(source,[[14.002,50.002],[14.005,50.002]]),/mimo vnější hranici/);
 assert.throws(()=>splitGeometryByLine(donut,[[14.002,50.002],[14.005,50.002]]),/otvoru/);
 assert.throws(()=>splitGeometryByLine(donut,[[13.999,50.001],[14.005,50.001]]),/splývá/);
 assert.throws(()=>splitGeometryByLine(source,[[13.999,49.999],[13.999,49.999]]),/krátká/);
 assert.throws(()=>splitGeometryByLine(source,[[NaN,50],[14,51]]),/souřadnice/);
 assert.throws(()=>splitGeometryByLine(source,[[14,50]]),/dva body/);
 assert.throws(()=>splitGeometryByLine(source,[[14,50],[15,51],[16,52]]),/dva body/);
 // Exercise full downloaded cadastral geometry, not only synthetic rectangles.
 const cadastral=JSON.parse(await readFile(new URL('../public/data/locations/demo-d-parcels.json',import.meta.url),'utf8'));
 const real=cadastral.features.find(f=>f.geometry.type==='Polygon'&&f.properties.vymeraparcely>10000&&f.geometry.coordinates[0].length>10);
 assert(real,'A real cadastral fixture must be available');
 const all=real.geometry.coordinates.flat(),xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);
 const left=Math.min(...xs),right=Math.max(...xs),bottom=Math.min(...ys),top=Math.max(...ys),middle=(bottom+top)/2;
 assertLineSplit(real.geometry,[[left-(right-left),middle],[right+(right-left),middle]]);
 assert.throws(()=>splitGeometry(source,'north-south',1));assert.throws(()=>splitGeometry(source,'north-south',2,0));assert.throws(()=>mergeGeometries([source]));
 const original={id:'parcel-1',name:'Originál',kind:'parcel',geometry:source,cadastral:{id:'1',officialAreaM2:1234},regional:{status:'ready',data:{fake:'do not copy'}},location:{code:'1',katastr:'Katastr',obec:'Obec',okres:'Okres',kraj:'Kraj'},landUse:'orná půda',attributes:{soil:{ph:7},climate:{fake:1},water:null,terrain:null,access:null,constraints:null},availability:{soil:'complete',climate:'complete',water:'missing',terrain:'missing',access:'missing'}};
 const child=makeWorkingArea(halves[0],'Část',[original],'split');assert.notEqual(child.id,original.id);assert.equal(child.attributes.soil,null);assert.equal(child.attributes.climate,null);assert.equal(child.regional,undefined);assert.equal(child.cadastral,undefined);assert.deepEqual(child.derivedFrom.sourceIds,['parcel-1']);assert.equal(child.kind,'custom');
 assert.deepEqual(child.derivedFrom.rootSourceIds,['parcel-1']);assert.deepEqual(child.derivedFrom.rootSourceNames,['Originál']);assert.deepEqual(child.derivedFrom.rootCadastralIds,['1']);
 // Intermediate parent can be renamed/deleted or removed by an undo. The nested
 // child's serialised metadata must still identify the original cadastral source.
 const persistedChild=JSON.parse(JSON.stringify({...child,name:'Přejmenovaná část'}));
 const grandchild=makeWorkingArea(splitGeometry(halves[0],'east-west',2)[0],'Vnořená část',[persistedChild],'split');
 assert.deepEqual(grandchild.derivedFrom.sourceIds,[child.id]);assert.deepEqual(grandchild.derivedFrom.rootSourceIds,['parcel-1']);assert.deepEqual(grandchild.derivedFrom.rootSourceNames,['Originál']);assert.deepEqual(grandchild.derivedFrom.rootCadastralIds,['1']);assert.equal(grandchild.cadastral,undefined);
 const other={...original,id:'parcel-2',name:'Druhý originál',geometry:island,cadastral:{id:'2',officialAreaM2:1200}};
 const mixed=makeWorkingArea(mergeGeometries([grandchild.geometry,other.geometry]),'Spojení původů',[grandchild,other],'merge');
 assert.deepEqual(mixed.derivedFrom.rootSourceIds,['parcel-1','parcel-2']);assert.deepEqual(mixed.derivedFrom.rootSourceNames,['Originál','Druhý originál']);assert.deepEqual(mixed.derivedFrom.rootCadastralIds,['1','2']);assert.equal(mixed.cadastral,undefined);
 const deduplicated=makeWorkingArea(mergeGeometries([child.geometry,grandchild.geometry]),'Stejný původ',[child,grandchild],'merge');assert.deepEqual(deduplicated.derivedFrom.rootSourceIds,['parcel-1']);assert.deepEqual(deduplicated.derivedFrom.rootCadastralIds,['1']);
 const legacyChild={...child,derivedFrom:{operation:'split',sourceIds:['parcel-1'],sourceNames:['Originál']}};
 const migratedChild=makeWorkingArea(child.geometry,'Starší původ',[legacyChild],'split');assert.deepEqual(migratedChild.derivedFrom.rootSourceIds,['parcel-1']);assert.deepEqual(migratedChild.derivedFrom.rootCadastralIds,['1']);
 console.log(JSON.stringify({checks:'OK',splitDirections:2,lineSplitting:true,finiteSegment:true,realParcel:real.properties.id,holes:true,multipolygons:true,overlapsCountedOnce:true,independentAnalyses:true}));
}finally{await server.close();}
