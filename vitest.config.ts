import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The app's content imports (`@content/...`), for tests of the app's modules.
    alias: { '@content': fileURLToPath(new URL('./packages/content', import.meta.url)) },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
  },
});
