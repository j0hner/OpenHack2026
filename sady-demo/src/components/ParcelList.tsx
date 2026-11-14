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
}
export default function ParcelList(p: Props) {
  const mergeDescriptionId = useId();
  const [query, setQuery] = useState(""),
    [menu, setMenu] = useState<string | null>(null),
    [edit, setEdit] = useState<string | null>(null),
    [draft, setDraft] = useState(""),
    [error, setError] = useState(""),
    [remove, setRemove] = useState<string | null>(null),
    [merge, setMerge] = useState(false),
    [mergeName, setMergeName] = useState("Spojený pozemek");
  const shown = useMemo(
    () =>
      p.areas.filter((a) =>
        (a.name + " " + a.location.katastr)
          .toLocaleLowerCase("cs")
          .includes(query.toLocaleLowerCase("cs")),
      ),
    [p.areas, query],
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
      <div className="saved-parcels">
        {!shown.length && (
          <div className="list-empty">
            {query
              ? "Žádný pozemek neodpovídá hledání."
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
                  <strong>{a.name}</strong>
                  <small>
                    {fmtHa(areaHa(a.geometry))}
                    {a.derivedFrom ? " · uživatelská část" : ""}
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
                <button
                  type="button"
                  onClick={() => {
                    setEdit(a.id);
                    setDraft(a.name);
                    setError("");
                    setMenu(null);
                    setRemove(null);
                  }}
                >
                  <IconPencil size={15} />
                  Přejmenovat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRemove(a.id);
                    setMenu(null);
                    setEdit(null);
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
            {remove === a.id && (
              <div className="inline-editor">
                <p>Smazat pozemek z této aplikace? Katastr se nezmění.</p>
                <button
                  type="button"
                  className="btn danger small"
                  onClick={() => {
                    p.onDelete(a.id);
                    setRemove(null);
                  }}
                >
                  Potvrdit smazání
                </button>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => setRemove(null)}
                >
                  Zrušit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="parcel-list-bottom">
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
            <p id={mergeDescriptionId} className="merge-eligibility" role="status">
              {mergeStatus.reason}
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
        <p>
          Vyberte pozemek v mapě nebo v seznamu. Zaškrtnutím označíte více ploch
          pro spojení.
        </p>
      </div>
    </aside>
  );
}
