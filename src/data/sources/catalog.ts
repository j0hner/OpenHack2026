export interface DataSource {
  id: string;
  name: string;
  category: 'parcels' | 'soil' | 'climate' | 'terrain' | 'constraints' | 'economics' | 'imagery' | 'access';
  endpoint: string;
  format: 'geojson' | 'json' | 'gml' | 'json-stat' | 'stac' | 'unknown';
  access: 'browser-candidate' | 'file-import' | 'investigate';
  implementation: 'available' | 'planned';
  priority: 1 | 2 | 3;
  evidence: string;
  notes: string;
}

/** CORS evidence is route-specific server probing on 2026-11-13, not browser certification.
 * Availability does not establish licensing; retain and review each provider's attribution. */
export const DATA_SOURCES = [
  { id: 'ruian-parcels', name: 'ČÚZK RÚIAN parcels', category: 'parcels',
    endpoint: 'https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/5/query',
    format: 'geojson', access: 'browser-candidate', implementation: 'planned', priority: 1,
    evidence: 'research/cors-data-results.json#ruian-parcel-query',
    notes: 'Request outSR=4326; use idProperty=id. Fetch bounded areas with explicit paging. Never infer ownership from cadastral geometry.' },
  { id: 'ruian-bpej', name: 'ČÚZK RÚIAN BPEJ', category: 'soil',
    endpoint: 'https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/28/query',
    format: 'geojson', access: 'browser-candidate', implementation: 'planned', priority: 1,
    evidence: 'research/cors-verify-results.json#ruian-bpej-area',
    notes: 'Area query returned geometry; point query was empty. Request outSR=4326 and map BPEJ codes before deriving suitability.' },
  { id: 'open-meteo-archive', name: 'Open-Meteo historical climate', category: 'climate',
    endpoint: 'https://archive-api.open-meteo.com/v1/archive',
    format: 'json', access: 'browser-candidate', implementation: 'available', priority: 1,
    evidence: 'research/cors-results.json#openmeteo-archive',
    notes: 'ERA5-Land reanalysis, Europe/Prague daily dates, °C and mm. Missing precipitation remains null; grid data is not an orchard sensor. Free API is limited to noncommercial use; review terms before deployment.' },
  { id: 'cuzk-dmr5g', name: 'ČÚZK DMR 5G elevation', category: 'terrain',
    endpoint: 'https://ags.cuzk.gov.cz/arcgis2/rest/services/dmr5g/ImageServer/identify',
    format: 'json', access: 'browser-candidate', implementation: 'planned', priority: 1,
    evidence: 'research/cors-verify-results.json#dmr5g-identify-spatialref',
    notes: 'Put spatialReference.wkid=4326 inside geometry JSON. A bare sr parameter returned NoData in the probe. Slope/aspect need multiple samples, not one elevation.' },
  { id: 'vuv-q100', name: 'VÚV Q100 flood areas', category: 'constraints',
    endpoint: 'https://ags2.vuv.cz/arcgis/rest/services/isvs_voda/isvs_voda/MapServer/13/query',
    format: 'json', access: 'browser-candidate', implementation: 'planned', priority: 1,
    evidence: 'research/cors-verify-results.json#vuv-q100-query; research/cors-evidence/vuv-rest-metadata.txt',
    notes: 'Layer 13 is ZaplavUzemi_Q100 in saved metadata. Validate layer IDs at integration time. Empty spatial responses do not prove a parcel is flood-free.' },
  { id: 'lpis-dpb', name: 'MZe LPIS agricultural blocks', category: 'parcels',
    endpoint: 'https://mze.gov.cz/public/app/wms/plpis_wfs.fcgi',
    format: 'gml', access: 'browser-candidate', implementation: 'planned', priority: 2,
    evidence: 'research/cors-verify-results.json#lpis-dpb-area',
    notes: 'LPIS_DPB_UCINNE is an agricultural block, not a cadastral parcel. Parse GML and transform EPSG:5514 to EPSG:4326; do not label projected coordinates as GeoJSON.' },
  { id: 'cuzk-inspire-parcels', name: 'ČÚZK INSPIRE cadastral parcels', category: 'parcels',
    endpoint: 'https://services.cuzk.gov.cz/wfs/inspire-cp-wfs.asp',
    format: 'gml', access: 'browser-candidate', implementation: 'planned', priority: 2,
    evidence: 'research/cors-results.json#cuzk-cp-feature',
    notes: 'Alternative to RÚIAN. Needs GML parser, CRS handling and WFS paging before normalizing into features.' },
  { id: 'csu-fruit', name: 'ČSÚ ZEM03D fruit statistics', category: 'economics',
    endpoint: 'https://data.csu.gov.cz/opendata/sady/ZEM03D/distribuce/json',
    format: 'json', access: 'browser-candidate', implementation: 'planned', priority: 2,
    evidence: 'research/cors-data-results.json#csu-fruit-data',
    notes: 'Regional/national statistics need a separate dimensional table, units and period keys. Do not attach aggregates as measured parcel yields.' },
  { id: 'eurostat-crop-prices', name: 'Eurostat crop output prices', category: 'economics',
    endpoint: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/apri_ap_crpouta',
    format: 'json-stat', access: 'browser-candidate', implementation: 'planned', priority: 2,
    evidence: 'research/cors-results.json#eurostat-crop-prices',
    notes: 'Decode JSON-stat dimensions and sparse values; keep product, unit, geography, period, currency and status flags.' },
  { id: 'chmi-stations', name: 'ČHMÚ historical station data', category: 'climate',
    endpoint: 'https://opendata.chmi.cz/meteorology/climate/historical/',
    format: 'json', access: 'file-import', implementation: 'planned', priority: 2,
    evidence: 'research/cors-data-results.json#chmi-station-daily',
    notes: 'Sample JSON routes lacked CORS headers. Prefer user-selected files or bounded preprocessed same-origin bundles; keep station ID and quality flags. Never use no-cors.' },
  { id: 'osm-access', name: 'OpenStreetMap access roads', category: 'access',
    endpoint: 'https://overpass-api.de/api/interpreter',
    format: 'json', access: 'investigate', implementation: 'planned', priority: 3,
    evidence: 'research/cors-verify-results.json#overpass-roads',
    notes: 'Sample returned HTTP 406. Verify endpoint policy and browser requests before enabling; a road nearby does not imply legal access.' },
  { id: 'soilgrids', name: 'ISRIC SoilGrids', category: 'soil',
    endpoint: 'https://rest.isric.org/soilgrids/v2.0/properties/query',
    format: 'json', access: 'investigate', implementation: 'planned', priority: 3,
    evidence: 'research/cors-results.json#soilgrids-query',
    notes: 'Probe timed out. Keep depth, unit conversion and uncertainty if integrating; use BPEJ first.' },
  { id: 'agrifood-prices', name: 'EU Agri-food fruit prices', category: 'economics',
    endpoint: 'https://api.tech.ec.europa.eu/agrifood/api/fruitAndVegetable/pricesSupplyChain',
    format: 'json', access: 'investigate', implementation: 'planned', priority: 3,
    evidence: 'research/cors-data-results.json#agrifood-price-data; research/cors-results.json#agrifood-openapi',
    notes: 'Documentation had an empty CORS header and the data request failed. Documentation reachability does not prove data access.' },
  { id: 'spu-soil', name: 'SPÚ soil services', category: 'soil',
    endpoint: 'https://geoportal.spucr.cz/web/cz/mapove-sluzby',
    format: 'unknown', access: 'investigate', implementation: 'planned', priority: 3,
    evidence: 'research/cors-results.json#spu-services',
    notes: 'Discovery page returned HTTP 500. Find a verified machine-readable service before writing an adapter.' },
] as const satisfies readonly DataSource[];
