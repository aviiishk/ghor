// Type declarations for design-tokens.js — kept as a plain CommonJS file (not
// TypeScript) so apps/mobile's Metro-bundled tailwind.config.js can require() it without
// a build step (see that file's own header comment). This co-located .d.ts is what lets
// apps/web/tailwind.config.ts import it as a properly-typed ES module instead — TypeScript
// pairs a .d.ts with a same-named .js file automatically.
export const colors: Record<string, string>;
export const borderRadius: Record<string, string>;
export const spacing: Record<string, string>;
export const fontFamily: Record<string, string[]>;

declare const _default: {
  colors: typeof colors;
  borderRadius: typeof borderRadius;
  spacing: typeof spacing;
  fontFamily: typeof fontFamily;
};
export default _default;
