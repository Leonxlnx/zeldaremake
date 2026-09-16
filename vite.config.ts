import { defineConfig } from 'vite';

// The world is served at the repo root. The director's monitor site lives in /site
// and is deployed separately (see .github/workflows/monitor.yml).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
  },
  server: {
    fs: { strict: false },
  },
});
