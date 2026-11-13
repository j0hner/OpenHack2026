import {writeFile,mkdir} from 'node:fs/promises';
await mkdir(new URL('../.data-cache/',import.meta.url),{recursive:true});
for(const [name,url]of [
 ['cadastre','https://services.cuzk.gov.cz/wms/local-km-wms.asp?SERVICE=WMS&REQUEST=GetCapabilities'],
]){
 const r=await fetch(url,{signal:AbortSignal.timeout(20000)});const text=await r.text();
 await writeFile(new URL(`../.data-cache/${name}-capabilities.xml`,import.meta.url),text);
 console.log(name,r.status,text.match(/<Name>[^<]+/g)?.slice(0,20),text.includes('3857'));
}
