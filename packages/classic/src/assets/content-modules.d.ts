/**
 * Ambient declarations for the `@content` alias (packages/content-classic/generated, see vite.config.ts).
 * The generated files are not part of the repository, so their shapes are declared by hand in
 * `content.ts` and the imports are typed as `unknown` here.
 */
declare module '@content/*.json' {
  const value: unknown;
  export default value;
}

declare module '@content/*.png' {
  const url: string;
  export default url;
}
