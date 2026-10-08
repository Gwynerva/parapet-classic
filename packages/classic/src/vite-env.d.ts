/// <reference types="vite/client" />

/** Path of packages/tools/tas-out (dev server: `?tas=`). */
declare const TAS_OUT: string;

interface ImportMetaEnv {
  /** Anonymous visit counts (`app/analytics.ts`): a goatcounter.com code or an own address. */
  readonly VITE_GOATCOUNTER?: string;
}
