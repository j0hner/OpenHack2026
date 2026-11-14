import { useEffect, useId, useState, type FormEvent } from "react";
import {
  IconDownload,
  IconExternalLink,
  IconMap,
  IconPlant2,
} from "@tabler/icons-react";
import { FRUITS } from "../data/fruitProfiles";
import {
  getDefaultPlantingSettings,
  getPlantingProfile,
  getPlantingProfiles,
  PLANTING_SOURCE,
} from "../data/plantingProfiles";
import type { AppliedPlantingPlan } from "../lib/plantingPlan";
import type {
  PlantingGeometrySettings,
  PlantingLayout,
} from "../lib/plantingGeometry";
import type { AnalysisArea, FruitKey } from "../lib/types";
import "./planting-plan.css";

export interface PlantingPlanPanelProps {
  area: AnalysisArea;
  fruit: FruitKey;
  applied?: AppliedPlantingPlan;
  layout: PlantingLayout | null;
  busy: boolean;
  error: string;
  onGenerate: (settings: PlantingGeometrySettings, profileId: string) => void;
  onClear: () => void;
  onShowMap: () => void;
  showOnMap: boolean;
  onVisibilityChange: (show: boolean) => void;
}

type NumericKey =
  | "rowSpacingM"
  | "treeSpacingM"
  | "edgeClearanceM"
  | "headlandM"
  | "bearingDeg";
type Draft = Record<NumericKey, string> & { orientation: "auto" | "manual" };
const numbers = (settings: PlantingGeometrySettings): Draft => ({
  rowSpacingM: String(settings.rowSpacingM),
  treeSpacingM: String(settings.treeSpacingM),
  edgeClearanceM: String(settings.edgeClearanceM),
  headlandM: String(settings.headlandM),
  bearingDeg: String(settings.bearingDeg),
  orientation: settings.orientation,
});
const fmt = (value: number) =>
  value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });
const numberFields: {
  key: NumericKey;
  label: string;
  min: number;
  max: number;
}[] = [
  { key: "rowSpacingM", label: "Mezi řadami", min: 0.5, max: 50 },
  { key: "treeSpacingM", label: "Mezi stromy v řadě", min: 0.5, max: 50 },
  { key: "edgeClearanceM", label: "Odsazení od hranice", min: 0, max: 50 },
  { key: "headlandM", label: "Místo na koncích řad", min: 0, max: 50 },
  { key: "bearingDeg", label: "Směr řad od severu", min: 0, max: 180 },
];

