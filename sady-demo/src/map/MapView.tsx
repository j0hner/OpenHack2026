import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import czechiaGeo from '../data/geo/czechia.json';
import krajeGeo from '../data/geo/kraje.json';
import { MAP_LAYERS } from '../data/layers';
import type { AnalysisArea, PolygonGeometry, SuitabilityResult } from '../lib/types';

interface FocusTarget {
  center?: [number, number];
  zoom?: number;
  bbox?: [number, number, number, number];
  nonce: number;
}

interface MapViewProps {
  areas: AnalysisArea[];
  scores: Record<string, SuitabilityResult | undefined>;
  selectedIds: string[];
  activeId: string | null;
  layers: Record<string, boolean>;
  showKraje: boolean;
  selectedKraj: string;
  focus: FocusTarget | null;
  drawMode: boolean;
  drawPoints: [number, number][];
  customGeometry: PolygonGeometry | null;
  searchMarker: { lat: number; lon: number; label: string } | null;
  scopeLabel: string;
  mode: 'demo' | 'custom';
  onAreaClick: (id: string) => void;
  onMapClick: (lonLat: [number, number]) => void;
  onVertexMove: (index: number, lonLat: [number, number]) => void;
  onKrajClick: (name: string) => void;
  onHome: () => void;
  onStartDraw: () => void;
  onFinishDraw: () => void;
  onCancelDraw: () => void;
  onClearSelection: () => void;
}

const VERDICT_COLORS: Record<string, string> = {
  good: '#2f7d4f',
  caution: '#c9a227',
  risk: '#b8432f',
  nodata: '#8a8f98',
};

const CZ_BOUNDS: L.LatLngBoundsExpression = [
  [48.5, 12.0],
  [51.1, 18.9],
];

const toLatLng = (point: number[]): [number, number] => [point[1], point[0]];

