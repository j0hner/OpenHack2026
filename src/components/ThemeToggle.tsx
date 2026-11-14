import { IconMoon, IconSun } from "@tabler/icons-react";
import type { Theme } from "../lib/theme";

/** Always available without a separate settings screen. */
export default function ThemeToggle({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
}) {
  const dark = theme === "dark";
  const Icon = dark ? IconSun : IconMoon;
  const action = dark ? "Přepnout na světlý režim" : "Přepnout na tmavý režim";
  return (
    <button
      type="button"
      className="theme-toggle icon-button"
      onClick={() => onChange(dark ? "light" : "dark")}
      aria-label={action}
      title={action}
    >
      <Icon size={19} stroke={1.7} aria-hidden="true" />
    </button>
  );
}
