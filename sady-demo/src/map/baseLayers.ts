import L from 'leaflet';
import { CZECH_BOUNDS } from './countryMask';
export type BaseMap='osm'|'aerial';
export const BASE_MAPS:Record<BaseMap,string>={osm:'OpenStreetMap',aerial:'Letecká – ČÚZK'};
export function createBaseLayer(kind:BaseMap):L.TileLayer{
 const options={maxZoom:20,updateWhenIdle:true,keepBuffer:1,noWrap:true,bounds:CZECH_BOUNDS};
 if(kind==='aerial')return L.tileLayer('https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}',{...options,maxNativeZoom:19,attribution:'© <a href="https://ags.cuzk.gov.cz/opendata/">ČÚZK Ortofoto ČR</a>, CC BY 4.0'});
 return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{...options,maxNativeZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, ODbL'});
}
/** Same four open AOPK datasets used by the analysis. WMS layer names differ
 * from REST IDs: VZCHÚ 0→26, MZCHÚ 2→22, EVL 6→14, birds 7→13.
 * Mapping verified against official GetCapabilities on 2026-11-14. */
export function createProtectedLayer(){
 return L.tileLayer.wms('https://gis.nature.cz/arcgis/services/Aplikace/Opendata/MapServer/WMSServer',{
  layers:'26,22,14,13',format:'image/png',transparent:true,version:'1.1.1',
  pane:'natureProtection',opacity:.42,noWrap:true,bounds:CZECH_BOUNDS,
  maxZoom:20,updateWhenIdle:true,keepBuffer:1,
  attribution:'© <a href="https://gis.nature.cz/arcgis/rest/services/Aplikace/Opendata/MapServer">AOPK ČR</a>, CC BY 4.0',
 });
}
