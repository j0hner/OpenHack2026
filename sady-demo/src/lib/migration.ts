import type { AnalysisArea } from "./types";
import type { PersistedState, SplitRecord } from "./storage";

const legacySampleId = (id: string) => /^demo(?:-|$)/i.test(id);
const roots = (area: AnalysisArea) => [
  ...(area.derivedFrom?.sourceIds ?? []),
  ...(area.derivedFrom?.rootSourceIds ?? []),
];
/** Discard synthetic sample lineage while retaining actual user geometries. */
export function migrateState(
  state: Partial<PersistedState> | null,
): Partial<PersistedState> | null {
  if (!state) return null;
  const parcels = state.parcels ?? [],
    working = state.workingAreas ?? [],
    history = state.splitHistory ?? [];
  const all = [
    ...parcels,
    ...working,
    ...history.map((record) => record.source),
  ];
  const synthetic = new Set(
    all
      .filter((area) => area.kind === "sample" || legacySampleId(area.id))
      .map((area) => area.id),
  );
  for (const area of all)
    for (const id of roots(area)) if (legacySampleId(id)) synthetic.add(id);
  let changed = true;
  while (changed) {
    changed = false;
    for (const area of all)
      if (
        !synthetic.has(area.id) &&
        roots(area).some((id) => synthetic.has(id))
      ) {
        synthetic.add(area.id);
        changed = true;
      }
  }
  const keep = (area: AnalysisArea) =>
    area.kind !== "sample" &&
    !synthetic.has(area.id) &&
    !legacySampleId(area.id);
  const clean = (area: AnalysisArea): AnalysisArea => {
    const { regional, ...rest } = area;
    void regional;
    return {
      ...rest,
      attributes: {
        soil: null,
        climate: null,
        water: null,
        terrain: null,
        access: null,
        constraints: null,
      },
      availability: {
        soil: "missing",
        climate: "missing",
        water: "missing",
        terrain: "missing",
        access: "missing",
      },
      sourceNote: area.cadastral
        ? "Skutečná geometrie a atributy ČÚZK / RÚIAN. Podklady se přiřazují podle geometrie."
        : area.derivedFrom
          ? "Uživatelská pracovní geometrie odvozená z uložených pozemků. Podklady se přiřazují podle výsledného polygonu."
          : "Dříve uložená uživatelská geometrie. Podklady se přiřazují podle polohy.",
      story: area.cadastral
        ? "Skutečná parcela. Druh pozemku sám o sobě nepotvrzuje povolení výsadby."
        : "Uživatelská pracovní plocha; nejde o právní změnu katastru.",
    };
  };
  const keptParcels = parcels.filter(keep).map(clean),
    keptWorking = working.filter(keep).map(clean);
  const allowedIds = new Set(
    [...keptParcels, ...keptWorking].map((area) => area.id),
  );
  if (state.drawnGeometry) allowedIds.add("custom");
  const select = (ids: string[]) => ids.filter((id) => allowedIds.has(id));
  const recordMap = (record: SplitRecord): SplitRecord => ({
    ...record,
    source: clean(record.source),
    selectedIds: select(record.selectedIds),
  });
  const result = {
    ...state,
    modelVersion: "moje-sady-2",
    mode: "custom" as const,
    parcels: keptParcels,
    workingAreas: keptWorking,
    selectedIds: select(state.selectedIds ?? []),
    activeId:
      state.activeId && allowedIds.has(state.activeId) ? state.activeId : null,
    areaNames: Object.fromEntries(
      Object.entries(state.areaNames ?? {}).filter(([id]) =>
        allowedIds.has(id),
      ),
    ),
    fruitByArea: Object.fromEntries(
      Object.entries(state.fruitByArea ?? {}).filter(([id]) =>
        allowedIds.has(id),
      ),
    ),
    layers: Object.fromEntries(
      Object.entries(state.layers ?? {}).filter(([id]) =>
        ["bpej", "protected", "suitability", "coverage"].includes(id),
      ),
    ),
    splitHistory: history
      .filter(
        (record) =>
          keep(record.source) &&
          !record.childIds.some(
            (id) => synthetic.has(id) || legacySampleId(id),
          ),
      )
      .map(recordMap),
    hiddenSampleIds: [],
    demoProfileId: null,
  };
  return result;
}
