import { createServer } from 'vite';
import assert from 'node:assert/strict';
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
try {
  const { initialMapLayers, LAYER_SETTINGS_VERSION } = await server.ssrLoadModule('/src/lib/mapPreferences.ts');
  assert(initialMapLayers(null).coverage);
  const old = { layers: { coverage: false, protected: false, bpej: true }, parcels: [{ id: 'preserved' }] };
  const before = JSON.stringify(old);
  const migrated = initialMapLayers(old);
  assert(migrated.coverage && migrated.protected && migrated.bpej);
  assert.equal(JSON.stringify(old), before, 'Upgrading map defaults must not change saved parcels or inputs.');
  const explicitOff = initialMapLayers({ ...old, layerSettingsVersion: LAYER_SETTINGS_VERSION });
  assert.equal(explicitOff.coverage, false, 'A deliberate toggle after upgrade must survive reload.');
  assert.equal(explicitOff.protected, true, 'Protected areas are a permanent overlay.');
  console.log(JSON.stringify({ checks: 'OK', automaticCoverageOnUpgrade: true, subsequentPreferenceRetained: true, protectedAlwaysOn: true, savedDataPreserved: true }));
} finally { await server.close(); }
