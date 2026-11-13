import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {area} from '@turf/area';
const root=new URL('../public/data/',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const manifest=await read('manifest.json'),index=await read('locations-index.json');
assert.equal(index.length,5);
assert(!manifest.datasets.some(d=>d.id.includes('vuv')),'Neověřená licence nesmí být v distribuovaných datech.');
let parcels=0,bytes=0;
for(const entry of index){
 const d=await read(entry.file),p=await read(entry.parcelsFile);
 assert.equal(d.climate.years.length,20);
 for(const y of d.climate.years){
  assert(y.validTemperatureDays===y.totalDays&&[365,366].includes(y.totalDays),'Neúplné teploty');
  assert(y.rainfallMm>0&&y.rainfallMm<5000,'Chybějící nebo neplatné srážky');
  assert(y.et0Mm>0&&y.springFrostDays>=0&&y.springFrostDays<=92);
 }
 assert(Number.isFinite(d.terrain.centerAltitudeM));
 assert(!('flood' in d.layers));
 assert(p.features.length>0);
 const ids=new Set();
 for(const f of p.features){assert(!ids.has(f.properties.id));ids.add(f.properties.id);assert(area(f)>0);}
 parcels+=p.features.length;
 for(const c of Object.values(d.layers))for(const f of c.features){
  assert(['Polygon','MultiPolygon'].includes(f.geometry.type));assert(area(f)>0);
  const coords=f.geometry.coordinates.flat(f.geometry.type==='Polygon'?1:2);
  for(const [x,y] of coords){assert(x>=entry.bounds[0]-1e-7&&x<=entry.bounds[2]+1e-7);assert(y>=entry.bounds[1]-1e-7&&y<=entry.bounds[3]+1e-7);}
 }
}
for(const file of manifest.files){
 const data=await readFile(new URL(file.file,root));bytes+=data.length;
 assert.equal(data.length,file.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256);
}
assert(bytes<6500000,'Překročen limit statických výřezů.');
const economics=await read('economics.json');
assert.equal(Object.keys(economics).length,5);
assert.equal(economics.apple.years.at(-1).pricePerKg,17.424);
assert.equal(economics.apricot.years.find(y=>y.year===2023).pricePerKg,null);
for(const reference of Object.values(economics))for(const year of reference.years){assert(year.harvestTonnes>0);assert.equal(year.yieldTPerHa,null);}
console.log(JSON.stringify({locations:index.length,parcels,bytes,climateYears:100,checks:'OK'}));
