import { createServer } from "vite";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const originalStorage = globalThis.localStorage;
const originalDocument = globalThis.document;
const stored = new Map([["sady-demo-v1", "preserved user parcels"]]);
globalThis.localStorage = {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
};
globalThis.document = { documentElement: { dataset: {} } };
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom" });
try {
  const { readTheme, storeTheme, applyTheme, THEME_STORAGE_KEY } = await server.ssrLoadModule("/src/lib/theme.ts");
  const { default: ThemeToggle } = await server.ssrLoadModule("/src/components/ThemeToggle.tsx");
  const { default: SideNav } = await server.ssrLoadModule("/src/components/SideNav.tsx");
  assert.equal(readTheme(), "light");
  storeTheme("dark");
  assert.equal(readTheme(), "dark", "Reload must restore the explicit dark preference.");
  applyTheme(readTheme());
  assert.equal(document.documentElement.dataset.theme, "dark");
  for (const theme of ["light", "dark"]) {
    let chosen = null;
    const toggle = ThemeToggle({ theme, onChange: value => { chosen = value; } });
    const html = renderToStaticMarkup(toggle);
    assert(html.includes(theme === "dark" ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"));
    assert(html.includes('type="button"'), 'The always-accessible toggle uses native keyboard button behavior.');
    toggle.props.onClick();
    assert.equal(chosen, theme === "dark" ? "light" : "dark");
  }
  const navigation = renderToStaticMarkup(createElement(SideNav, { view: "mapa", onChange: () => {} }));
  assert(!navigation.includes("Nastavení"), 'Settings must be fully removed from navigation.');
  assert.equal([...navigation.matchAll(/<button\b/g)].length, 5);
  storeTheme("light");
  assert.equal(readTheme(), "light");
  stored.set(THEME_STORAGE_KEY, "unknown");
  assert.equal(readTheme(), "light", "Invalid stored preferences must have a safe default.");
  assert.equal(stored.get("sady-demo-v1"), "preserved user parcels");
  globalThis.localStorage = { getItem() { throw Error("Storage blocked"); }, setItem() { throw Error("Storage blocked"); } };
  assert.equal(readTheme(), "light");
  assert.doesNotThrow(() => storeTheme("dark"));
  assert.doesNotThrow(() => applyTheme("dark"));
  assert.equal(document.documentElement.dataset.theme, "dark");
  console.log(JSON.stringify({ checks: "OK", defaultLight: true, persistedDark: true, keyboardToggle: true, settingsRemoved: true, storageFailureTolerant: true, parcelStatePreserved: true }));
} finally {
  if (originalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originalStorage;
  if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
  await server.close();
}
