import L from 'leaflet';
import czechia from '../data/geo/czechia.json';

export const CZECH_BOUNDS: L.LatLngTuple[] = [[48.5,12],[51.1,18.9]];

/** An inverse polygon hides neighbouring countries for every map background.
 * The hole uses the same factual Natural Earth geometry as the country outline. */
export function createCountryMask(): L.GeoJSON {
  return L.geoJSON({
    type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[
      [[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]],
      czechia.geometry.coordinates[0],
    ]},
  } as GeoJSON.Feature<GeoJSON.Polygon>,{
    pane:'countryMask',interactive:false,
    style:{stroke:false,fillColor:'var(--map-outside-color, #eef2e9)',fillOpacity:1,fillRule:'evenodd'},
  });
}
