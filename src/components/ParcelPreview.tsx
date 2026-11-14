import {
  IconExternalLink,
  IconPlus,
  IconStack2,
  IconX,
} from "@tabler/icons-react";
import { areaHa } from "../lib/geo";
import { cadastralUrl, type ParcelFeature } from "../lib/openData";
import { parcelEligibility } from "../lib/parcelEligibility";
import {
  COVERAGE_STYLES,
  coverageDescription,
  type ParcelCoverage,
} from "../lib/parcelCoverage";
import "../parcel-discovery.css";

interface Props {
  feature: ParcelFeature;
  onAdd: () => void;
  onClose: () => void;
  /** Embedded variant is useful inside a lookup dialog. */
  embedded?: boolean;
  coverage?: ParcelCoverage;
}
export default function ParcelPreview({
  feature,
  onAdd,
  onClose,
  embedded = false,
  coverage,
}: Props) {
  const p = feature.properties,
    eligibility = parcelEligibility(feature);
  const officialM2 = Number(p.vymeraparcely);
  const area = areaHa(feature.geometry).toLocaleString("cs-CZ", {
    maximumFractionDigits: 3,
  });
  return (
    <section
      className={`parcel-preview${embedded ? " is-embedded" : ""}`}
      aria-label={`Náhled parcely ${p.cisloparcely}`}
    >
      <header>
        <div>
          <span className="eyebrow">Náhled z katastru</span>
          <h2>
            <IconStack2 size={20} />
            Parcela {String(p.cisloparcely ?? "bez čísla")}
          </h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Zavřít náhled parcely"
          onClick={onClose}
        >
          <IconX size={19} />
        </button>
      </header>
      <div className="parcel-preview-body" tabIndex={0}>
        <p className="parcel-preview-locality">
          Katastrální území {String(p.katastralniuzemi ?? "neuvedeno")}
        </p>
        <dl>
          <div>
            <dt>Druh pozemku</dt>
            <dd>{eligibility.landUse}</dd>
          </div>
          <div>
            <dt>Výměra</dt>
            <dd>{area} ha</dd>
          </div>
          {Number.isFinite(officialM2) && officialM2 > 0 && (
            <div>
              <dt>Evidováno v katastru</dt>
              <dd>{officialM2.toLocaleString("cs-CZ")} m²</dd>
            </div>
          )}
        </dl>
        <p
          className={`parcel-preview-note${eligibility.allowed ? "" : " is-blocked"}`}
        >
          {eligibility.allowed
            ? "Pozemek zatím není ve vašem seznamu. Přidáním si uložíte jeho výsadbu a ekonomické scénáře."
            : eligibility.reason}
        </p>
        {coverage && (
          <div className="parcel-preview-coverage">
            <strong style={{ color: COVERAGE_STYLES[coverage.state].color }}>
              Dostupnost dat
            </strong>
            <p>{coverageDescription(coverage)}</p>
          </div>
        )}
        <a
          className="parcel-preview-link"
          href={cadastralUrl(String(p.id))}
          target="_blank"
          rel="noreferrer"
        >
          Oficiální katastr ČÚZK <IconExternalLink size={14} />
        </a>
      </div>
      <div className="parcel-preview-actions">
        <button
          type="button"
          className="btn primary"
          onClick={onAdd}
          disabled={!eligibility.allowed}
        >
          <IconPlus size={18} />
          Přidat pozemek
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Zrušit
        </button>
      </div>
    </section>
  );
}
