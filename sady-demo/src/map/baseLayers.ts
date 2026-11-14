import L from 'leaflet';
import { CZECH_BOUNDS } from './countryMask';
export type BaseMap='osm'|'aerial';
export const BASE_MAPS:Record<BaseMap,string>={osm:'OpenStreetMap',aerial:'Letecká – ČÚZK'};
export function createBaseLayer(kind:BaseMap):L.TileLayer{
 const options={maxZoom:20,updateWhenIdle:true,keepBuffer:1,noWrap:true,bounds:CZECH_BOUNDS};
 if(kind==='aerial')return L.tileLayer('https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}',{...options,maxNativeZoom:19,attribution:'© <a href="https://ags.cuzk.gov.cz/opendata/">ČÚZK Ortofoto ČR</a>, CC BY 4.0'});
 return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{...options,maxNativeZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, ODbL'});
}
