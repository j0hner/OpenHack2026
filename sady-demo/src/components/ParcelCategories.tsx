import { useState } from "react";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import {
  createCategory,
  renameCategory,
  ALL_CATEGORIES,
  UNASSIGNED_CATEGORY,
  type CategoryControl,
} from "../lib/parcelCategories";
import "./parcel-categories.css";

export default function ParcelCategories({
  control,
  selectedIds = [],
  scope = ALL_CATEGORIES,
  onScopeChange,
}: {
  control: CategoryControl;
  selectedIds?: string[];
  scope?: string;
  onScopeChange?: (scope: string) => void;
}) {
  const [draft, setDraft] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [newName, setNewName] = useState(""),
    [error, setError] = useState("");
  return (
    <details className="parcel-category-manager">
      <summary>
        <span>Kategorie</span>
        <small>{control.state.categories.length || "volitelné"}</small>
      </summary>
      {onScopeChange && (
        <label className="parcel-category-filter">
          Zobrazit kategorii
          <select
            aria-label="Kategorie pozemků"
            value={scope}
            onChange={(event) => onScopeChange(event.target.value)}
          >
            <option value={ALL_CATEGORIES}>Všechny kategorie</option>
            <option value={UNASSIGNED_CATEGORY}>Bez kategorie</option>
            {control.state.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {selectedIds.length > 0 && (
        <label className="parcel-category-assignment">
          Zařadit vybrané ({selectedIds.length})
          <select
            value="__choose__"
            aria-label="Kategorie vybraných pozemků"
            onChange={(event) => {
              if (event.target.value !== "__choose__")
                control.onAssign(
                  [...new Set(selectedIds)],
                  event.target.value || null,
                );
            }}
          >
            <option value="__choose__" disabled>
              Vyberte kategorii…
            </option>
            <option value="">Bez kategorie</option>
            {control.state.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <form
        className="category-create"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            createCategory(control.state, draft, "__validation__");
            control.onCreate(draft.trim());
            setDraft("");
            setError("");
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure.message
                : "Kategorii se nepodařilo vytvořit.",
            );
          }
        }}
      >
        <label>
          Nová kategorie
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={60}
            placeholder="Např. Jižní svah"
          />
        </label>
        <button
          type="submit"
          className="btn small"
          aria-label="Přidat kategorii"
        >
          <IconPlus size={16} /> Přidat
        </button>
      </form>
      {error && (
        <p className="category-error" role="alert">
          {error}
        </p>
      )}
      {!control.state.categories.length && (
        <p className="category-help">
          Vytvořte kategorie pro souhrnné scénáře a přehlednější seznam.
        </p>
      )}
      <ul className="category-management-list">
        {control.state.categories.map((category) => (
          <li key={category.id}>
            {editing === category.id ? (
              <form
                className="category-create"
                onSubmit={(event) => {
                  event.preventDefault();
                  try {
                    renameCategory(control.state, category.id, newName);
                    control.onRename(category.id, newName.trim());
                    setEditing(null);
                    setError("");
                  } catch (failure) {
                    setError(
                      failure instanceof Error
                        ? failure.message
                        : "Kategorii se nepodařilo přejmenovat.",
                    );
                  }
                }}
              >
                <label>
                  Název kategorie
                  <input
                    autoFocus
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    maxLength={60}
                  />
                </label>
                <div className="category-inline-actions">
                  <button className="btn primary small" type="submit">
                    Uložit
                  </button>
                  <button
                    className="btn small"
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setError("");
                    }}
                  >
                    Zrušit
                  </button>
                </div>
              </form>
            ) : (
              <div className="category-management-row">
                <span>
                  {category.name}
                  <small>
                    {
                      Object.values(control.state.assignments).filter(
                        (id) => id === category.id,
                      ).length
                    }{" "}
                    pozemků
                  </small>
                </span>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Přejmenovat kategorii ${category.name}`}
                  onClick={() => {
                    setEditing(category.id);
                    setNewName(category.name);
                    setError("");
                  }}
                >
                  <IconPencil size={15} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Odstranit kategorii ${category.name}`}
                  onClick={() => {
                    setEditing(null);
                    control.onDelete(category.id);
                  }}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
