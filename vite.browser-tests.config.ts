import { defineConfig, mergeConfig } from 'vite';
import appConfig from './vite.config';

// Exercise the compiled map and storage worker together. A dev server may
// reload every open page when another test discovers a new dependency.
export default mergeConfig(appConfig, defineConfig({
  build: {
    outDir: 'dist-browser-tests',
    rollupOptions: { input: ['index.html', 'tests/harness.html'] },
  },
}));