function parseDraft(draft: Draft): {
  settings?: PlantingGeometrySettings;
  errors: Partial<Record<NumericKey, string>>;
} {
  const errors: Partial<Record<NumericKey, string>> = {},
    values: Partial<Record<NumericKey, number>> = {};
  for (const field of numberFields) {
    if (field.key === "bearingDeg" && draft.orientation === "auto") {
      values.bearingDeg = 0;
      continue;
    }
    const text = draft[field.key].trim();
    if (!text || !/^[+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) {
      errors[field.key] = "Vyplňte platné číslo.";
      continue;
    }
    const value = Number(text.replace(",", "."));
    if (
      !Number.isFinite(value) ||
      value < field.min ||
      value > field.max ||
      (field.key === "bearingDeg" && value >= 180)
    )
      errors[field.key] =
        field.key === "bearingDeg"
          ? "Zvolte úhel od 0 do méně než 180°."
          : `Zvolte hodnotu ${fmt(field.min)}–${fmt(field.max)} m.`;
    else values[field.key] = value;
  }
  if (
    values.rowSpacingM !== undefined &&
    values.treeSpacingM !== undefined &&
    values.rowSpacingM < values.treeSpacingM
  )
    errors.rowSpacingM =
      "Meziřadí musí být alespoň tak široké jako rozestup stromů v řadě.";
  return Object.keys(errors).length
    ? { errors }
    : {
        errors,
        settings: {
          ...(values as Record<NumericKey, number>),
          orientation: draft.orientation,
        },
      };
}

export default function PlantingPlanPanel(props: PlantingPlanPanelProps) {
  const {
    area,
    fruit,
    applied,
    layout,
    busy,
    error,
    onGenerate,
    onClear,
    onShowMap,
    showOnMap,
    onVisibilityChange,
  } = props;
  const profiles = getPlantingProfiles(fruit),
    id = useId();
  const [profileId, setProfileId] = useState(
    applied?.profileId ?? profiles[0].id,
  );
  const [draft, setDraft] = useState<Draft>(() =>
    numbers(applied?.settings ?? getDefaultPlantingSettings(fruit)),
  );
  const [errors, setErrors] = useState<Partial<Record<NumericKey, string>>>({});
  const appliedSignature = JSON.stringify(applied);
  useEffect(() => {
    setProfileId(applied?.profileId ?? getPlantingProfiles(fruit)[0].id);
    setDraft(numbers(applied?.settings ?? getDefaultPlantingSettings(fruit)));
    setErrors({});
  }, [area.id, fruit, appliedSignature]);
  const parsed = parseDraft(draft);
  const settingsChanged =
    !parsed.settings ||
    !applied ||
    numberFields.some(
      ({ key }) => parsed.settings![key] !== applied.settings[key],
    ) ||
    parsed.settings.orientation !== applied.settings.orientation ||
    profileId !== applied.profileId;
  const profile = getPlantingProfile(fruit, profileId);
  const outsideRecommended =
    !!profile &&
    !!parsed.settings &&
    (parsed.settings.rowSpacingM < profile.rowRange[0] ||
      parsed.settings.rowSpacingM > profile.rowRange[1] ||
      parsed.settings.treeSpacingM < profile.treeRange[0] ||
      parsed.settings.treeSpacingM > profile.treeRange[1]);
  const currentLayout =
    layout &&
    applied &&
    layout.geometryKey === applied.geometryKey &&
    (layout.status === "ready" || layout.status === "empty")
      ? layout
      : null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = parseDraft(draft);
    setErrors(result.errors);
    if (result.settings) onGenerate(result.settings, profileId);
  };
  const chooseProfile = (value: string) => {
    const next = getPlantingProfile(fruit, value);
    if (!next) return;
    setProfileId(value);
    setDraft((previous) => ({
      ...previous,
      rowSpacingM: String(next.rowSpacingM),
      treeSpacingM: String(next.treeSpacingM),
    }));
    setErrors({});
  };
  const field = (key: NumericKey) => {
    const definition = numberFields.find((item) => item.key === key)!;
    return (
      <label className="planting-plan-field" key={key} htmlFor={`${id}-${key}`}>
        <span id={`${id}-${key}-label`}>
          {definition.label} <small>{key === "bearingDeg" ? "°" : "m"}</small>
        </span>
        <input
          id={`${id}-${key}`}
          type="text"
          inputMode="decimal"
          value={draft[key]}
          disabled={busy}
          maxLength={16}
          onChange={(event) =>
            setDraft((previous) => ({ ...previous, [key]: event.target.value }))
          }
          aria-invalid={!!errors[key]}
          aria-labelledby={`${id}-${key}-label`}
          aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
        />
        {errors[key] && (
          <span
            className="planting-plan-field-error"
            id={`${id}-${key}-error`}
            role="alert"
          >
            {errors[key]}
          </span>
        )}
      </label>
    );
  };
  const exportPlan = () => {
    if (!currentLayout || !applied) return;
    const properties = {
      fruit,
      areaId: area.id,
      areaName: area.name,
      geometryKey: applied.geometryKey,
      algorithmVersion: applied.version,
      generatedAt: applied.createdAt,
      rowSpacingM: applied.settings.rowSpacingM,
      treeSpacingM: applied.settings.treeSpacingM,
      edgeClearanceM: applied.settings.edgeClearanceM,
      headlandM: applied.settings.headlandM,
      bearingDeg: applied.bearingDeg,
      expertSource: PLANTING_SOURCE.url,
      type: "modelovy-plan-vysadby",
    };
    const geojson = {
      type: "FeatureCollection",
      properties,
      features: [
        {
          type: "Feature",
          properties: { kind: "hranice", name: area.name },
          geometry: area.geometry,
        },
        ...currentLayout.trees.map((point, index) => ({
          type: "Feature",
          properties: { kind: "strom", number: index + 1, fruit },
          geometry: { type: "Point", coordinates: point },
        })),
        ...currentLayout.rows.map((row) => ({
          type: "Feature",
          properties: { kind: "rada", id: row.id, treeCount: row.treeCount },
          geometry: { type: "LineString", coordinates: row.coordinates },
        })),
      ],
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(geojson)], { type: "application/geo+json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `vysadba-${
      area.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .slice(0, 60) || "pozemek"
    }.geojson`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section
      className="planting-plan-panel"
      aria-label="Plán rozmístění stromů"
    >
      <div className="planting-plan-heading">
        <h3>
          <IconPlant2 size={18} aria-hidden="true" />
          Rozmístění stromů
        </h3>
        <span className="badge q-assumption">Návrh výsadby</span>
      </div>
      <p className="planting-plan-intro">
        {FRUITS[fruit].name} · řady a stromy podle skutečného tvaru plochy.
      </p>
      <form noValidate onSubmit={submit}>
        <label className="planting-plan-field" htmlFor={`${id}-profile`}>
          <span>Typ výsadby</span>
          <select
            id={`${id}-profile`}
            value={profileId}
            disabled={busy}
            onChange={(event) => chooseProfile(event.target.value)}
          >
            {profiles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="planting-plan-fields">
          {field("rowSpacingM")}
          {field("treeSpacingM")}
        </div>
        <p className="planting-plan-guidance">
          Rozestupy ověřte podle konkrétní podnože, odrůdy a techniky.{" "}
          {profile?.note}
        </p>
        <details className="planting-plan-options">
          <summary>Odstupy a směr řad</summary>
          <div className="planting-plan-fields">
            {field("edgeClearanceM")}
            {field("headlandM")}
          </div>
          <p className="planting-plan-guidance">
            Odsazení platí také kolem otvorů v pozemku. Místo na koncích řad se
            přidává pro obsluhu; nejde o ověření právních odstupů.
          </p>
          <label className="planting-plan-field" htmlFor={`${id}-orientation`}>
            <span>Směr řad</span>
            <select
              id={`${id}-orientation`}
              value={draft.orientation}
              disabled={busy}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  orientation: event.target.value as Draft["orientation"],
                }))
              }
            >
              <option value="auto">Automaticky podle tvaru</option>
              <option value="manual">Vlastní směr</option>
            </select>
          </label>
          {draft.orientation === "manual" && (
            <>
              {field("bearingDeg")}
              <p className="planting-plan-guidance">
                0° = sever–jih, 90° = východ–západ.
              </p>
            </>
          )}
        </details>
        {outsideRecommended && (
          <p className="planting-plan-warning">
            Vlastní spon je mimo uvedené doporučené rozmezí. Pro konkrétní
            stromy ho ověřte s pěstitelem.
          </p>
        )}
        <button
          className="btn primary planting-plan-generate"
          type="submit"
          disabled={busy}
        >
          <IconPlant2 size={17} aria-hidden="true" />
          {busy
            ? "Počítám rozmístění…"
            : applied
              ? "Přepočítat rozmístění"
              : "Navrhnout rozmístění"}
        </button>
        {Object.keys(errors).length > 0 && (
          <p className="planting-plan-field-error" role="alert">
            Opravte označené hodnoty. Uložený plán se nezměnil.
          </p>
        )}
      </form>
      {busy && (
        <p className="planting-plan-status" role="status">
          Hledám vhodný směr a polohy stromů. S mapou můžete dál pracovat.
        </p>
      )}
      {error && (
        <p className="planting-plan-warning" role="alert">
          {error}
        </p>
      )}
      {applied && (
        <div className="planting-plan-result">
          <div className="planting-plan-metrics">
            <div>
              <span>Stromy</span>
              <strong>{fmt(applied.treeCount)}</strong>
            </div>
            <div>
              <span>Úseky řad</span>
              <strong>{fmt(applied.rowCount)}</strong>
            </div>
            <div>
              <span>Směr řad</span>
              <strong>{fmt(applied.bearingDeg)}°</strong>
            </div>
          </div>
          {applied.status === "empty" ? (
            <p className="planting-plan-warning">
              Při tomto sponu a odstupech se do plochy nevejde žádný strom.
              Zvažte vhodnější typ výsadby nebo menší provozní rezervy.
            </p>
          ) : (
            <p className="planting-plan-guidance">
              {applied.settings.orientation === "auto"
                ? "Nejlepší z testovaných rozmístění pro zadaný spon a odstupy."
                : "Rozmístění ve vámi zvoleném směru."}{" "}
              {currentLayout && currentLayout.candidateCount > 0
                ? `Porovnáno ${fmt(currentLayout.candidateCount)} variant.`
                : ""}
            </p>
          )}
          {settingsChanged && (
            <p className="planting-plan-pending" role="status">
              Změněné hodnoty zatím nejsou použité. Mapa a souhrn ukazují
              poslední vypočtený plán.
            </p>
          )}
          {applied.status === "ready" && (
            <>
              <label className="planting-plan-visibility">
                <input
                  type="checkbox"
                  checked={showOnMap}
                  disabled={busy}
                  onChange={(event) => onVisibilityChange(event.target.checked)}
                />
                <span>Zobrazit stromy a řady v mapě</span>
              </label>
              <div className="planting-plan-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={onShowMap}
                >
                  <IconMap size={16} aria-hidden="true" />
                  Zobrazit v mapě
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!currentLayout || busy}
                  onClick={exportPlan}
                >
                  <IconDownload size={16} aria-hidden="true" />
                  GeoJSON
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            className="link-button planting-plan-clear"
            onClick={onClear}
            disabled={busy}
          >
            Odstranit plán výsadby
          </button>
        </div>
      )}
      <details className="planting-plan-source">
        <summary>Podklad rozestupů a omezení návrhu</summary>
        {profile && (
          <p>
            Doporučený rozsah zvoleného typu: {fmt(profile.rowRange[0])}–
            {fmt(profile.rowRange[1])} m mezi řadami,{" "}
            {fmt(profile.treeRange[0])}–{fmt(profile.treeRange[1])} m v řadě.
            Výchozí hodnoty jsou zvolený návrh uvnitř rozsahu.
          </p>
        )}
        <p>
          <a
            href={PLANTING_SOURCE.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {PLANTING_SOURCE.label}{" "}
            <IconExternalLink size={13} aria-hidden="true" />
          </a>
        </p>
        <p>
          Geometrie vynechá otvory a zadané odstupy. Neověřuje sklon, zastínění,
          podzemní sítě, stávající stromy, opylovací odrůdy ani skutečný průjezd
          techniky. Po rozdělení nebo spojení se nový plán počítá z nového
          tvaru. Polohy jsou návrh pro plánování, ne geodetické vytyčení.
        </p>
      </details>
    </section>
  );
}