export default function MapView(props: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const areasGroupRef = useRef<L.LayerGroup | null>(null);
  const overlayGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  const krajeGroupRef = useRef<L.LayerGroup | null>(null);
  const countryRef = useRef<L.GeoJSON | null>(null);
  const drawingGroupRef = useRef<L.LayerGroup | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const callbacksRef = useRef(props);
  callbacksRef.current = props;

  const [tilesOk, setTilesOk] = useState(true);
  const [ready, setReady] = useState(false);

  /* ---------- inicializace mapy ---------- */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [49.83, 15.35],
      zoom: 7,
      minZoom: 6,
      maxZoom: 18,
      zoomControl: false,
      preferCanvas: false,
    });
    mapRef.current = map;

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 140 }).addTo(map);

    let tileErrors = 0;
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">přispěvatelé OpenStreetMap</a>',
      crossOrigin: true,
    });
    tiles.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors >= 4) setTilesOk(false);
    });
    tiles.on('load', () => {
      tileErrors = 0;
      setTilesOk(true);
    });
    tiles.addTo(map);

    const country = L.geoJSON(czechiaGeo as unknown as GeoJSON.GeoJsonObject, {
      style: { color: '#9fb6a3', weight: 1.2, fillColor: '#eef2ea', fillOpacity: 0.55 },
      interactive: false,
    }).addTo(map);
    countryRef.current = country;

    krajeGroupRef.current = L.layerGroup().addTo(map);
    if (country.getBounds().isValid()) {
      map.fitBounds(country.getBounds(), { padding: [10, 10] });
    }

    areasGroupRef.current = L.layerGroup().addTo(map);
    drawingGroupRef.current = L.layerGroup().addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      callbacksRef.current.onMapClick([event.latlng.lng, event.latlng.lat]);
    });

    setReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* ---------- podklad / offline stav ---------- */
  useEffect(() => {
    countryRef.current?.setStyle({
      fillOpacity: tilesOk ? 0.5 : 0.9,
      color: tilesOk ? '#9fb6a3' : '#8aa38f',
      weight: tilesOk ? 1.1 : 1.4,
    });
  }, [tilesOk]);

  /* ---------- kraje ---------- */
  useEffect(() => {
    const map = mapRef.current;
    const group = krajeGroupRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (!props.showKraje) return;

    const layer = L.geoJSON(krajeGeo as unknown as GeoJSON.GeoJsonObject, {
      style: (feature) => {
        const selected = feature?.properties?.name === props.selectedKraj;
        return {
          color: selected ? '#1b5e3d' : '#7d9b84',
          weight: selected ? 2.4 : 1,
          fillColor: selected ? '#cfe3d4' : '#ffffff',
          fillOpacity: selected ? 0.16 : 0.04,
          dashArray: selected ? undefined : '3 3',
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const name = String(feature.properties?.name ?? '');
        featureLayer.on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          callbacksRef.current.onKrajClick(name);
        });
        featureLayer.bindTooltip(name, { sticky: true, direction: 'top' });
      },
      interactive: !props.drawMode,
    });
    group.addLayer(layer);
  }, [props.showKraje, props.selectedKraj, props.drawMode]);

  /* ---------- ukázkové plochy a skóre ---------- */
  useEffect(() => {
    const group = areasGroupRef.current;
    if (!group) return;
    group.clearLayers();

    for (const area of props.areas) {
      const result = props.scores[area.id];
      const verdictClass = props.layers.suitability ? (result?.verdictClass ?? 'nodata') : 'neutral';
      const color = props.layers.suitability ? VERDICT_COLORS[verdictClass] ?? '#5b7a66' : '#3c6c50';
      const selected = props.selectedIds.includes(area.id);
      const active = props.activeId === area.id;
      const latlngs = area.geometry.coordinates[0].map(toLatLng);

      const polygon = L.polygon(latlngs, {
        color: selected ? '#14492f' : color,
        weight: active ? 4 : selected ? 3 : 1.8,
        fillColor: color,
        fillOpacity: selected ? 0.45 : 0.3,
        dashArray: area.kind === 'custom' ? '7 5' : undefined,
        interactive: !props.drawMode,
      });

      polygon.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        callbacksRef.current.onAreaClick(area.id);
      });

      const scoreText = result?.overall != null ? `${result.overall}/100` : 'Nedostatek dat';
      polygon.bindTooltip(
        `<strong>${area.tag ? `${area.tag} · ` : ''}${area.name}</strong><br/>${result?.verdict ?? 'Bez vyhodnocení'}${
          result?.overall != null ? ` · ${scoreText}` : ''
        }`,
        { sticky: true, direction: 'top', className: 'sady-tooltip' },
      );

      group.addLayer(polygon);

      const label = L.marker(latlngs[0], {
        interactive: false,
        icon: L.divIcon({
          className: 'area-label-wrap',
          html: `<span class="map-tag${area.kind === 'custom' ? ' custom' : ''}">${
            area.tag ? area.tag : 'Vlastní plocha'
          }</span>`,
          iconSize: [18, 16],
          iconAnchor: [-2, 2],
        }),
      });
      group.addLayer(label);
    }
  }, [props.areas, props.scores, props.selectedIds, props.activeId, props.layers.suitability, props.drawMode]);

  /* ---------- tematické vrstvy ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const definition of MAP_LAYERS) {
      if (definition.id === 'suitability') continue;
      let group = overlayGroupsRef.current[definition.id];
      if (group && map.hasLayer(group)) map.removeLayer(group);
      if (!props.layers[definition.id]) continue;

      if (!group) {
        group = L.layerGroup();
        overlayGroupsRef.current[definition.id] = group;
      }

      group.clearLayers();
      const geoLayer = L.geoJSON(
        { type: 'FeatureCollection', features: definition.features } as unknown as GeoJSON.GeoJsonObject,
        {
          style: (feature) => {
            const color = String(feature?.properties?.color ?? '#7f8f7a');
            const isLine = feature?.geometry?.type === 'LineString';
            return isLine
              ? { color, weight: 2.4, opacity: 0.9, dashArray: '6 4' }
              : { color, weight: 1.1, opacity: 0.7, fillColor: color, fillOpacity: 0.28 };
          },
          onEachFeature: (feature, layer) => {
            const label = String(feature.properties?.label ?? definition.name);
            const detail = String(feature.properties?.detail ?? '');
            layer.bindTooltip(`<strong>${label}</strong>${detail ? `<br/>${detail}` : ''}`, {
              sticky: true,
              direction: 'top',
              className: 'sady-tooltip',
            });
          },
          interactive: !props.drawMode,
        },
      );
      group.addLayer(geoLayer);
      group.addTo(map);
    }
  }, [props.layers, props.drawMode]);

  /* ---------- kreslení a vlastní plocha ---------- */
  useEffect(() => {
    const group = drawingGroupRef.current;
    const map = mapRef.current;
    if (!group || !map) return;
    group.clearLayers();

    const points = props.drawPoints;

    if (props.customGeometry && props.customGeometry.coordinates[0]) {
      const latlngs = props.customGeometry.coordinates[0].map(toLatLng);
      const polygon = L.polygon(latlngs, {
        color: '#a8611f',
        weight: 2.4,
        dashArray: '7 5',
        fillColor: '#d79a55',
        fillOpacity: 0.22,
      });
      polygon.bindTooltip('Vlastní plocha', { sticky: true, className: 'sady-tooltip' });
      group.addLayer(polygon);
    }

    if (points.length > 0) {
      const latlngs = points.map(toLatLng);
      if (latlngs.length > 1) {
        group.addLayer(
          L.polyline(latlngs, { color: '#a8611f', weight: 2, dashArray: '5 4', interactive: false }),
        );
      }
      if (latlngs.length > 2) {
        group.addLayer(
          L.polygon(latlngs, { color: '#a8611f', weight: 1, fillColor: '#d79a55', fillOpacity: 0.15, interactive: false }),
        );
      }
      points.forEach((point, index) => {
        const marker = L.marker(toLatLng(point), {
          draggable: true,
          icon: L.divIcon({ className: 'vertex-wrap', html: '<span class="vertex"></span>', iconSize: [12, 12] }),
        });
        marker.on('dragend', () => {
          const position = marker.getLatLng();
          callbacksRef.current.onVertexMove(index, [position.lng, position.lat]);
        });
        group.addLayer(marker);
      });
    }
  }, [props.drawPoints, props.customGeometry]);

  /* ---------- režim kreslení ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const container = map.getContainer();
    container.style.cursor = props.drawMode ? 'crosshair' : '';
    if (props.drawMode) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [props.drawMode]);

  /* ---------- přiblížení na cíl ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.focus) return;
    const { bbox, center, zoom } = props.focus;
    if (bbox) {
      map.flyToBounds(
        [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]],
        ],
        { padding: [24, 24], duration: 0.7, maxZoom: 14 },
      );
    } else if (center) {
      map.flyTo([center[1], center[0]], zoom ?? 13, { duration: 0.7 });
    }
  }, [props.focus]);

  /* ---------- hledaná lokalita ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (searchMarkerRef.current) {
      map.removeLayer(searchMarkerRef.current);
      searchMarkerRef.current = null;
    }
    if (props.searchMarker) {
      const marker = L.marker([props.searchMarker.lat, props.searchMarker.lon], {
        icon: L.divIcon({ className: 'search-pin-wrap', html: '<span class="search-pin"></span>', iconSize: [22, 22] }),
      });
      marker.bindTooltip(props.searchMarker.label, { direction: 'top', className: 'sady-tooltip' });
      marker.addTo(map);
      searchMarkerRef.current = marker;
    }
  }, [props.searchMarker]);

  /* ---------- návrat na celou ČR ---------- */
  const handleHome = () => {
    props.onHome();
    mapRef.current?.flyToBounds(CZ_BOUNDS, { padding: [10, 10], duration: 0.6 });
  };

  return (
    <div className="map-shell">
      <div ref={containerRef} id="map" aria-label="Interaktivní mapa České republiky" />

      {!ready && (
        <div className="map-loading">
          <div className="spinner" />
          Načítám mapu…
        </div>
      )}

      {!tilesOk && (
        <div className="map-banner">
          <div className="notice warn">
            <strong>Mapový podklad se nenačetl.</strong> Zobrazujeme lokální hranici ČR, ukázkové plochy a vrstvy.
            Analýzy fungují bez internetu; dlaždice se zkoušejí znovu při pohybu mapy.
          </div>
        </div>
      )}

      <div className="map-overlay map-top">
        <div className="map-card">
          <strong>{props.scopeLabel}</strong>
          <div>
            {props.mode === 'demo'
              ? 'Vyhodnoceno je 5 ukázkových ploch. Zbytek ČR je bez analytických dat – nejde o mapu vhodnosti celé republiky.'
              : 'Režim vlastního pozemku: data se doplňují z veřejných zdrojů, dostupnost je vždy viditelná.'}
          </div>
        </div>
        <div className="map-actions">
          <button className="btn" type="button" onClick={handleHome} title="Návrat na pohled celé České republiky">
            ⌂ Celá ČR
          </button>
          {!props.drawMode ? (
            <button className="btn" type="button" onClick={props.onStartDraw}>
              ✎ Kreslit plochu
            </button>
          ) : (
            <>
              <button className="btn primary" type="button" onClick={props.onFinishDraw} disabled={props.drawPoints.length < 3}>
                Dokončit ({props.drawPoints.length})
              </button>
              <button className="btn" type="button" onClick={props.onCancelDraw}>
                Zrušit kresbu
              </button>
            </>
          )}
          {props.selectedIds.length > 0 && (
            <button className="btn" type="button" onClick={props.onClearSelection}>
              Zrušit výběr
            </button>
          )}
        </div>
      </div>

      {props.drawMode && (
        <div className="map-overlay" style={{ top: 118, left: 12 }}>
          <div className="map-card">
            Klikáním přidávejte vrcholy vlastní plochy. Vrcholy lze po dokončení přetáhnout. Minimum jsou 3 vrcholy.
          </div>
        </div>
      )}

      <div className="map-overlay map-bottom">
        <div className="map-card map-legend">
          <div className="map-legend-title">Vhodnost pro zvolený druh</div>
          <div className="legend">
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: VERDICT_COLORS.good }} /> vhodný
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: VERDICT_COLORS.caution }} /> s opatřeními
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: VERDICT_COLORS.risk }} /> rizikový
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: VERDICT_COLORS.nodata }} /> nedostatek dat
            </span>
          </div>
          <div className="tiny muted" style={{ marginTop: 4 }}>
            Výstup demo modelu, nikoli pravděpodobnost úspěchu.
          </div>
        </div>
        <div className="availability-pill">
          <span className="dot" style={{ background: tilesOk ? '#2a7a52' : '#a8432f' }} />
          {tilesOk ? 'Mapový podklad online' : 'Lokální režim bez dlaždic'}
        </div>
      </div>
    </div>
  );
}
