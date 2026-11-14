import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { IconStack2, IconX } from "@tabler/icons-react";
import { BASE_MAPS, createBaseLayer, type BaseMap } from "./baseLayers";
import {
  geometryBounds,
  locationIndex,
  loadLocation,
  type ParcelFeature,
} from "../lib/openData";
import { geometryKey, representativePoint } from "../lib/regionalData";
import { areaHa } from "../lib/geo";
import {
  officialParcelNumber,
  showOfficialParcelNumber,
} from "../lib/parcelCategories";
import czechiaGeo from "../data/geo/czechia.json";
import CzechiaOutlineIcon from "./CzechiaOutlineIcon";
import { CZECH_BOUNDS, createCountryMask } from "./countryMask";
import "./map-filters.css";
import "./parcel-hover.css";
import "./parcel-focus.css";
import "./planting-map.css";
import { MAP_LAYERS } from "../data/layers";
import ParcelPreview from "../components/ParcelPreview";
import { parcelEligibility } from "../lib/parcelEligibility";
import { useParcelCoverage } from "../lib/useParcelCoverage";
import {
  COVERAGE_STYLES,
  coverageFromArea,
  type ParcelCoverage,
} from "../lib/parcelCoverage";
import type { CoverageBounds } from "../lib/coverageData";
import { coverageBoundsKey, hasMapPixelSizeChanged } from "../lib/mapViewport";
import type { PlantingLayout } from "../lib/plantingGeometry";
import DataCoverageLegend from "../components/DataCoverageLegend";
import type {
  AnalysisArea,
  AreaGeometry,
  FruitKey,
  SuitabilityResult,
} from "../lib/types";

interface FocusTarget {
  center?: [number, number];
  zoom?: number;
  bbox?: [number, number, number, number];
  nonce: number;
}
interface MapViewProps {
  plantingLayout?: PlantingLayout | null;
  plantingFruit?: FruitKey;
  areas: AnalysisArea[];
  scores: Record<string, SuitabilityResult | undefined>;
  selectedIds: string[];
  activeId: string | null;
  layers: Record<string, boolean>;
  focus: FocusTarget | null;
  detailOpen: boolean;
  splitMode: boolean;
  splitPoints: [number, number][];
  splitPreview: AreaGeometry[] | null;
  searchMarker: { lat: number; lon: number; label: string } | null;
  onAreaClick: (id: string) => void;
  onParcelSelect: (feature: ParcelFeature) => void;
  onSplitPoint: (point: [number, number]) => void;
  onSplitPointMove: (index: number, point: [number, number]) => void;
  onCancelSplit: () => void;
  onHome: () => void;
  onToggleLayer?: (id: string) => void;
}
const CZ_BOUNDS = CZECH_BOUNDS;
const PLANTING_COLORS: Record<FruitKey, string> = {
  apple: "#2c873c",
  pear: "#bd951b",
  plum: "#8251bd",
  cherry: "#bd383b",
  apricot: "#d77b22",
};
const toLatLng = (p: number[]): [number, number] => [p[1], p[0]];
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const fmtHa = (geometry: AreaGeometry) =>
  areaHa(geometry).toLocaleString("cs-CZ", { maximumFractionDigits: 2 }) +
  " ha";
const tooltipArea = (geometry: AreaGeometry) => {
  const squareMetres = Math.round(areaHa(geometry) * 10_000);
  return squareMetres < 1_000
    ? `${squareMetres.toLocaleString("cs-CZ")} m²`
    : fmtHa(geometry);
};
const tooltipCoverage = (coverage: ParcelCoverage) =>
  `${COVERAGE_STYLES[coverage.state].label}${coverage.availableCategories === null ? "" : ` · ${coverage.availableCategories}/3`}`;
const parcelTooltip = (title: string, meta: string, status: string) => {
  const name = title.trim().replace(/\s+/g, " ");
  const shortName = name.length > 64 ? name.slice(0, 61) + "…" : name;
  return `<div class="parcel-tooltip-content"><strong>${escapeHtml(shortName)}</strong><span class="parcel-tooltip-meta">${escapeHtml(meta)}</span>${status ? `<span class="parcel-tooltip-status">${escapeHtml(status)}</span>` : ""}</div>`;
};
const previewColors = ["#5fa747", "#9acb69", "#40875a", "#bad787"];

/** Tooltip focus listeners make SVG parcel paths focusable in Chromium. Give
 * them explicit button semantics and a shape-based keyboard focus indicator,
 * instead of the browser's rectangular SVG bounding-box outline. */
