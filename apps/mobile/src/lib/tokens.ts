// Re-exports the shared design tokens (../../../../design-tokens.js — see ../../../DESIGN.md)
// for call sites that need a raw JS color value: icon `color` props, ActivityIndicator,
// React Navigation's tabBarActiveTintColor/tabBarStyle, etc. — none of which accept a
// NativeWind className. Prefer className + tailwind.config.js wherever a className works;
// reach for this only where the API takes a literal value.
const tokens = require('../../../../design-tokens');

export const colors: Record<string, string> = tokens.colors;
