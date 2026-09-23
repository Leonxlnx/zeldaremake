import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The optional owner-supplied music track (public/audio/README.md) is looked up here, once per
// dev-server start or build, so the page only requests a file that exists.
const MUSIC_CANDIDATES = ['audio/music.ogg', 'audio/music.mp3'];
const musicFiles = MUSIC_CANDIDATES.filter((rel) => existsSync(fileURLToPath(new URL(`./public/${rel}`, import.meta.url))));

// The world is served at the repo root. The director's monitor site lives in /site
// and is deployed separately (see .github/workflows/monitor.yml).
export default defineConfig({
  base: './',
  define: {
    __ZR_MUSIC_FILES__: JSON.stringify(musicFiles),
  },
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
