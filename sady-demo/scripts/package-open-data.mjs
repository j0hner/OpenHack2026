import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {intersect} from '@turf/intersect';
const root=new URL('../public/data/',import.meta.url);
const read=async n=>JSON.parse(await readFile(new URL(n,root),'utf8'));
const save=async(n,v)=>writeFile(new URL(n,root),JSON.stringify(v));
const cache=new URL('../.data-cache/',import.meta.url);
const cached=async n=>JSON.parse(await readFile(new URL(n,cache),'utf8'));
const locations=await cached('locations.json').catch(async()=>{
 const entries=await read('locations-index.json');
 return Object.fromEntries(await Promise.all(entries.map(async e=>{
  const d=await read(e.file);
  if(!d.layers.parcels)d.layers.parcels=await read(e.parcelsFile);
  return [e.id,d];
 })));
});
await mkdir(new URL('locations/',root),{recursive:true});
const index=[]; const files=[];
for(const [id,data]of Object.entries(locations)){
 delete data.layers.flood;
 delete data.terrain;
 const [w,s,e,n]=data.bounds;
 const clip={type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}};
 // Do not bake unrelated provider attributes into the public bundle.
 for(const [key,collection]of Object.entries(data.layers)){
  if(key!=='parcels')collection.features=collection.features.flatMap(f=>{
   const clipped=intersect({type:'FeatureCollection',features:[clip,f]});
   return clipped?[{...clipped,properties:f.properties}]:[];
  });
  for(const f of collection.features){
   if(!['parcels','bpej'].includes(key)){
    const name=Object.entries(f.properties).find(([k])=>/^(nazev|name|nazev_uzemi|NAZEV)$/i.test(k))?.[1];
    f.properties={name:name??key};
   }
  }
 }
 const parcelsFile=`locations/${id}-parcels.json`;
 await save(parcelsFile,data.layers.parcels);
 delete data.layers.parcels;
 const name=`locations/${id}.json`;
 await save(name,data);
 const bytes=await readFile(new URL(name,root));
 index.push({id,center:data.center,bounds:data.bounds,file:name,parcelsFile});
 files.push({file:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 const parcelBytes=await readFile(new URL(parcelsFile,root));
 files.push({file:parcelsFile,bytes:parcelBytes.length,sha256:createHash('sha256').update(parcelBytes).digest('hex')});
}
await save('locations-index.json',index);
// JSON-stat uses row-major indexing: never assume the dimensions' order.
function cell(data,selection){
 let offset=0;
 for(let i=0;i<data.id.length;i++){
  const dim=data.id[i],code=selection[dim],idx=data.dimension[dim].category.index;
  const pos=Array.isArray(idx)?idx.indexOf(code):idx[code];
  if(pos===undefined||pos<0)return null;
  offset=offset*data.size[i]+pos;
 }
 const v=data.value[offset];return Number.isFinite(v)?v:null;
}
const yieldData=await cached('ZEM03D.json').catch(()=>null),prices=await cached('CEN0203B.json').catch(()=>null);
const references=yieldData&&prices?{}:await read('economics.json');
if(yieldData&&prices){
for(const [fruit,tree,product]of [['apple','901','2011'],['pear','913','2020'],['plum','903','2050'],['cherry','90306','2060'],['apricot','90303','2040']]){
 const years=[];
 for(let year=2021;year<=2025;year++){
  const get=indicator=>cell(yieldData,{DRUHSTROM:tree,IndicatorType:indicator,CasR:String(year),Uz02:'CZ'});
  const tonnes=get('590601'),hectares=get('590901');
  const price=cell(prices,{REPRCENZEM:product,IndicatorType:'6277',CASMKMQR:String(year),UZ02HU:'CZ'});
  years.push({year,harvestTonnes:tonnes,productionHectares:hectares,yieldTPerHa:tonnes!==null&&hectares>0?tonnes/hectares:null,pricePerKg:price!==null?price/1000:null});
 }
 references[fruit]={years,priceLabel:prices.dimension.REPRCENZEM.category.label[product],note:'ČR, všechna sledovaná stáří a způsoby hospodaření; nejde o výnos nového sadu ani záruku prodejní ceny.'};
}
}
await save('economics.json',references);
for(const name of ['economics.json','locations-index.json','municipalities.json','municipalities-metadata.json']){
 const bytes=await readFile(new URL(name,root));
 files.push({file:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const datasets=[
 {id:'ruian-parcels',name:'ČÚZK / RÚIAN – parcely',license:'CC BY 4.0',url:'https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/5',use:'GeoJSON výřezy a živý výběr parcely'},
 {id:'ruian-municipalities',name:'ČÚZK / RÚIAN – obce a města ČR',license:'CC BY 4.0',url:'https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/12',use:'Úplný místní našeptávač obcí; okresy z vrstvy 15, podrobnosti v municipalities-metadata.json'},
 {id:'ruian-bpej',name:'ČÚZK / RÚIAN – BPEJ (agendový zdroj SPÚ)',license:'CC BY 4.0',url:'https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/28',use:'Skutečné půdní polygony a plošné podíly; bez domyšleného pH'},
 {id:'era5-land',name:'Copernicus / ECMWF ERA5-Land + ERA5 přes Open-Meteo',license:'CC BY 4.0; bezplatná služba Open-Meteo pouze nekomerčně',url:'https://open-meteo.com/en/docs/historical-weather-api',use:'2005–2024, teplota ERA5-Land ~9 km, srážky a ET0 ERA5 ~25 km; roční agregace'},
 {id:'aopk',name:'AOPK – velkoplošná a maloplošná ZCHÚ, EVL, ptačí oblasti',license:'CC BY 4.0',url:'https://gis.nature.cz/arcgis/rest/services/Aplikace/Opendata/MapServer',use:'Prostorové průniky REST 0, 2, 6, 7; trvalý celostátní WMS překryv stejných kategorií 26, 22, 14, 13'},
 {id:'csu-harvest',name:'ČSÚ – Sklizeň ovoce ZEM03D',license:'Podmínky otevřených dat ČSÚ, bez autorskoprávní ochrany dle metadat',url:'https://data.csu.gov.cz/opendata/sady/ZEM03D/distribuce/json',use:'ČR, pět ovocných druhů, 2021–2025; skutečná sklizeň, chybějící plocha a t/ha zůstávají null'},
 {id:'csu-prices',name:'ČSÚ – Ceny zemědělských výrobků CEN0203B',license:'Podmínky otevřených dat ČSÚ, viz metadata sady',url:'https://data.csu.gov.cz/opendata/sady/CEN0203B/distribuce/json',use:'ČR, roční ceny ovoce 2021–2025; Kč/t převedeno na Kč/kg'},
 {id:'osm',name:'OpenStreetMap',license:'ODbL 1.0',url:'https://www.openstreetmap.org/copyright',use:'Online mapový podklad; dlaždice se nehromadí v repozitáři'},
 {id:'orthophoto',name:'ČÚZK – Ortofoto ČR',license:'CC BY 4.0',url:'https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer',use:'Online letecký podklad'},
 {id:'natural-earth',name:'Natural Earth 1:50m',license:'Public domain',url:'https://www.naturalearthdata.com/about/terms-of-use/',use:'Již přítomná záložní hranice ČR'},
];
await save('manifest.json',{preparedAt:new Date().toISOString(),scope:'Pět regionálních výřezů skutečných otevřených dat; nejde o celorepublikovou offline databázi',datasets,files,notes:['Modelové pěstitelské profily a náklady nejsou otevřenými měřenými daty.','Chybějící hodnoty zůstávají null.','Podklady se načítají po jednotlivých lokalitách.']});
const receipts=await cached('downloads.json').catch(()=>read('downloads.json')).catch(()=>null);
if(receipts){receipts.receipts=receipts.receipts.filter(r=>!r.url.includes('vuv.cz')&&!/dmr5g|terrascope|worldcover|sentinel/i.test(r.url));receipts.note='Částečný protokol posledního běhu stahování; úplné dotazy jsou reprodukovatelné skripty. Nejde o úplný audit všech stažení.';await save('downloads.json',receipts);}
// Raw nationwide tables remain in the ignored .data-cache directory.
console.log(JSON.stringify({locations:index.length,files:files.map(({file,bytes})=>({file,bytes}))},null,2));
