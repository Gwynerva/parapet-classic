/**
 * The game's build and dev server. The plugins live in `build/`: the dev server's helpers
 * (`devEndpoints.ts`), the published site's pages (`site.ts`) and offline play (`offline.ts`).
 */
import { defineConfig, loadEnv, type UserConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { devEndpointsPlugin } from './build/devEndpoints.ts';
import { offlinePlugin } from './build/offline.ts';
import { CONTENT, PLAYMAN, TAS_OUT } from './build/paths.ts';
import { DEFAULT_SITE_URL, sitePlugin } from './build/site.ts';
import { counterOrigin } from './src/app/counter.ts';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const site = (env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/?$/, '/');
  return config(command, site, counterOrigin(env.VITE_GOATCOUNTER ?? ''));
});

/** The configuration for a command (`serve`, `build`), the page's address and counter. */
function config(command: string, site: string, counter: string): UserConfig {
  return {
    base: './',
    // The dev server only: a build must not carry a path of the developer's machine.
    define: { TAS_OUT: JSON.stringify(command === 'serve' ? TAS_OUT.replace(/\\/g, '/') : '') },
    // The original's music ships as MIDI files played by our own synthesiser.
    assetsInclude: ['**/*.mid'],
    plugins: [devEndpointsPlugin(), sitePlugin(site, counter), offlinePlugin()],
    resolve: {
      alias: {
        '@playman': PLAYMAN,
        '@content': CONTENT,
      },
    },
    server: {
      port: 5173,
    },
    build: {
      target: 'es2022',
      assetsInlineLimit: 0,
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          debug: fileURLToPath(new URL('./debug.html', import.meta.url)),
          lab: fileURLToPath(new URL('./lab/index.html', import.meta.url)),
        },
      },
    },
  };
}
