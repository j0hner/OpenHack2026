import {
  IconMap,
  IconChartBar,
  IconLayersIntersect,
  IconAdjustmentsHorizontal,
  IconDatabase,
} from "@tabler/icons-react";
import logoWhite from "../assets/moje-sady-dark.webp";
export type AppView = "mapa" | "analyzy" | "pozemky" | "scenare" | "data";
const items = [
  ["mapa", "Mapa", IconMap],
  ["analyzy", "Analýzy", IconChartBar],
  ["pozemky", "Pozemky", IconLayersIntersect],
  ["scenare", "Scénáře", IconAdjustmentsHorizontal],
  ["data", "Data", IconDatabase],
] as const;
export default function SideNav({
  view,
  onChange,
}: {
  view: AppView;
  onChange: (v: AppView) => void;
}) {
  return (
    <aside className="main-nav">
      <a
        className="app-brand"
        href="#mapa"
        onClick={(e) => {
          e.preventDefault();
          onChange("mapa");
        }}
        aria-label="Moje Sady – mapa"
      >
        <span className="app-brand-mark" aria-hidden="true">
          <img src={logoWhite} alt="" width="36" height="42" />
        </span>
        <span>
          Moje
          <br />
          <strong>Sady</strong>
        </span>
      </a>
      <nav aria-label="Hlavní navigace">
        {items.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            className={view === id ? "active" : ""}
            onClick={() => onChange(id)}
            aria-current={view === id ? "page" : undefined}
          >
            <Icon size={19} stroke={1.7} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="nav-bottom">
        <span className="nav-local">Váš prostor pro zdravý sad</span>
        <small>Uloženo v tomto prohlížeči</small>
      </div>
    </aside>
  );
}
