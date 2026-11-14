import { useState } from "react";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import {
  createCategory,
  renameCategory,
  type CategoryControl,
} from "../lib/parcelCategories";
import "./parcel-categories.css";

export default function ParcelCategories({
  control,
}: {
  control: CategoryControl;
}) {
  const [draft, setDraft] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [newName, setNewName] = useState(""),
    [removing, setRemoving] = useState<string | null>(null),
    [error, setError] = useState("");
  return (
    <details className="parcel-category-manager">
      <summary>Správa kategorií</summary>
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
                    setRemoving(null);
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
                    setRemoving(category.id);
                    setEditing(null);
                  }}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            )}
            {removing === category.id && (
              <div className="category-removal">
                <p>
                  Odstranit kategorii „{category.name}“? Její pozemky zůstanou
                  uložené bez kategorie.
                </p>
                <div className="category-inline-actions">
                  <button
                    className="btn danger small"
                    type="button"
                    onClick={() => {
                      control.onDelete(category.id);
                      setRemoving(null);
                    }}
                  >
                    Odstranit kategorii
                  </button>
                  <button
                    className="btn small"
                    type="button"
                    onClick={() => setRemoving(null)}
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
