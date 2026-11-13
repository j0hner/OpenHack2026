import { mkdir, writeFile } from 'node:fs/promises';

// Read-only, bounded GET probes. HTTP headers are evidence for the exact route,
// not an end-to-end browser test or a guarantee about other routes.
const origin = 'https://sady-demo.github.io';
const dataRoutes = process.argv.includes('--data');
const verifyRoutes = process.argv.includes('--verify');
const targets = verifyRoutes ? [
  ['ruian-bpej-area', 'https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/28/query?where=1%3D1&geometry=-600000%2C-1200000%2C-599000%2C-1199000&geometryType=esriGeometryEnvelope&inSR=5514&spatialRel=esriSpatialRelIntersects&outFields=*&outSR=4326&f=geojson&resultRecordCount=1'],
  ['lpis-dpb-area', 'https://mze.gov.cz/public/app/wms/plpis_wfs.fcgi?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=LPIS_DPB_UCINNE&SRSNAME=EPSG:5514&BBOX=-601000,-1201000,-598000,-1198000&MAXFEATURES=1'],
  ['dmr5g-identify-spatialref', 'https://ags.cuzk.gov.cz/arcgis2/rest/services/dmr5g/ImageServer/identify?geometry=%7B%22x%22%3A16.6%2C%22y%22%3A48.9%2C%22spatialReference%22%3A%7B%22wkid%22%3A4326%7D%7D&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false&f=json'],
  ['vuv-q100-query', 'https://ags2.vuv.cz/arcgis/rest/services/isvs_voda/isvs_voda/MapServer/13/query?where=1%3D1&geometry=16.6%2C48.9&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json'],
  ['aopk-geojson', 'https://gis.nature.cz/arcgis/rest/services/Aplikace/Opendata/MapServer/0/query?where=1%3D1&geometry=16.5%2C48.8%2C16.6%2C48.9&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&outSR=4326&f=geojson&resultRecordCount=1'],
  ['overpass-roads', 'https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A10%5D%3Bway%5Bhighway%5D%28around%3A50%2C48.9%2C16.6%29%3Bout%20geom%3B'],
] : dataRoutes ? [
  ['ruian-parcel-query', 'https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/5/query?where=1%3D1&geometry=16.6%2C48.9&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=id,cisloparcely,vymeraparcely,druhpozemkukod,katastralniuzemi&outSR=4326&f=geojson'],
  ['ruian-bpej-query', 'https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/28/query?where=1%3D1&geometry=16.6%2C48.9&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&outSR=4326&f=geojson'],
  ['lpis-dpb-feature', 'https://mze.gov.cz/public/app/wms/plpis_wfs.fcgi?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=LPIS_DPB_UCINNE&SRSNAME=EPSG:5514&BBOX=-600000,-1200000,-599900,-1199900&MAXFEATURES=1'],
  ['lpis-bpej-feature', 'https://mze.gov.cz/public/app/wms/plpis_wfs.fcgi?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=BPEJ_WFS&SRSNAME=EPSG:5514&BBOX=-600000,-1200000,-599900,-1199900&MAXFEATURES=1'],
  ['chmi-station-metadata', 'https://opendata.chmi.cz/meteorology/climate/historical/metadata/meta1.json'],
  ['chmi-station-daily', 'https://opendata.chmi.cz/meteorology/climate/historical/data/daily/dly-0-20000-0-11406.json'],
  ['csu-fruit-data', 'https://data.csu.gov.cz/opendata/sady/ZEM03D/distribuce/json'],
  ['agrifood-price-data', 'https://api.tech.ec.europa.eu/agrifood/api/fruitAndVegetable/pricesSupplyChain?memberStateCodes=CZ&years=2025&beginDate=01%2F01%2F2025&endDate=08%2F01%2F2025'],
  ['vuv-wfs-capabilities', 'https://ags2.vuv.cz/arcgis/services/isvs_voda/isvs_voda/MapServer/WFSServer?SERVICE=WFS&REQUEST=GetCapabilities'],
  ['vuv-rest-metadata', 'https://ags2.vuv.cz/arcgis/rest/services/isvs_voda/isvs_voda/MapServer?f=json'],
] : [
  ['cuzk-cp-capabilities', 'https://services.cuzk.gov.cz/wfs/inspire-cp-wfs.asp?SERVICE=WFS&REQUEST=GetCapabilities'],
  ['cuzk-cp-feature', 'https://services.cuzk.gov.cz/wfs/inspire-cp-wfs.asp?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=CadastralParcel&SRSNAME=EPSG:5514&BBOX=-757125,-990823,-756712,-990556&COUNT=1'],
  ['lpis-capabilities', 'https://mze.gov.cz/public/app/wms/plpis_wfs.fcgi?SERVICE=WFS&REQUEST=GetCapabilities'],
  ['aopk-query', 'https://gis.nature.cz/arcgis/rest/services/Aplikace/Opendata/MapServer/0/query?where=1%3D1&geometry=16.5%2C48.8%2C16.6%2C48.9&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&returnCountOnly=true&f=json'],
  ['dmr5g-identify', 'https://ags.cuzk.gov.cz/arcgis2/rest/services/dmr5g/ImageServer/identify?geometry=16.6%2C48.9&geometryType=esriGeometryPoint&sr=4326&returnGeometry=false&returnCatalogItems=false&f=json'],
  ['chmi-metadata-index', 'https://opendata.chmi.cz/meteorology/climate/historical/metadata/'],
  ['chmi-daily-index', 'https://opendata.chmi.cz/meteorology/climate/historical/data/daily/'],
  ['openmeteo-archive', 'https://archive-api.open-meteo.com/v1/archive?latitude=48.9&longitude=16.6&start_date=2025-04-01&end_date=2025-04-02&daily=temperature_2m_min,precipitation_sum&models=era5_land&timezone=Europe%2FPrague'],
  ['csu-fruit', 'https://data.csu.gov.cz/opendata/sady/ZEM03D'],
  ['eurostat-crop-prices', 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/apri_ap_crpouta?lang=EN&geo=CZ&time=2024'],
  ['cdse-stac-collections', 'https://stac.dataspace.copernicus.eu/v1/collections'],
  ['soilgrids-query', 'https://rest.isric.org/soilgrids/v2.0/properties/query?lon=16.6&lat=48.9&property=phh2o&depth=0-5cm&value=mean'],
  ['agrifood-openapi', 'https://api.tech.ec.europa.eu/agrifood/v3/api-docs/fruit_and_vegetables'],
  ['spu-services', 'https://geoportal.spucr.cz/web/cz/mapove-sluzby'],
];
const directory = new URL('./cors-evidence/', import.meta.url);
await mkdir(directory, { recursive: true });
const results = await Promise.all(targets.map(async ([name, url]) => {
  const started = Date.now();
  try {
    const response = await fetch(url, { headers: { Origin: origin }, signal: AbortSignal.timeout(25000) });
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    let truncated = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
      bytes += value.length;
      if (bytes > 2 * 1024 * 1024) { truncated = true; await reader.cancel(); break; }
    }
    const body = Buffer.concat(chunks).toString('utf8');
    await writeFile(new URL(`${name}.txt`, directory), body);
    return { name, url, finalUrl: response.url, status: response.status,
      accessControlAllowOrigin: response.headers.get('access-control-allow-origin'),
      accessControlAllowCredentials: response.headers.get('access-control-allow-credentials'),
      contentType: response.headers.get('content-type'), bytes, truncated,
      elapsedMs: Date.now() - started, bodyPreview: body.slice(0, 220) };
  } catch (error) {
    return { name, url, error: String(error), cause: String(error.cause ?? ''), elapsedMs: Date.now() - started };
  }
}));
await writeFile(new URL(verifyRoutes ? './cors-verify-results.json' : dataRoutes ? './cors-data-results.json' : './cors-results.json', import.meta.url), JSON.stringify({ origin, checkedAt: new Date().toISOString(), method: 'GET with Origin; not a browser test', results }, null, 2));
console.log(JSON.stringify(results.map(({ bodyPreview, ...summary }) => summary), null, 2));
