import { createServer } from 'vite';
import assert from 'node:assert/strict';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
try {
  const { coverageBoundsKey, hasMapPixelSizeChanged } = await server.ssrLoadModule('/src/lib/mapViewport.ts');
  const original = [16.8800001, 48.8500001, 16.9000001, 48.8600001];
  const drift = original.map(value => value + 1e-9);
  assert.equal(coverageBoundsKey(original), coverageBoundsKey(drift), 'Floating drift from a no-op fit must not restart the query.');
  assert.notEqual(coverageBoundsKey(original), coverageBoundsKey([16.881, 48.85, 16.901, 48.86]), 'An actual pan must discover its new viewport.');
  assert.equal(coverageBoundsKey(original), original.map(value => value.toFixed(6)).join(','), 'Hook and query cache must share their established coordinate precision.');
  const initial = { width: 1066, height: 836 };
  assert.equal(hasMapPixelSizeChanged(initial, initial), false, 'Initial/repeated ResizeObserver notifications must not refit.');
  assert.equal(hasMapPixelSizeChanged(initial, { width: 1066.0001, height: 835.9999 }), false, 'Subpixel reporting noise does not change Leaflet client pixels.');
  assert.equal(hasMapPixelSizeChanged(initial, { width: 1067, height: 836 }), true);
  assert.equal(hasMapPixelSizeChanged(initial, { width: 1066, height: 837 }), true);
  assert.equal(hasMapPixelSizeChanged(initial, { width: 390, height: 720 }), true, 'A real mobile/desktop resize must still update Leaflet.');
  assert.equal(hasMapPixelSizeChanged(initial, { width: 0, height: 0 }), false, 'Hidden/zero-sized surfaces cannot be refitted.');
  assert.equal(hasMapPixelSizeChanged(initial, { width: NaN, height: 836 }), false);
  console.log(JSON.stringify({ checks: 'OK', stableViewportKey: true, realPanChangesKey: true, noDuplicateResizeRefit: true, actualResizeHandled: true }));
} finally { await server.close(); }
