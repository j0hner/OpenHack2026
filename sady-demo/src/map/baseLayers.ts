import L from 'leaflet';
export type BaseMap='osm'|'aerial';
export const BASE_MAPS:Record<BaseMap,string>={osm:'OpenStreetMap',aerial:'Letecká – ČÚZK'};
export function createBaseLayer(kind:BaseMap):L.TileLayer{
 const options={maxZoom:20,updateWhenIdle:true,keepBuffer:1};
 if(kind==='aerial')return L.tileLayer('https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}',{...options,maxNativeZoom:19,attribution:'© <a href="https://ags.cuzk.gov.cz/opendata/">ČÚZK Ortofoto ČR</a>, CC BY 4.0'});
 return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{...options,maxNativeZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, ODbL'});
}
export function createCadastralLayer(){return L.tileLayer.wms('https://services.cuzk.gov.cz/wms/local-km-wms.asp',{layers:'KN',format:'image/png',transparent:true,version:'1.1.1',minZoom:14,maxZoom:20,updateWhenIdle:true,keepBuffer:1,attribution:'© <a href="https://services.cuzk.gov.cz/">ČÚZK – katastrální mapa</a>'});}
