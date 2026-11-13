const czNumber = new Intl.NumberFormat('cs-CZ');

export const fmtInt = (value: number): string => czNumber.format(Math.round(value));

export const fmtNum = (value: number, digits = 1): string =>
  new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

/** Výměra: do 10 ha dvě desetinná místa, výše jedno. */
export const fmtHa = (ha: number): string => `${fmtNum(ha, ha < 10 ? 2 : 1)} ha`;

export const fmtM = (m: number): string => `${fmtInt(m)} m`;

export const fmtKc = (value: number): string => `${czNumber.format(Math.round(value))} Kč`;

/** Zkrácené koruny pro grafy a souhrny (tis. Kč / mil. Kč). */
export const fmtKcShort = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}${fmtNum(abs / 1_000_000, 2)} mil. Kč`;
  if (abs >= 1_000) return `${sign}${fmtInt(abs / 1_000)} tis. Kč`;
  return `${sign}${fmtInt(abs)} Kč`;
};

export const fmtPct = (value: number, digits = 0): string => `${fmtNum(value, digits)} %`;
