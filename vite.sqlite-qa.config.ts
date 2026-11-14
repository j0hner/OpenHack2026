import { defineConfig, mergeConfig } from 'vite';
import appConfig from './vite.config';

// Build the independent storage test page without adding SQLite or QA screens
// to the public map bundle. Preview it at /tests/harness.html.
export default mergeConfig(appConfig, defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-sqlite-qa',
    rollupOptions: { input: 'tests/harness.html' },
  },
}));
