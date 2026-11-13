import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {area} from '@turf/area';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {splitGeometry,mergeGeometries,makeWorkingArea}=await server.ssrLoadModule('/src/lib/geometryOperations.ts');
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
 assert.throws(()=>splitGeometry(source,'north-south',1));assert.throws(()=>splitGeometry(source,'north-south',2,0));assert.throws(()=>mergeGeometries([source]));
 const original={id:'parcel-1',name:'Originál',kind:'parcel',geometry:source,cadastral:{id:'1',officialAreaM2:1234},regional:{status:'ready',data:{fake:'do not copy'}},location:{code:'1',katastr:'Katastr',obec:'Obec',okres:'Okres',kraj:'Kraj'},landUse:'orná půda',attributes:{soil:{ph:7},climate:{fake:1},water:null,terrain:null,access:null,constraints:null},availability:{soil:'complete',climate:'complete',water:'missing',terrain:'missing',access:'missing'}};
 const child=makeWorkingArea(halves[0],'Část',[original],'split');assert.notEqual(child.id,original.id);assert.equal(child.attributes.soil,null);assert.equal(child.attributes.climate,null);assert.equal(child.regional,undefined);assert.equal(child.cadastral,undefined);assert.deepEqual(child.derivedFrom.sourceIds,['parcel-1']);assert.equal(child.kind,'custom');
 console.log(JSON.stringify({checks:'OK',splitDirections:2,holes:true,multipolygons:true,overlapsCountedOnce:true,independentAnalyses:true}));
}finally{await server.close();}