function parcelKeyboardTarget(
  polygon: L.GeoJSON,
  label: string,
  activate: () => void,
  pressed?: boolean,
) {
  polygon.eachLayer((layer) => {
    if (!(layer instanceof L.Path)) return;
    let boundElement: Element | undefined;
    const bind = () => {
      const element = layer.getElement();
      if (!element || element === boundElement) return;
      boundElement = element;
      element.classList.add("sady-parcel-path");
      element.setAttribute("tabindex", "0");
      element.setAttribute("role", "button");
      element.setAttribute("aria-label", label);
      element.setAttribute("aria-keyshortcuts", "Enter Space");
      if (pressed !== undefined)
        element.setAttribute("aria-pressed", String(pressed));
      element.addEventListener("keydown", (rawEvent) => {
        const event = rawEvent as KeyboardEvent;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) activate();
      });
    };
    layer.on("add", bind);
    bind();
  });
}

function fitFocus(
  map: L.Map,
  focus: FocusTarget,
  detailOpen: boolean,
  animate = true,
) {
  const mobile = window.matchMedia("(max-width: 900px)").matches;
  const stage = map.getContainer().closest(".map-stage");
  const card = (
    stage?.querySelector(".parcel-preview:not(.is-embedded)") ??
    stage?.querySelector(".floating-detail")
  )?.getBoundingClientRect();
  const cardWidth = card?.width ?? 335;
  const left =
    detailOpen && !mobile
      ? Math.min(cardWidth + 36, map.getSize().x - 140)
      : 24;
  const bottom =
    detailOpen && mobile
      ? Math.min(
          (card?.height ?? window.innerHeight * 0.55) + 18,
          map.getSize().y - 160,
        )
      : 38;
  const paddingTopLeft: L.PointExpression = [left, 64],
    paddingBottomRight: L.PointExpression = [36, bottom];
  const { bbox, center, zoom } = focus;
  if (bbox) {
    const bounds: L.LatLngBoundsExpression = [
      [bbox[1], bbox[0]],
      [bbox[3], bbox[2]],
    ];
    if (animate)
      map.flyToBounds(bounds, {
        paddingTopLeft,
        paddingBottomRight,
        duration: 0.55,
        maxZoom: 18,
      });
    else
      map.fitBounds(bounds, {
        paddingTopLeft,
        paddingBottomRight,
        maxZoom: 18,
        animate: false,
      });
  } else if (center) {
    const target = L.latLng(center[1], center[0]),
      targetZoom = zoom ?? 14;
    const offset = L.point((left - 36) / 2, (64 - bottom) / 2);
    const adjusted = map.unproject(
      map.project(target, targetZoom).subtract(offset),
      targetZoom,
    );
    if (animate) map.flyTo(adjusted, targetZoom, { duration: 0.55 });
    else map.setView(adjusted, targetZoom, { animate: false });
  }
}

