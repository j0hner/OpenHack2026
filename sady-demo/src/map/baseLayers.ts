import L from 'leaflet';
export type BaseMap='osm'|'aerial'|'satellite'|'terrain';
export const BASE_MAPS:Record<BaseMap,string>={osm:'OpenStreetMap',aerial:'Letecká – ČÚZK',satellite:'Satelitní – Sentinel-2 (2021)',terrain:'Terénní – DMR 5G'};
export function createBaseLayer(kind:BaseMap):L.TileLayer{
 const options={maxZoom:20,updateWhenIdle:true,keepBuffer:1};
 if(kind==='aerial')return L.tileLayer('https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}',{...options,maxNativeZoom:19,attribution:'© <a href="https://ags.cuzk.gov.cz/opendata/">ČÚZK Ortofoto ČR</a>, CC BY 4.0'});
 if(kind==='satellite')return L.tileLayer.wms('https://titiler.terrascope.be/wms?TIME=2021-01-01',{...options,layers:'esa-worldcover-s2rgbnir-10m-2021-v2_tcc',format:'image/png',version:'1.3.0',maxNativeZoom:14,attribution:'© <a href="https://esa-worldcover.org/en/data-access">ESA WorldCover project 2021</a> / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium · CC BY 4.0 · Terrascope'});
 if(kind==='terrain')return L.tileLayer.wms('https://ags.cuzk.gov.cz/arcgis2/services/dmr5g/ImageServer/WMSServer',{...options,layers:'dmr5g:GrayscaleHillshade',styles:'default',format:'image/png',version:'1.1.1',attribution:'© <a href="https://ags.cuzk.gov.cz/opendata/">ČÚZK DMR 5G</a>, CC BY 4.0'});
 return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{...options,maxNativeZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, ODbL'});
}
export function createCadastralLayer(){return L.tileLayer.wms('https://services.cuzk.gov.cz/wms/local-km-wms.asp',{layers:'KN',format:'image/png',transparent:true,version:'1.1.1',minZoom:14,maxZoom:20,updateWhenIdle:true,keepBuffer:1,attribution:'© <a href="https://services.cuzk.gov.cz/">ČÚZK – katastrální mapa</a>'});}
