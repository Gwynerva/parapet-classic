/**
 * Ambient declarations for the content aliases (see vite.config.ts): `@playman` is
 * packages/content/playman/extracted (data extracted from the original), `@content` the
 * whole package (translations, Gwynerva's records and looks). Their shapes are declared by
 * hand where they are read, so the imports are typed as `unknown` here.
 */
declare module '@playman/*.json' {
  const value: unknown;
  export default value;
}

declare module '@playman/*.png' {
  const url: string;
  export default url;
}

declare module '@content/*.json' {
  const value: unknown;
  export default value;
}
