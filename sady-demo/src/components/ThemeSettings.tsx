import { IconMoon, IconSun } from "@tabler/icons-react";
import type { Theme } from "../lib/theme";

export default function ThemeSettings({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  return (
    <section className="card theme-settings">
      <h2>Vzhled aplikace</h2>
      <p>Zvolte světlý nebo tmavý režim. Volba se uloží v tomto prohlížeči.</p>
      <fieldset className="theme-options">
        <legend>Barevný režim</legend>
        {([
          { value: "light", label: "Světlý režim", Icon: IconSun },
          { value: "dark", label: "Tmavý režim", Icon: IconMoon },
        ] as const).map(({ value, label, Icon }) => (
          <label className={`theme-option${theme === value ? " active" : ""}`} key={value}>
            <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => onChange(value)} />
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
