import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const content = fileURLToPath(new URL('../content-classic/generated', import.meta.url));
const contentRoot = fileURLToPath(new URL('../content-classic', import.meta.url));

export default defineConfig({
  base: './',
  // The original's music ships as MIDI files played by our own synthesiser.
  assetsInclude: ['**/*.mid'],
  resolve: {
    alias: {
      '@content': content,
      '@content-root': contentRoot,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        debug: fileURLToPath(new URL('./debug.html', import.meta.url)),
      },
    },
  },
});
