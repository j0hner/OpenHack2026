import { useEffect, useId, useMemo, useState } from "react";
import {
  findMunicipalities,
  loadMunicipalities,
  municipalityToPlace,
  type Municipality,
  type MunicipalityResult,
} from "../lib/localitySearch";

interface Props {
  onSelect: (place: MunicipalityResult) => void;
}
export default function LocationSearch({ onSelect }: Props) {
  const id = useId().replaceAll(":", ""),
    listId = `localities-${id}`,
    statusId = `localities-status-${id}`;
  const [query, setQuery] = useState(""),
    [places, setPlaces] = useState<Municipality[] | null>(null),
    [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
      "idle",
    ),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(-1);
  const results = useMemo(
    () => (places ? findMunicipalities(places, query) : []),
    [places, query],
  );
  useEffect(() => {
    if (open && active >= 0 && results[active])
      document
        .getElementById(`${listId}-${results[active].code}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, results, listId]);
  const ensureLoaded = async () => {
    if (places || state === "loading") return;
    setState("loading");
    setError("");
    try {
      const list = await loadMunicipalities();
      setPlaces(list);
      setState("ready");
    } catch (e) {
      setState("error");
      setError(
        e instanceof Error && e.message.startsWith("Seznam obcí")
          ? e.message
          : "Seznam obcí se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu.",
      );
    }
  };
  const choose = (place: Municipality) => {
    const result = municipalityToPlace(place);
    setQuery(place.name);
    setOpen(false);
    setActive(-1);
    onSelect(result);
  };
  const message =
    query.trim().length < 2
      ? "Napište alespoň 2 znaky."
      : state === "loading"
        ? "Načítám obce a města ČR…"
        : state === "error"
          ? error
          : state === "ready" && results.length === 0
            ? "Žádná obec nenalezena. Zkuste jiný název nebo okres."
            : state === "ready"
              ? `${results.length} výsledků. Použijte šipky a Enter.`
              : "";
  return (
    <div
      className="location-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <label className="sr-only" htmlFor={`locality-input-${id}`}>
        Vyhledat obec nebo město v ČR
      </label>
      <div className="location-search-field">
        <input
          id={`locality-input-${id}`}
          className="location-search-input"
          type="search"
          role="combobox"
          aria-label="Vyhledat obec nebo město v ČR"
          placeholder="Hledat obec nebo město…"
          autoComplete="off"
          spellCheck={false}
          value={query}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-describedby={open ? statusId : undefined}
          aria-activedescendant={
            open && active >= 0 && results[active]
              ? `${listId}-${results[active].code}`
              : undefined
          }
          onFocus={() => {
            setOpen(true);
            void ensureLoaded();
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
            setOpen(true);
            void ensureLoaded();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setActive(-1);
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              void ensureLoaded();
              if (results.length)
                setActive((previous) =>
                  event.key === "ArrowDown"
                    ? (previous + 1) % results.length
                    : previous <= 0
                      ? results.length - 1
                      : previous - 1,
                );
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (open && results.length)
                choose(results[active >= 0 ? active : 0]);
            }
          }}
        />
        {query && (
          <button
            type="button"
            className="location-search-clear"
            aria-label="Vymazat vyhledávání"
            onClick={() => {
              setQuery("");
              setActive(-1);
              setOpen(true);
              document.getElementById(`locality-input-${id}`)?.focus();
            }}
          >
            Vymazat
          </button>
        )}
      </div>
      {open && (
        <div className="location-search-popup">
          <div
            id={statusId}
            className={`location-search-status${state === "error" ? " error" : ""}`}
            role="status"
            aria-live="polite"
          >
            {message}
          </div>
          {state === "error" && (
            <button
              type="button"
              className="location-search-retry"
              onClick={() => void ensureLoaded()}
            >
              Zkusit znovu
            </button>
          )}
          <ul
            id={listId}
            className="location-search-results"
            role="listbox"
            aria-label="Obce a města"
          >
            {results.map((place, index) => (
              <li role="presentation" key={place.code}>
                <button
                  type="button"
                  id={`${listId}-${place.code}`}
                  role="option"
                  aria-selected={active === index}
                  className={`location-search-option${active === index ? " active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(place)}
                >
                  <span className="location-search-option-name">
                    {place.name}
                  </span>
                  <span className="location-search-option-meta">
                    {place.district === "Hlavní město Praha"
                      ? "Hlavní město Praha"
                      : `okres ${place.district}`}{" "}
                    · RÚIAN {place.code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="location-search-source">
            ČÚZK / RÚIAN · obce a města celé ČR
          </div>
        </div>
      )}
    </div>
  );
}
