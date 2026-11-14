import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Hostname náhledu se předává přes proměnnou prostředí, aby v repozitáři
// nezůstávala žádná dočasná adresa. Bez ní Vite povolí jen výchozí lokální hosty.
declare const process: { env: Record<string, string | undefined> };
const previewHost = process.env.VITE_PREVIEW_HOST;

// base: './' => aplikace funguje na GitHub Pages i v podadresáři bez další konfigurace.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/leaflet/')) return 'map';
          if (/node_modules\/(?:@turf|polygon-clipping|polyclip-ts|splaytree|sweepline-intersections)\//.test(id)) return 'geometry';
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: previewHost ? [previewHost] : [],
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: previewHost ? [previewHost] : [],
  },
});
