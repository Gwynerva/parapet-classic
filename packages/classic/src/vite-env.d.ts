/// <reference types="vite/client" />

/** Path of packages/tools/tas-out (dev server: `?tas=`). */
declare const TAS_OUT: string;

interface ImportMetaEnv {
  /** The site's code at goatcounter.com for anonymous visit counts (`app/analytics.ts`). */
  readonly VITE_GOATCOUNTER?: string;
}
