import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Self-contained sibling project: it only shares the repository's node_modules (three, vite,
// typescript). Everything else — sources, build output, render scripts — lives under legosw/.
const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 3000,
  },
  server: {
    fs: { strict: false },
  },
});
