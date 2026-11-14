import czechia from "../data/geo/czechia.json";

// Reuse the same public-domain Natural Earth boundary as the map. Correct the
// longitude scale at the country's latitude so its outline keeps its proportions.
const ring = czechia.geometry.coordinates[0];
const longitudeScale = Math.cos((50 * Math.PI) / 180);
const projected = ring.map(([lon, lat]) => [lon * longitudeScale, -lat]);
const west = Math.min(...projected.map(([x]) => x));
const north = Math.min(...projected.map(([, y]) => y));
const width = Math.max(...projected.map(([x]) => x)) - west;
const height = Math.max(...projected.map(([, y]) => y)) - north;
const scale = 20 / Math.max(width, height);
const xOffset = (24 - width * scale) / 2;
const yOffset = (24 - height * scale) / 2;
const path =
  projected
    .map(
      ([x, y], index) =>
        `${index ? "L" : "M"}${((x - west) * scale + xOffset).toFixed(2)},${((y - north) * scale + yOffset).toFixed(2)}`,
    )
    .join("") + "Z";

export default function CzechiaOutlineIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}
