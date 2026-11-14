import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  MANUAL_FIELDS,
  MANUAL_FIELD_HELP,
  manualFieldSources,
  matchingRegionalData,
  normalizeManualInputs,
  parseManualValue,
  regionalClimateValue,
  type ManualFieldKey,
  type ManualInputs,
} from "../lib/manualInputs";
import type { AnalysisArea, SuitabilityResult } from "../lib/types";
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
  score?: SuitabilityResult;
  focusNonce?: number;
  /** Full validated object, or undefined to restore original open-data inputs. */
  onChange: (value: ManualInputs | undefined) => void;
}

export default function ManualInputsPanel({
  area,
  score,
  focusNonce = 0,
  onChange,
}: ManualInputsPanelProps) {
  const input = normalizeManualInputs(area.manualInputs);
  const [draft, setDraft] = useState<Draft>(() => makeDraft(input));
  const [note, setNote] = useState(input?.note ?? "");
  const [errors, setErrors] = useState<Partial<Record<ManualFieldKey, string>>>(
    {},
  );
  const [message, setMessage] = useState("");
  const urgent =
    score?.overall === null &&
    (score.dataStatus === "insufficient" || score.dataStatus === "error");
  const [expanded, setExpanded] = useState(urgent);
  const panelRef = useRef<HTMLDetailsElement>(null);
  const id = useId(),
    data = matchingRegionalData(area);
  const count = MANUAL_FIELDS.filter(
    ({ key }) => input?.[key] !== undefined,
  ).length;
  const sources = manualFieldSources(area);
  const waitingForClimate =
    !!data?.deferred && !data.climate && !data.errors.length;
  if (waitingForClimate)
    for (const field of MANUAL_FIELDS) {
      if (field.key !== "soilHpj" && sources[field.key] === "needed")
        sources[field.key] = "pending";
    }
  const needed = MANUAL_FIELDS.filter(
    (field) => sources[field.key] === "needed",
  );
  const other = MANUAL_FIELDS.filter(
    (field) => sources[field.key] !== "needed",
  );
  useEffect(() => {
    const next = normalizeManualInputs(area.manualInputs);
    setDraft(makeDraft(next));
    setNote(next?.note ?? "");
    setErrors({});
  }, [area.id, area.manualInputs]);
  useEffect(() => setMessage(""), [area.id]);
  useEffect(() => {
    setExpanded(urgent);
  }, [area.id]);
  useEffect(() => {
    if (urgent) setExpanded(true);
  }, [urgent]);
  useEffect(() => {
    if (!focusNonce) return;
    setExpanded(true);
    const frame = requestAnimationFrame(() => {
      const input =
        panelRef.current?.querySelector<HTMLInputElement>(
          'input[data-manual-needed="true"]',
        ) ?? panelRef.current?.querySelector<HTMLInputElement>("input");
      let details = input?.closest("details");
      while (details && details !== panelRef.current) {
        details.open = true;
        details = details.parentElement?.closest("details") ?? null;
      }
      input?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [area.id, focusNonce]);

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
      : waitingForClimate
        ? "Na otevřený klimatický podklad čekáme; hodnota zatím není ověřená."
        : "Pro tuto veličinu chybí nejméně 15 úplných ročních hodnot.";
  };
  const renderField = (field: (typeof MANUAL_FIELDS)[number]) => {
    const missing = sources[field.key] === "needed";
    const origin =
      input?.[field.key] !== undefined
        ? "Vlastní údaj"
        : sources[field.key] === "open-data"
          ? "Z otevřených dat"
          : missing
            ? "Doplňte vlastní údaj"
            : waitingForClimate && field.key !== "soilHpj"
              ? "Čeká na klimatický podklad"
              : "Zatím neověřeno";
    return (
      <div
        className={`manual-input-field${missing ? " is-needed" : ""}`}
        key={field.key}
      >
        <div className="manual-input-field-heading">
          <label htmlFor={`${id}-${field.key}`}>
            {field.label} <span>{field.unit}</span>
          </label>
          <span className={`manual-input-origin ${sources[field.key]}`}>
            {origin}
          </span>
        </div>
        <input
          id={`${id}-${field.key}`}
          type="text"
          inputMode={field.integer ? "numeric" : "decimal"}
          value={draft[field.key]}
          maxLength={24}
          placeholder={
            missing
              ? "Zadejte ověřenou vlastní hodnotu"
              : "Ponechat automatický podklad"
          }
          data-manual-needed={missing}
          aria-invalid={!!errors[field.key]}
          aria-describedby={`${id}-${field.key}-base ${id}-${field.key}-help${errors[field.key] ? ` ${id}-${field.key}-error` : ""}`}
          onChange={(event) =>
            setDraft((previous) => ({
              ...previous,
              [field.key]: event.target.value,
            }))
          }
        />
        <small id={`${id}-${field.key}-base`}>{baseValue(field.key)}</small>
        <small className="manual-input-help" id={`${id}-${field.key}-help`}>
          {MANUAL_FIELD_HELP[field.key]}
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
    );
  };

  return (
    <details
      ref={panelRef}
      className={`manual-inputs-panel card${urgent ? " needs-input" : ""}`}
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <strong>
          {urgent ? "Doplnění chybějících údajů" : "Vlastní vstupní údaje"}
        </strong>
        <span className={count ? "badge q-assumption" : "manual-inputs-count"}>
          {urgent && needed.length
            ? `${needed.length} ${needed.length === 1 ? "údaj" : needed.length < 5 ? "údaje" : "údajů"} k doplnění`
            : count
              ? `${count} ručních hodnot`
              : "Doplnit nebo přepsat"}
        </span>
      </summary>
      {urgent && (
        <p className="manual-inputs-priority">
          {needed.length
            ? "Začněte zvýrazněnými poli níže. Dostupná data se použijí automaticky a nemusíte je opisovat."
            : "Společné podklady nestačí. Doplňte vlastní ověřené údaje nebo znovu ověřte zdroje; pouhé potvrzení prázdných polí data nedoplní."}
        </p>
      )}
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
          {(needed.length ? needed : MANUAL_FIELDS).map(renderField)}
        </div>
        {needed.length > 0 && other.length > 0 && (
          <details className="manual-other-fields">
            <summary>
              Zadané a dostupné údaje ({other.length}) · upravit
            </summary>
            <div className="manual-inputs-fields">{other.map(renderField)}</div>
          </details>
        )}
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
            Použít údaje a přepočítat
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
