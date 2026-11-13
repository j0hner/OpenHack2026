import type { ReactNode } from 'react';
import { QUALITY_LABELS } from '../data/provenance';
import type { DataQuality, VerdictClass } from '../lib/types';

const verdictClassOf = (verdictClass: VerdictClass): string => verdictClass;

export function VerdictBadge({ verdictClass, verdict }: { verdictClass: VerdictClass; verdict: string }) {
  return <span className={`badge ${verdictClassOf(verdictClass)}`}>{verdict}</span>;
}

export function QualityBadge({ quality }: { quality: DataQuality }) {
  const meta = QUALITY_LABELS[quality];
  return (
    <span className={`badge ${meta.className}`} title={meta.hint}>
      {meta.label}
    </span>
  );
}

export function ScoreGauge({
  score,
  verdictClass,
  verdict,
  caption,
}: {
  score: number | null;
  verdictClass: VerdictClass;
  verdict: string;
  caption: string;
}) {
  const colors: Record<string, string> = {
    good: '#2f7d4f',
    caution: '#c19a2f',
    risk: '#b4513c',
    nodata: '#8a8f98',
  };
  const color = colors[verdictClass] ?? colors.nodata;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;

  return (
    <div className="gauge" role="img" aria-label={score == null ? verdict : `Skóre ${score} ze 100, ${verdict}`}>
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={radius} fill="none" stroke="#e8ede6" strokeWidth="8" />
        <circle
          cx="46"
          cy="46"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="gauge-center">
        {score == null ? (
          <div className="gauge-nodata">Bez skóre</div>
        ) : (
          <>
            <div className="gauge-value" style={{ color }}>
              {score}
            </div>
            <div className="gauge-unit">/ 100</div>
          </>
        )}
      </div>
      <span className="sr-only">{caption}</span>
    </div>
  );
}

export function Meter({ value, tone = 'ok' }: { value: number; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className={`meter ${tone === 'warn' ? 'warn' : tone === 'bad' ? 'bad' : ''}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function NumberField({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
  title,
}: {
  label: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  title?: string;
}) {
  return (
    <label className="field" title={title}>
      <span className="field-label">{label}</span>
      <span className="input-unit">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) ? next : 0);
          }}
        />
        <span className="unit">{unit}</span>
      </span>
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="toggle-row" style={disabled ? { opacity: 0.6 } : undefined}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
      <span className="toggle-text">
        <b>{label}</b>
        {description && <span>{description}</span>}
      </span>
    </label>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="section-head">
      <div className="section-title">{children}</div>
      {right}
    </div>
  );
}

export function Info({ children, kind = 'info' }: { children: ReactNode; kind?: 'info' | 'warn' | 'error' | 'good' }) {
  return <div className={`notice ${kind}`}>{children}</div>;
}

export function severityIcon(severity: 'high' | 'medium' | 'low') {
  if (severity === 'high') return '▲';
  if (severity === 'medium') return '◆';
  return '●';
}
