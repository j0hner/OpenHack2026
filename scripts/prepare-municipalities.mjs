import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const base='https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer';
const out=new URL('../public/data/',import.meta.url);
const requests=[];
async function query(layer,params){
 const url=`${base}/${layer}/query?${new URLSearchParams({f:'json',...params})}`;
 const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(`ČÚZK HTTP ${response.status}`);
 const text=await response.text(),data=JSON.parse(text);
 if(data.error)throw Error(JSON.stringify(data.error));
 requests.push({url,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')});
 return data;
}
const where='statuskod <> 1'; // Municipalities and towns, excluding military training areas.
const expected=(await query(12,{where,returnCountOnly:'true'})).count;
if(!Number.isInteger(expected)||expected<6000)throw Error('Unexpected municipality count');
const districts=await query(15,{where:'1=1',returnGeometry:'false',outFields:'kod,nazev',orderByFields:'kod',resultRecordCount:'500'});
if(districts.exceededTransferLimit||!districts.features?.length)throw Error('Incomplete districts');
const districtNames=new Map(districts.features.map(f=>[f.attributes.kod,f.attributes.nazev]));
const result=[];
for(let offset=0;offset<expected;offset+=500){
 const data=await query(12,{where,outFields:'kod,nazev,okres,statuskod',outSR:'4326',returnGeometry:'true',orderByFields:'kod',resultRecordCount:'500',resultOffset:String(offset),maxAllowableOffset:'0.001',geometryPrecision:'5'});
 if(!Array.isArray(data.features)||!data.features.length)throw Error('Missing municipality page');
 for(const feature of data.features){
  const p=feature.attributes,points=feature.geometry?.rings?.flat();
  if(!points?.length)throw Error(`Missing municipality geometry ${p.kod}`);
  const w=Math.min(...points.map(p=>p[0])),s=Math.min(...points.map(p=>p[1])),e=Math.max(...points.map(p=>p[0])),n=Math.max(...points.map(p=>p[1]));
  if(w<11||e>20||s<48||n>52)throw Error(`Invalid coordinates ${p.kod}`);
  const district=districtNames.get(p.okres)??(p.statuskod===5?'Hlavní město Praha':null);
  if(!district)throw Error(`Missing district ${p.okres} for ${p.nazev}`);
  const round=v=>Math.round(v*100000)/100000;
  // Compact rows: code, name, district, bbox centre lon/lat, status, W/S/E/N.
  result.push([p.kod,p.nazev,district,round((w+e)/2),round((s+n)/2),p.statuskod,round(w),round(s),round(e),round(n)]);
 }
 console.log(`${Math.min(offset+500,expected)}/${expected}`);
}
if(result.length!==expected||new Set(result.map(r=>r[0])).size!==expected)throw Error('Count or unique ID mismatch');
const json=JSON.stringify(result);
if(Buffer.byteLength(json)>1000000)throw Error('Municipality bundle exceeds 1 MB');
await mkdir(out,{recursive:true});
await writeFile(new URL('municipalities.json',out),json);
await writeFile(new URL('municipalities-metadata.json',out),JSON.stringify({name:'ČÚZK / RÚIAN – obce a města ČR, okresy',provider:'ČÚZK',license:'CC BY 4.0',licenseUrl:'https://ags.cuzk.gov.cz/opendata/',preparedAt:new Date().toISOString(),count:result.length,bytes:Buffer.byteLength(json),sha256:createHash('sha256').update(json).digest('hex'),schema:['kod','nazev','okres','lon','lat','statuskod','west','south','east','north'],coordinates:'EPSG:4326. Navigation point is bbox centre of generalized municipality geometry, not a parcel or official definition point.',filter:where,sources:[`${base}/12`,`${base}/15`],requests}));
console.log(JSON.stringify({count:result.length,bytes:Buffer.byteLength(json)}));
