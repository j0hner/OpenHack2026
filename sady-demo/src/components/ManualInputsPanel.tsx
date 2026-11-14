import { useEffect, useId, useState, type FormEvent } from "react";
import {
  MANUAL_FIELDS,
  matchingRegionalData,
  normalizeManualInputs,
  parseManualValue,
  regionalClimateValue,
  type ManualFieldKey,
  type ManualInputs,
} from "../lib/manualInputs";
import type { AnalysisArea } from "../lib/types";
import "./manual-inputs.css";

type Draft = Record<ManualFieldKey, string>;
const makeDraft = (input?: ManualInputs): Draft =>
  Object.fromEntries(
    MANUAL_FIELDS.map(({ key }) => [
      key,
      input?.[key] === undefined ? "" : String(input[key]),
    ]),
  ) as Draft;

export interface ManualInputsPanelProps {
  area: AnalysisArea;
  /** Full validated object, or undefined to restore original open-data inputs. */
  onChange: (value: ManualInputs | undefined) => void;
}

export default function ManualInputsPanel({
  area,
  onChange,
}: ManualInputsPanelProps) {
  const input = normalizeManualInputs(area.manualInputs);
  const [draft, setDraft] = useState<Draft>(() => makeDraft(input));
  const [note, setNote] = useState(input?.note ?? "");
  const [errors, setErrors] = useState<Partial<Record<ManualFieldKey, string>>>(
    {},
  );
  const [message, setMessage] = useState("");
  const id = useId(),
    data = matchingRegionalData(area);
  const count = MANUAL_FIELDS.filter(
    ({ key }) => input?.[key] !== undefined,
  ).length;
  useEffect(() => {
    const next = normalizeManualInputs(area.manualInputs);
    setDraft(makeDraft(next));
    setNote(next?.note ?? "");
    setErrors({});
  }, [area.id, area.manualInputs]);
  useEffect(() => setMessage(""), [area.id]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: ManualInputs = {},
      problems: Partial<Record<ManualFieldKey, string>> = {};
    for (const { key } of MANUAL_FIELDS) {
      const parsed = parseManualValue(key, draft[key]);
      if (parsed.error) problems[key] = parsed.error;
      else if (parsed.value !== undefined) next[key] = parsed.value;
    }
    setErrors(problems);
    if (Object.keys(problems).length) {
      setMessage("Opravte označená pole. Výpočet se nezměnil.");
      return;
    }
    next.note = note;
    const normalized = normalizeManualInputs(next);
    onChange(normalized);
    setMessage(
      normalized
        ? "Ruční hodnoty jsou použité ve scénáři. Otevřená data zůstávají zachovaná."
        : "Výpočet opět používá původní otevřené podklady.",
    );
  };
  const reset = () => {
    setDraft(makeDraft());
    setNote("");
    setErrors({});
    onChange(undefined);
    setMessage(
      "Ruční hodnoty jsou zrušené. Chybějící otevřená data zůstávají neznámá.",
    );
  };
  const baseValue = (key: ManualFieldKey) => {
    if (key === "soilHpj") {
      if (!data?.soil?.valid || data.soil.coveragePct < 80)
        return "BPEJ nemá ověřené dostatečné pokrytí.";
      return `BPEJ: ${data.soil.parts.map((part) => `${part.name} (${part.percent.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} %)`).join("; ")}.`;
    }
    const observed = regionalClimateValue(data, key);
    return observed
      ? `Regionální podklad: ${observed.value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} · ${observed.years} skutečných let.`
      : "Pro tuto veličinu chybí nejméně 15 úplných ročních hodnot.";
  };

  return (
    <details className="manual-inputs-panel card">
      <summary>
        <strong>Vlastní vstupní údaje</strong>
        <span className={count ? "badge q-assumption" : "manual-inputs-count"}>
          {count ? `${count} ručních hodnot` : "Doplnit nebo přepsat"}
        </span>
      </summary>
      <p className="manual-inputs-explanation">
        Vyplněná pole mají ve výpočtu přednost. Prázdná převezmou dostupný
        regionální podklad, jinak zůstanou neznámá. Ruční hodnoty jsou neověřený
        uživatelský scénář, nikoli otevřená data nebo doložená patnáctiletá
        historie.
      </p>
      <p className="manual-inputs-soil-note">
        Reprezentativní HPJ přiřazujete celé plánované ploše. Pokud se půdy
        liší, pozemek rozdělte a hodnoty vyplňte zvlášť pro jednotlivé části.
        Změna těchto údajů sama nepotvrzuje budoucí výnos ani návratnost.
      </p>
      <form noValidate onSubmit={submit}>
        <div className="manual-inputs-fields">
          {MANUAL_FIELDS.map((field) => (
            <div className="manual-input-field" key={field.key}>
              <label htmlFor={`${id}-${field.key}`}>
                {field.label} <span>{field.unit}</span>
              </label>
              <input
                id={`${id}-${field.key}`}
                type="text"
                inputMode={field.integer ? "numeric" : "decimal"}
                value={draft[field.key]}
                maxLength={24}
                placeholder="Použít otevřená data"
                aria-invalid={!!errors[field.key]}
                aria-describedby={`${id}-${field.key}-base${errors[field.key] ? ` ${id}-${field.key}-error` : ""}`}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    [field.key]: event.target.value,
                  }))
                }
              />
              <small id={`${id}-${field.key}-base`}>
                {baseValue(field.key)}
              </small>
              {errors[field.key] && (
                <span
                  className="manual-input-error"
                  role="alert"
                  id={`${id}-${field.key}-error`}
                >
                  {errors[field.key]}
                </span>
              )}
            </div>
          ))}
        </div>
        <label className="manual-input-note" htmlFor={`${id}-note`}>
          Zdroj a období vlastních údajů <span>(volitelné)</span>
          <textarea
            id={`${id}-note`}
            value={note}
            maxLength={240}
            rows={2}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Např. vlastní dlouhodobá měření, půdní podklad…"
          />
        </label>
        <div className="manual-input-actions">
          <button type="submit" className="btn primary">
            Použít ve výpočtu
          </button>
          <button
            type="button"
            className="btn"
            onClick={reset}
            disabled={
              !count &&
              !MANUAL_FIELDS.some(({ key }) => draft[key].trim()) &&
              !note.trim()
            }
          >
            Zrušit ruční hodnoty
          </button>
        </div>
        <p
          className={`manual-input-feedback${Object.keys(errors).length ? " is-error" : ""}`}
          role="status"
        >
          {message}
        </p>
      </form>
    </details>
  );
}