export default function MapView(props: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const countryRef = useRef<L.GeoJSON | null>(null);
  const areaGroupRef = useRef<L.LayerGroup | null>(null);
  const splitGroupRef = useRef<L.LayerGroup | null>(null);
  const pendingGroupRef = useRef<L.LayerGroup | null>(null);
  const coverageGroupRef = useRef<L.LayerGroup | null>(null);
  const plantingGroupRef = useRef<L.LayerGroup | null>(null);
  const plantingRendererRef = useRef<L.Canvas | null>(null);
  const pendingParcelRef = useRef<ParcelFeature | null>(null);
  const overlayGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  const callbacksRef = useRef(props);
  callbacksRef.current = props;
  const layerButtonRef = useRef<HTMLButtonElement | null>(null);
  const [ready, setReady] = useState(false);
  const [baseMap, setBaseMap] = useState<BaseMap>("aerial");
  const [cadastre, setCadastre] = useState(true);
  const [excludeGardens, setExcludeGardens] = useState(() => {
    try {
      return localStorage.getItem("moje-sady-hide-gardens") === "true";
    } catch {
      return false;
    }
  });
  const [layersOpen, setLayersOpen] = useState(false);
  const [zoom, setZoom] = useState(7);
  const [tilesOk, setTilesOk] = useState(true);
  const [parcelStatus, setParcelStatus] = useState("");
  const [layerStatus, setLayerStatus] = useState("");
  const [pendingParcel, setPendingParcel] = useState<ParcelFeature | null>(
    null,
  );
  pendingParcelRef.current = pendingParcel;
  const [viewportBounds, setViewportBounds] = useState<CoverageBounds | null>(
    null,
  );
  const coverageEnabled = !!props.layers.coverage;
  const coverage = useParcelCoverage({
    enabled: cadastre || coverageEnabled,
    checkData: coverageEnabled,
    excludeGardens,
    bounds: viewportBounds,
    zoom,
    areas: props.areas,
  });
  const offerParcel = (feature: ParcelFeature) => {
    setLayersOpen(false);
    setParcelStatus("");
    const eligibility = parcelEligibility(feature);
    if (!eligibility.allowed || (excludeGardens && eligibility.code === "5"))
      return;
    const saved = callbacksRef.current.areas.find(
      (area) => area.cadastral?.id === String(feature.properties.id),
    );
    if (saved) {
      setPendingParcel(null);
      callbacksRef.current.onAreaClick(saved.id);
      return;
    }
    setPendingParcel(feature);
  };
  const [realLayers, setRealLayers] = useState<
    Record<string, GeoJSON.FeatureCollection>
  >({});

  useEffect(() => {
    try {
      localStorage.setItem("moje-sady-hide-gardens", String(excludeGardens));
    } catch {
      /* Filtering also works without persistent storage. */
    }
    if (
      excludeGardens &&
      pendingParcel &&
      parcelEligibility(pendingParcel).code === "5"
    )
      setPendingParcel(null);
  }, [excludeGardens, pendingParcel]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [49.83, 15.35],
      zoom: 7,
      minZoom: 6,
      maxZoom: 20,
      maxBounds: L.latLngBounds(CZ_BOUNDS).pad(0.015),
      maxBoundsViscosity: 1,
      zoomControl: false,
      preferCanvas: false,
    });
    mapRef.current = map;
    // A focused polygon and a newly hovered/repainted polygon must not leave
    // overlapping copies of the same help bubble on the screen.
    let visibleParcelTooltip: L.Tooltip | null = null;
    map.on("tooltipopen", (event: L.TooltipEvent) => {
      const tooltip = event.tooltip;
      if (!tooltip.options.className?.includes("parcel-hover-tooltip")) return;
      if (visibleParcelTooltip && visibleParcelTooltip !== tooltip)
        map.closeTooltip(visibleParcelTooltip);
      visibleParcelTooltip = tooltip;
    });
    map.on("tooltipclose", (event: L.TooltipEvent) => {
      // Leaflet keeps fading tooltips in the DOM for 200 ms. Remove a closed
      // parcel bubble immediately so it cannot overlap the replacement.
      if (event.tooltip.options.className?.includes("parcel-hover-tooltip"))
        event.tooltip.getElement()?.remove();
      if (visibleParcelTooltip === event.tooltip) visibleParcelTooltip = null;
    });
    map.createPane("analyticalOverlay");
    map.getPane("analyticalOverlay")!.style.zIndex = "350";
    map.createPane("countryMask");
    map.getPane("countryMask")!.style.zIndex = "385";
    createCountryMask().addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control
      .scale({ position: "bottomleft", imperial: false, maxWidth: 160 })
      .addTo(map);
    const country = L.geoJSON(czechiaGeo as unknown as GeoJSON.GeoJsonObject, {
      style: {
        color: "#d4e0cc",
        weight: 0.8,
        fillColor: "#e8eee4",
        fillOpacity: 0,
      },
      interactive: false,
    }).addTo(map);
    countryRef.current = country;
    areaGroupRef.current = L.layerGroup().addTo(map);
    splitGroupRef.current = L.layerGroup().addTo(map);
    map.createPane("plantingPlan");
    map.getPane("plantingPlan")!.style.zIndex = "450";
    map.getPane("plantingPlan")!.style.pointerEvents = "none";
    plantingRendererRef.current = L.canvas({
      pane: "plantingPlan",
      padding: 0.2,
    });
    plantingGroupRef.current = L.layerGroup().addTo(map);
    pendingGroupRef.current = L.layerGroup().addTo(map);
    map.createPane("dataCoverage");
    map.getPane("dataCoverage")!.style.zIndex = "390";
    coverageGroupRef.current = L.layerGroup([], {
      attribution:
        '© <a href="https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/5">ČÚZK / RÚIAN – parcely</a>, CC BY 4.0',
    }).addTo(map);
    if (country.getBounds().isValid())
      map.fitBounds(country.getBounds(), { padding: [24, 24] });
    map.on("zoomend", () => setZoom(map.getZoom()));
    const updateBounds = () => {
      const b = map.getBounds();
      const next: CoverageBounds = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      setViewportBounds(previous => coverageBoundsKey(previous) === coverageBoundsKey(next) ? previous : next);
    };
    map.on("moveend", updateBounds);
    updateBounds();
    map.on("movestart", () => {
      // Keep the last settled geometry while moving. Only an actually changed
      // settled bbox starts/replaces an automatic check; no-op fits do not retry.
      setParcelStatus("");
      setLayersOpen(false);
    });
    map.on("click", (event: L.LeafletMouseEvent) => {
      setLayersOpen(false);
      if (
        callbacksRef.current.splitMode &&
        callbacksRef.current.splitPoints.length < 2
      )
        callbacksRef.current.onSplitPoint([event.latlng.lng, event.latlng.lat]);
    });
    let observedSize = { width: containerRef.current.clientWidth, height: containerRef.current.clientHeight };
    const resize = new ResizeObserver(() => {
      const container = containerRef.current;
      if (!container) return;
      const nextSize = { width: container.clientWidth, height: container.clientHeight };
      if (!hasMapPixelSizeChanged(observedSize, nextSize)) return;
      observedSize = nextSize;
      map.invalidateSize({ pan: false });
      const current = callbacksRef.current;
      if (pendingParcelRef.current)
        fitFocus(
          map,
          { bbox: geometryBounds(pendingParcelRef.current.geometry), nonce: 0 },
          true,
          false,
        );
      else if (current.focus)
        fitFocus(map, current.focus, current.detailOpen, false);
      updateBounds();
    });
    resize.observe(containerRef.current);
    setZoom(map.getZoom());
    setReady(true);
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const group = plantingGroupRef.current,
      renderer = plantingRendererRef.current;
    if (!group || !renderer) return;
    group.clearLayers();
    const plan = props.plantingLayout;
    if (!plan || plan.status !== "ready" || props.splitMode || zoom < 14)
      return;
    for (const row of plan.rows) {
      group.addLayer(
        L.polyline(row.coordinates.map(toLatLng), {
          pane: "plantingPlan",
          renderer,
          color: "#ffdc73",
          weight: 1.5,
          opacity: 0.9,
          interactive: false,
        }),
      );
    }
    for (const point of plan.trees) {
      group.addLayer(
        L.circleMarker(toLatLng(point), {
          pane: "plantingPlan",
          renderer,
          radius: zoom >= 17 ? 3.4 : 2.4,
          color: "#fff",
          weight: 1.2,
          fillColor: PLANTING_COLORS[props.plantingFruit ?? "apple"],
          fillOpacity: 1,
          interactive: false,
        }),
      );
    }
  }, [props.plantingLayout, props.plantingFruit, props.splitMode, zoom, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let errors = 0;
    setTilesOk(true);
    const layer = createBaseLayer(baseMap);
    layer.on("tileerror", () => {
      if (++errors >= 3) setTilesOk(false);
    });
    layer.on("tileload", () => {
      errors = 0;
      setTilesOk(true);
    });
    layer.addTo(map);
    layer.bringToBack();
    return () => {
      map.removeLayer(layer);
    };
  }, [baseMap, ready]);

  useEffect(() => {
    countryRef.current?.setStyle({
      fillOpacity: tilesOk ? 0 : 0.95,
      color: tilesOk ? "#d4e0cc" : "#b7c6af",
    });
  }, [tilesOk, ready]);

  useEffect(() => {
    setPendingParcel(null);
  }, [props.activeId, props.focus?.nonce, props.splitMode]);

  useEffect(() => {
    const group = pendingGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!pendingParcel || props.splitMode) return;
    group.addLayer(
      L.geoJSON(pendingParcel as GeoJSON.GeoJsonObject, {
        style: {
          color: "#f0bd53",
          weight: 3,
          dashArray: "7 4",
          fillColor: "#e4ad3f",
          fillOpacity: 0.2,
        },
        interactive: false,
      }),
    );
    if (mapRef.current)
      fitFocus(
        mapRef.current,
        { bbox: geometryBounds(pendingParcel.geometry), nonce: Date.now() },
        true,
      );
  }, [pendingParcel, props.splitMode, ready]);

  useEffect(() => {
    if (!pendingParcel) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPendingParcel(null);
      }
    };
    window.addEventListener("keydown", close, { capture: true });
    return () =>
      window.removeEventListener("keydown", close, { capture: true });
  }, [pendingParcel]);

  useEffect(() => {
    const group = coverageGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if ((!cadastre && !coverageEnabled) || zoom < 14) return;
    const savedGeometries = new Set(
      props.areas
        .filter((area) => {
          const eligibility = parcelEligibility(area);
          return (
            (area.derivedFrom || !area.cadastral || eligibility.allowed) &&
            !(excludeGardens && eligibility.code === "5")
          );
        })
        .map((area) => geometryKey(area.geometry)),
    );
    for (const item of coverage.parcels) {
      const eligibility = parcelEligibility(item.feature);
      if (!eligibility.allowed || (excludeGardens && eligibility.code === "5"))
        continue;
      // The saved polygon already owns its tooltip and click handler. Drawing
      // the exact same discovery surface again creates a second hover target.
      if (savedGeometries.has(geometryKey(item.feature.geometry))) continue;
      const style = COVERAGE_STYLES[item.coverage.state];
      const layer = L.geoJSON(item.feature as GeoJSON.GeoJsonObject, {
        pane: "dataCoverage",
        style: {
          color: coverageEnabled ? style.color : "#e8f0e0",
          weight: 1.5,
          opacity: 0.95,
          fillColor: coverageEnabled ? style.color : "#8cb16e",
          fillOpacity: coverageEnabled ? 0.32 : 0.07,
          dashArray:
            coverageEnabled && item.coverage.state === "unknown"
              ? "4 3"
              : undefined,
        },
        interactive: !props.splitMode,
      });
      layer.bindTooltip(
        parcelTooltip(
          `Parcela ${String(item.feature.properties.cisloparcely ?? "bez čísla")}`,
          `${eligibility.landUse} · ${tooltipArea(item.feature.geometry)}`,
          coverageEnabled ? tooltipCoverage(item.coverage) : "",
        ),
        {
          sticky: true,
          direction: "top",
          offset: [0, -7],
          className: "sady-tooltip parcel-hover-tooltip",
        },
      );
      layer.on("click", (event: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(event);
        offerParcel(item.feature);
      });
      group.addLayer(layer);
      if (!props.splitMode)
        parcelKeyboardTarget(
          layer,
          `Parcela ${String(item.feature.properties.cisloparcely ?? "bez čísla")}, ${eligibility.landUse}, ${tooltipArea(item.feature.geometry)}. Otevřít náhled parcely.`,
          () => offerParcel(item.feature),
        );
    }
  }, [
    cadastre,
    coverageEnabled,
    coverage.parcels,
    props.areas,
    props.splitMode,
    excludeGardens,
    zoom,
    ready,
  ]);

  useEffect(() => {
    const group = areaGroupRef.current;
    if (!group) return;
    group.clearLayers();
    const plannedArea =
      props.plantingLayout?.status === "ready" && zoom >= 14
        ? props.areas.find((area) => area.id === props.activeId)
        : undefined;
    const plannedBox = plannedArea
      ? geometryBounds(plannedArea.geometry)
      : undefined;
    const plannedBounds = plannedBox
      ? L.latLngBounds(
          [plannedBox[1], plannedBox[0]],
          [plannedBox[3], plannedBox[2]],
        )
      : null;
    const visibleCoverage = new Map(
      coverage.parcels.map((item) => [
        geometryKey(item.feature.geometry),
        item.coverage,
      ]),
    );
    for (const area of props.areas) {
      const eligibility = parcelEligibility(area);
      if (
        (!area.derivedFrom && area.cadastral && !eligibility.allowed) ||
        (excludeGardens && eligibility.code === "5")
      )
        continue;
      const active = props.activeId === area.id,
        selected = props.selectedIds.includes(area.id);
      const savedCoverage = coverageFromArea(area);
      const checked = visibleCoverage.get(geometryKey(area.geometry));
      const availability = !coverageEnabled
        ? null
        : checked &&
            ["sufficient", "insufficient"].includes(checked.state) &&
            !["sufficient", "insufficient"].includes(savedCoverage.state)
          ? checked
          : savedCoverage;
      const coverageColor = availability
        ? COVERAGE_STYLES[availability.state].color
        : null;
      const polygon = L.geoJSON(
        {
          type: "Feature",
          properties: {},
          geometry: area.geometry,
        } as GeoJSON.GeoJsonObject,
        {
          style: {
            color: active
              ? "#87e957"
              : selected
                ? "#8bcf72"
                : (coverageColor ?? "#f4f8ef"),
            weight: active ? 3.5 : selected ? 2.5 : 1.5,
            opacity: 1,
            fillColor: coverageColor ?? (active ? "#79c943" : "#3e7c38"),
            fillOpacity: coverageEnabled
              ? 0.36
              : active
                ? 0.26
                : selected
                  ? 0.12
                  : 0.035,
            dashArray: area.derivedFrom ? "6 3" : undefined,
          },
          interactive: !props.splitMode,
        },
      );
      const activateArea = () => {
        setPendingParcel(null);
        setParcelStatus("");
        setLayersOpen(false);
        callbacksRef.current.onAreaClick(area.id);
      };
      polygon.on("click", (event: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(event);
        activateArea();
      });
      const score = props.scores[area.id];
      const officialNumber = showOfficialParcelNumber(area)
        ? officialParcelNumber(area)
        : null;
      const tooltipMeta = `${officialNumber ? `Parcela ${officialNumber} · ` : ""}${tooltipArea(area.geometry)}`;
      const indexLabel =
        score?.inputOrigin === "open-data"
          ? "Index vhodnosti"
          : "Uživatelský scénář";
      const indexSummary =
        score?.overall != null ? `${indexLabel} ${score.overall}/100` : "";
      polygon.bindTooltip(
        parcelTooltip(
          area.name,
          tooltipMeta,
          availability
            ? `${tooltipCoverage(availability)}${indexSummary ? ` · ${indexSummary}` : ""}`
            : indexSummary || score?.verdict || "Dosud neověřeno",
        ),
        {
          sticky: true,
          direction: "top",
          offset: [0, -7],
          className: "sady-tooltip parcel-hover-tooltip",
        },
      );
      group.addLayer(polygon);
      if (!props.splitMode)
        parcelKeyboardTarget(
          polygon,
          `${area.name}, ${tooltipArea(area.geometry)}. Otevřít detail pozemku.`,
          activateArea,
          active,
        );
      // Dense planting dots need an unobstructed view; source/part labels over
      // the same place remain available through hover and the parcel list.
      if (plannedBounds && polygon.getBounds().overlaps(plannedBounds))
        continue;
      let labelPoint: L.LatLngExpression = polygon.getBounds().getCenter();
      try {
        labelPoint = toLatLng(representativePoint(area.geometry));
      } catch {
        /* Malformed user geometry gets its bounds label only. */
      }
      const title =
        zoom >= 13
          ? area.name
          : (area.tag ?? (active ? "Vybraný pozemek" : ""));
      if (!title) continue;
      const label = L.marker(labelPoint, {
        interactive: false,
        icon: L.divIcon({
          className: "plot-label-wrap",
          html: `<span class="plot-label${active ? " active" : ""}"><strong>${escapeHtml(title.length > 34 ? title.slice(0, 32) + "…" : title)}</strong>${zoom >= 13 ? "<small>" + fmtHa(area.geometry) + "</small>" : ""}</span>`,
          iconSize: zoom >= 13 ? [160, 44] : [28, 24],
          iconAnchor: zoom >= 13 ? [80, 22] : [14, 12],
        }),
      });
      group.addLayer(label);
    }
  }, [
    props.areas,
    props.scores,
    props.selectedIds,
    props.activeId,
    props.splitMode,
    props.plantingLayout,
    coverageEnabled,
    coverage.parcels,
    excludeGardens,
    zoom,
    ready,
  ]);

  useEffect(() => {
    let active = true;
    const wanted = ["bpej"].filter((id) => props.layers[id]);
    if (!wanted.length) {
      setLayerStatus("");
      return;
    }
    setLayerStatus("Načítám analytické vrstvy…");
    locationIndex()
      .then((entries) => Promise.all(entries.map(loadLocation)))
      .then((locations) => {
        if (!active) return;
        const next: Record<string, GeoJSON.FeatureCollection> = {};
        for (const id of wanted) {
          const keys = [id];
          next[id] = {
            type: "FeatureCollection",
            features: locations
              .flatMap((d) => keys.flatMap((k) => d.layers[k].features))
              .map((f) => ({
                ...f,
                properties: {
                  ...f.properties,
                  label: String(
                    f.properties?.nazev ?? f.properties?.name ?? id,
                  ),
                  detail: "Připravené výřezy pěti lokalit",
                  color: "#ba8b54",
                },
              })),
          };
        }
        setRealLayers((previous) => ({ ...previous, ...next }));
        setLayerStatus("");
      })
      .catch(() => {
        if (active)
          setLayerStatus(
            "Analytická vrstva není dostupná. Vypněte ji a zkuste znovu zapnout.",
          );
      });
    return () => {
      active = false;
    };
  }, [props.layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const definition of MAP_LAYERS) {
      if (definition.id === "suitability") continue;
      let group = overlayGroupsRef.current[definition.id];
      if (group && map.hasLayer(group)) map.removeLayer(group);
      if (!props.layers[definition.id]) continue;
      if (!group) {
        group = L.layerGroup();
        overlayGroupsRef.current[definition.id] = group;
      }
      group.clearLayers();
      const features =
        definition.id === "bpej"
          ? (realLayers[definition.id]?.features ?? [])
          : definition.features;
      group.addLayer(
        L.geoJSON(
          {
            type: "FeatureCollection",
            features,
          } as unknown as GeoJSON.GeoJsonObject,
          {
            pane: "analyticalOverlay",
            style: (f) => {
              const color = String(f?.properties?.color ?? "#71965e");
              return f?.geometry?.type === "LineString"
                ? { color, weight: 2, opacity: 0.8, dashArray: "6 4" }
                : {
                    color,
                    weight: 1,
                    opacity: 0.65,
                    fillColor: color,
                    fillOpacity: 0.2,
                  };
            },
            onEachFeature: (feature, layer) => {
              layer.bindTooltip(
                `<strong>${escapeHtml(String(feature.properties?.label ?? definition.name))}</strong><br>${escapeHtml(String(feature.properties?.detail ?? ""))}`,
                { sticky: true, className: "sady-tooltip" },
              );
            },
            interactive: !props.splitMode && !cadastre,
          },
        ),
      );
      group.addTo(map);
    }
    // Parcel borders and split handles must remain legible over analytical fills.
    areaGroupRef.current?.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON) layer.bringToFront();
    });
    splitGroupRef.current?.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON || layer instanceof L.Path)
        layer.bringToFront();
    });
    pendingGroupRef.current?.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON) layer.bringToFront();
    });
  }, [props.layers, realLayers, props.splitMode, cadastre, ready]);

  useEffect(() => {
    const group = splitGroupRef.current,
      map = mapRef.current;
    if (!group || !map) return;
    group.clearLayers();
    if (!props.splitMode) return;
    (props.splitPreview ?? []).forEach((geometry, index) => {
      const color = previewColors[index % previewColors.length];
      const layer = L.geoJSON(
        { type: "Feature", properties: {}, geometry } as GeoJSON.GeoJsonObject,
        {
          style: { color, weight: 2.5, fillColor: color, fillOpacity: 0.3 },
          interactive: false,
        },
      );
      group.addLayer(layer);
      let point: L.LatLngExpression = layer.getBounds().getCenter();
      try {
        point = toLatLng(representativePoint(geometry));
      } catch {
        /* Preview labels may use their bounds. */
      }
      group.addLayer(
        L.marker(point, {
          interactive: false,
          icon: L.divIcon({
            className: "split-part-label-wrap",
            html: `<span class="split-part-label">Část ${index + 1}<small>${fmtHa(geometry)}</small></span>`,
            iconSize: [110, 44],
            iconAnchor: [55, 22],
          }),
        }),
      );
    });
    if (props.splitPoints.length > 1)
      group.addLayer(
        L.polyline(props.splitPoints.map(toLatLng), {
          color: "#f4a340",
          weight: 3,
          dashArray: "8 5",
          interactive: false,
        }),
      );
    props.splitPoints.forEach((point, index) => {
      const marker = L.marker(toLatLng(point), {
        draggable: true,
        title: `Dělicí bod ${index + 1}`,
        icon: L.divIcon({
          className: "cut-point-wrap",
          html: `<span class="cut-point">${index + 1}</span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      });
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        callbacksRef.current.onSplitPointMove(index, [p.lng, p.lat]);
      });
      group.addLayer(marker);
    });
  }, [props.splitMode, props.splitPoints, props.splitPreview, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getContainer().style.cursor = props.splitMode ? "crosshair" : "";
    if (props.splitMode) {
      map.doubleClickZoom.disable();
      setLayersOpen(false);
      setParcelStatus("");
    } else map.doubleClickZoom.enable();
  }, [props.splitMode, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.focus) return;
    fitFocus(map, props.focus, props.detailOpen);
  }, [props.focus, props.detailOpen, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (props.searchMarker) {
      const marker = L.circleMarker(
        [props.searchMarker.lat, props.searchMarker.lon],
        {
          radius: 6,
          color: "#fff",
          weight: 2,
          fillColor: "#386e37",
          fillOpacity: 1,
        },
      );
      marker.bindTooltip(escapeHtml(props.searchMarker.label), {
        direction: "top",
        className: "sady-tooltip",
      });
      marker.addTo(map);
      return () => {
        map.removeLayer(marker);
      };
    }
  }, [props.searchMarker, ready]);

  return (
    <section
      className={`map-shell${props.detailOpen || pendingParcel ? " has-detail" : ""}${pendingParcel ? " has-parcel-preview" : ""}${props.splitMode ? " is-splitting" : ""}`}
      aria-label="Mapa pozemků"
    >
      <div
        ref={containerRef}
        id="map"
        aria-label={
          props.splitMode
            ? "Mapa v režimu rozdělení pozemku"
            : "Interaktivní mapa České republiky"
        }
      />
      {!ready && (
        <div className="map-loading" role="status">
          Načítám mapu…
        </div>
      )}
      {!layersOpen &&
        props.plantingLayout?.status === "ready" &&
        !props.splitMode &&
        zoom >= 14 && (
          <div className="planting-map-key" role="status">
            <span
              className="planting-map-tree"
              aria-hidden="true"
              style={{
                background: PLANTING_COLORS[props.plantingFruit ?? "apple"],
                boxShadow: `0 0 0 1px ${PLANTING_COLORS[props.plantingFruit ?? "apple"]}`,
              }}
            />
            {props.plantingLayout.trees.length.toLocaleString("cs-CZ")} stromů
            <span className="planting-map-row" aria-hidden="true" /> řady
          </div>
        )}
      <div
        className="map-tools"
        style={{ position: "absolute", right: 18, top: 18, zIndex: 450 }}
      >
        <button
          ref={layerButtonRef}
          type="button"
          className={`map-control-button${layersOpen ? " active" : ""}`}
          aria-expanded={layersOpen}
          aria-controls="map-layer-popover"
          onClick={() => setLayersOpen((v) => !v)}
        >
          <IconStack2 size={18} stroke={1.7} />
          <span>Vrstvy</span>
        </button>
        <button
          type="button"
          className="map-control-button icon-only"
          onClick={props.onHome}
          title="Zobrazit celou Českou republiku"
          aria-label="Zobrazit celou Českou republiku"
        >
          <CzechiaOutlineIcon />
        </button>
        {layersOpen && (
          <div
            id="map-layer-popover"
            className="map-layer-popover"
            role="group"
            aria-label="Mapové vrstvy"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setLayersOpen(false);
                layerButtonRef.current?.focus();
              }
            }}
          >
            <div className="map-layer-heading">
              <strong>Mapové vrstvy</strong>
              <button
                type="button"
                className="icon-button"
                aria-label="Zavřít mapové vrstvy"
                onClick={() => {
                  setLayersOpen(false);
                  layerButtonRef.current?.focus();
                }}
              >
                <IconX size={16} />
              </button>
            </div>
            <label className="field">
              <span>Mapový podklad</span>
              <select
                aria-label="Mapový podklad"
                value={baseMap}
                onChange={(e) => setBaseMap(e.target.value as BaseMap)}
              >
                {Object.entries(BASE_MAPS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="map-layer-check">
              <input
                type="checkbox"
                checked={cadastre}
                onChange={(e) => {
                  setCadastre(e.target.checked);
                  setPendingParcel(null);
                  setParcelStatus("");
                }}
              />
              <span>
                Katastrální parcely{" "}
                <small>
                  Zemědělské parcely všech velikostí od přiblížení 14
                </small>
              </span>
            </label>
            <label className="map-layer-check">
              <input
                type="checkbox"
                checked={excludeGardens}
                onChange={(event) => setExcludeGardens(event.target.checked)}
              />
              <span>
                Skrýt zahrady
                <small>Nezobrazovat parcely s druhem pozemku zahrada</small>
              </span>
            </label>
            <label className="map-layer-check is-unavailable">
              <input
                type="checkbox"
                disabled
                aria-describedby="rental-source-note"
              />
              <span>
                Pouze k pronájmu
                <small id="rental-source-note">
                  Zdroj nabídek pronájmu zatím není připojený.
                </small>
              </span>
            </label>
            {props.onToggleLayer && (
              <label className="map-layer-check">
                <input
                  type="checkbox"
                  checked={coverageEnabled}
                  onChange={() => props.onToggleLayer?.("coverage")}
                />
                <span>
                  Dostupnost dat pro parcely
                  <small>BPEJ, klima a vláha; nejde o vhodnost sadu</small>
                </span>
              </label>
            )}
            <DataCoverageLegend layer={coverage} enabled={coverageEnabled} />
            {props.onToggleLayer &&
              MAP_LAYERS.filter(
                (d) => d.id !== "suitability" && d.quality !== "unavailable",
              ).map((d) => (
                <label className="map-layer-check" key={d.id}>
                  <input
                    type="checkbox"
                    checked={!!props.layers[d.id]}
                    onChange={() => props.onToggleLayer?.(d.id)}
                  />
                  <span>
                    {d.name}
                    <small>Otevřená data – připravené výřezy</small>
                  </span>
                </label>
              ))}
            {cadastre && zoom < 14 && (
              <p className="map-layer-note">
                Přibližte mapu pro zobrazení a výběr parcel.
              </p>
            )}
          </div>
        )}
      </div>
      {pendingParcel && !props.splitMode && (
        <ParcelPreview
          feature={pendingParcel}
          coverage={
            coverage.parcels.find(
              (item) =>
                String(item.feature.properties.id) ===
                String(pendingParcel.properties.id),
            )?.coverage
          }
          onClose={() => setPendingParcel(null)}
          onAdd={() => {
            const eligibility = parcelEligibility(pendingParcel);
            if (!eligibility.allowed) {
              setParcelStatus(eligibility.reason);
              setPendingParcel(null);
              return;
            }
            const feature = pendingParcel;
            setPendingParcel(null);
            callbacksRef.current.onParcelSelect(feature);
          }}
        />
      )}
      {props.splitMode && (
        <div className="split-map-instruction" role="status">
          <strong>Rozdělení pozemku</strong>
          <span>
            {props.splitPoints.length === 0
              ? "Klikněte před hranici pozemku na začátek dělicí čáry."
              : props.splitPoints.length === 1
                ? "Druhý bod umístěte za protější hranici pozemku."
                : "Konce čáry můžete posunout. Zkontrolujte náhled a rozdělení potvrďte v kartě."}
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={props.onCancelSplit}
            aria-label="Zrušit režim rozdělení"
          >
            <IconX size={18} />
          </button>
        </div>
      )}
      {(!tilesOk || parcelStatus || layerStatus) && (
        <div className="map-status" role="status">
          {!tilesOk
            ? "Mapový podklad není dostupný. Zkuste ve vrstvách změnit podklad."
            : parcelStatus || layerStatus}
        </div>
      )}
    </section>
  );
}
