import { useId, useMemo, useState } from "react";
import {
  IconSearch,
  IconPlus,
  IconStack2,
  IconDots,
  IconPencil,
  IconTrash,
  IconLayersIntersect,
} from "@tabler/icons-react";
import { areaHa } from "../lib/geo";
import { fmtHa } from "../lib/format";
import { FRUITS } from "../data/fruitProfiles";
import { mergeEligibility } from "../lib/geometryOperations";
import {
  ALL_CATEGORIES,
  UNASSIGNED_CATEGORY,
  categoryAreas,
  officialParcelNumber,
  showOfficialParcelNumber,
  type CategoryControl,
} from "../lib/parcelCategories";
import ParcelCategories from "./ParcelCategories";
import "./parcel-categories.css";
import type { AnalysisArea, FruitKey, SuitabilityResult } from "../lib/types";
interface Props {
  areas: AnalysisArea[];
  scores: Record<string, SuitabilityResult>;
  fruits: Record<string, FruitKey>;
  defaultFruit: FruitKey;
  selectedIds: string[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onMerge: (name: string) => void;
  onDeleteSelected?: (ids: string[]) => void;
  categoryControl?: CategoryControl;
}
export default function ParcelList(p: Props) {
  const mergeDescriptionId = useId();
  const [query, setQuery] = useState(""),
    [menu, setMenu] = useState<string | null>(null),
    [edit, setEdit] = useState<string | null>(null),
    [draft, setDraft] = useState(""),
    [error, setError] = useState(""),
    [merge, setMerge] = useState(false),
    [mergeName, setMergeName] = useState("Spojený pozemek"),
    [category, setCategory] = useState(ALL_CATEGORIES);
  const scope =
    category === UNASSIGNED_CATEGORY ||
    p.categoryControl?.state.categories.some((item) => item.id === category)
      ? category
      : ALL_CATEGORIES;
  const shown = useMemo(
    () =>
      (p.categoryControl
        ? categoryAreas(p.areas, p.categoryControl.state, scope)
        : p.areas
      ).filter((a) =>
        (
          a.name +
          " " +
          (officialParcelNumber(a) ?? "") +
          " " +
          a.location.katastr
        )
          .toLocaleLowerCase("cs")
          .includes(query.toLocaleLowerCase("cs")),
      ),
    [p.areas, query, p.categoryControl, scope],
  );
  const mergeStatus = useMemo(
    () =>
      mergeEligibility(
        p.areas
          .filter((area) => p.selectedIds.includes(area.id))
          .map((area) => area.geometry),
      ),
    [p.areas, p.selectedIds],
  );
  return (
    <aside className="parcel-sidebar" aria-label="Seznam pozemků">
      <div className="parcel-list-title">
        <h1>
          Pozemky <span>{p.areas.length}</span>
        </h1>
        <button
          type="button"
          className="add-parcel"
          onClick={p.onAdd}
          aria-label="Přidat parcelu z katastru"
        >
          <IconPlus size={19} />
        </button>
      </div>
      <label className="saved-search">
        <IconSearch size={16} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hledat pozemek…"
          aria-label="Hledat v uložených pozemcích"
        />
      </label>
      {p.categoryControl && (
        <>
          <ParcelCategories
            control={p.categoryControl}
            selectedIds={p.selectedIds}
            scope={scope}
            onScopeChange={setCategory}
          />
          {scope !== ALL_CATEGORIES && (
            <div className="parcel-category-active-filter">
              <span>
                {scope === UNASSIGNED_CATEGORY
                  ? "Bez kategorie"
                  : p.categoryControl.state.categories.find(
                      (item) => item.id === scope,
                    )?.name}
              </span>
              <button
                type="button"
                onClick={() => setCategory(ALL_CATEGORIES)}
                aria-label="Zrušit filtr kategorie"
              >
                ×
              </button>
            </div>
          )}
        </>
      )}
      <div className="saved-parcels">
        {!shown.length && (
          <div className="list-empty">
            {query
              ? "Žádný pozemek neodpovídá hledání."
              : p.areas.length > 0
                ? "V této kategorii nejsou žádné pozemky."
                : "Zatím nemáte přidaný pozemek. Vyhledejte lokalitu a otevřete parcelu v mapě."}
          </div>
        )}
        {shown.map((a) => (
          <div
            key={a.id}
            className={`parcel-list-item ${p.activeId === a.id ? "active" : ""}`}
            data-area-id={a.id}
          >
            <div className="parcel-list-row">
              <button
                type="button"
                className="parcel-list-main"
                onClick={() => {
                  setMenu(null);
                  p.onSelect(a.id);
                }}
                aria-pressed={p.activeId === a.id}
              >
                <IconStack2 size={18} stroke={1.65} />
                <span>
                  <strong>
                    {a.name}
                    {showOfficialParcelNumber(a) && (
                      <span
                        className="parcel-official-number"
                        aria-label={`Parcelní číslo ${officialParcelNumber(a)}`}
                      >
                        {officialParcelNumber(a)}
                      </span>
                    )}
                  </strong>
                  <small>
                    {fmtHa(areaHa(a.geometry))}
                    {a.derivedFrom ? " · uživatelská část" : ""}
                    {p.categoryControl?.state.assignments[a.id]
                      ? " · " +
                        p.categoryControl.state.categories.find(
                          (item) =>
                            item.id ===
                            p.categoryControl?.state.assignments[a.id],
                        )?.name
                      : ""}
                  </small>
                  <em>
                    {FRUITS[p.fruits[a.id] ?? p.defaultFruit].name}
                    {p.scores[a.id]?.overall != null
                      ? " · " + p.scores[a.id].overall + "/100"
                      : ""}
                  </em>
                </span>
              </button>
              <input
                type="checkbox"
                checked={p.selectedIds.includes(a.id)}
                onChange={() => p.onToggle(a.id)}
                aria-label={`Vybrat pro společnou práci: ${a.name}`}
              />
              <button
                type="button"
                className="item-menu"
                onClick={() => setMenu(menu === a.id ? null : a.id)}
                aria-label={`Možnosti pozemku ${a.name}`}
                aria-expanded={menu === a.id}
              >
                <IconDots size={17} />
              </button>
            </div>
            {menu === a.id && (
              <div className="parcel-row-menu">
                {p.categoryControl && (
                  <label className="parcel-category-assignment">
                    Kategorie pozemku
                    <select
                      aria-label={`Kategorie pozemku ${a.name}`}
                      value={p.categoryControl.state.assignments[a.id] ?? ""}
                      onChange={(event) =>
                        p.categoryControl?.onAssign(
                          [a.id],
                          event.target.value || null,
                        )
                      }
                    >
                      <option value="">Bez kategorie</option>
                      {p.categoryControl.state.categories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEdit(a.id);
                    setDraft(a.name);
                    setError("");
                    setMenu(null);
                  }}
                >
                  <IconPencil size={15} />
                  Přejmenovat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(null);
                    setEdit(null);
                    p.onDelete(a.id);
                  }}
                >
                  <IconTrash size={15} />
                  Smazat pozemek
                </button>
              </div>
            )}
            {edit === a.id && (
              <form
                className="inline-editor"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!draft.trim()) {
                    setError("Zadejte název pozemku.");
                    return;
                  }
                  p.onRename(a.id, draft.trim());
                  setEdit(null);
                }}
              >
                <label>
                  Nový název
                  <input
                    autoFocus
                    maxLength={100}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                </label>
                {error && <p role="alert">{error}</p>}
                <div>
                  <button className="btn primary small" type="submit">
                    Uložit
                  </button>
                  <button
                    className="btn small"
                    type="button"
                    onClick={() => setEdit(null)}
                  >
                    Zrušit
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
      <div className="parcel-list-bottom">
        <div className="parcel-bulk-actions">
          {p.selectedIds.length >= 2 && (
            <>
              <button
                type="button"
                className="btn merge-action"
                onClick={() => setMerge(!merge)}
                disabled={!mergeStatus.allowed}
                aria-describedby={mergeDescriptionId}
              >
                <IconLayersIntersect size={17} />
                Spojit vybrané ({p.selectedIds.length})
              </button>
              <p
                id={mergeDescriptionId}
                className={`merge-eligibility${mergeStatus.allowed ? "" : " is-blocked"}`}
                role="status"
              >
                {!mergeStatus.allowed && (
                  <strong>
                    Spojit lze pouze pozemky, které spolu sousedí.
                  </strong>
                )}
                <span>{mergeStatus.reason}</span>
              </p>
              {merge && mergeStatus.allowed && (
                <form
                  className="inline-editor"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (mergeStatus.allowed && mergeName.trim()) {
                      p.onMerge(mergeName.trim());
                      setMerge(false);
                    }
                  }}
                >
                  <label>
                    Název spojené plochy
                    <input
                      value={mergeName}
                      maxLength={100}
                      onChange={(e) => setMergeName(e.target.value)}
                    />
                  </label>
                  <button className="btn primary small">
                    Vytvořit spojenou plochu
                  </button>
                </form>
              )}
            </>
          )}
          {p.selectedIds.length > 0 && p.onDeleteSelected && (
            <button
              className="btn danger small"
              type="button"
              onClick={() => {
                p.onDeleteSelected?.(
                  [...new Set(p.selectedIds)].filter((id) =>
                    p.areas.some((area) => area.id === id),
                  ),
                );
                setMenu(null);
                setEdit(null);
                setMerge(false);
              }}
            >
              <IconTrash size={16} />
              Odstranit vybrané ({p.selectedIds.length})
            </button>
          )}
        </div>
        <p>
          Vyberte pozemek v mapě nebo v seznamu. Zaškrtnutím označíte více ploch
          pro spojení.
        </p>
      </div>
    </aside>
  );
}
