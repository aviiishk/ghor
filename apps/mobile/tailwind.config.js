/** @type {import('tailwindcss').Config} */
const { colors, spacing, fontFamily } = require('../../design-tokens');

// Note on border-radius: DESIGN.md defines sm(12px)/md(16px)/lg(24px)/full, but this
// config deliberately does NOT override Tailwind's default radius scale — Tailwind's own
// `xl` (12px) / `2xl` (16px) / `3xl` (24px) already equal those values exactly, and
// screens already built (sign-in, verify-otp, onboarding) rely on Tailwind's *other*
// default radii (e.g. `rounded-lg` = 8px on small chips) that DESIGN.md doesn't define a
// tier for. Overriding the scale would silently break those. Mapping for new code:
// rounded-xl = DESIGN sm, rounded-2xl = DESIGN md, rounded-3xl = DESIGN lg, rounded-full = full.

module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      spacing,
      fontFamily: {
        sans: ['System', ...fontFamily.sans],
        display: ['System', ...fontFamily.display],
      },
    },
  },
  plugins: [],
};
