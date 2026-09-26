import type { Config } from "tailwindcss";
// Shared with apps/mobile/tailwind.config.js — see ../../design-tokens.js and ../../DESIGN.md.
// An ESM import here (not a bare `require()` call) so this loads correctly regardless of
// whether Next's dev-server config loader treats this file as CJS or ESM — a bare
// `require()` intermittently crashed with "require is not defined" when the loader chose
// the ESM path, since `require` is only a global in CJS contexts. `import` compiles
// correctly either way given tsconfig's esModuleInterop.
import tokensImport from "../../design-tokens";

const tokens = tokensImport as unknown as {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  fontFamily: Record<string, string[]>;
};

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./sections/**/*.{js,ts,jsx,tsx,mdx}",
    // features/* holds most product UI (root CLAUDE.md §14.1). Missing from this list
    // until 2026-09-25, so any class used *only* inside a feature component (e.g. the
    // map preview card's z-[1000]/sm:w-80) was silently never generated.
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    // Border radius intentionally NOT overridden — Tailwind's default `xl` (12px) /
    // `2xl` (16px) / `3xl` (24px) already equal DESIGN.md's sm/md/lg exactly, and this
    // page's existing decorative markup (hero, waitlist, phone mockup) depends on
    // Tailwind's *other* default radii DESIGN.md doesn't define a tier for. Mapping for
    // new code: rounded-xl = DESIGN sm, rounded-2xl = DESIGN md, rounded-3xl = DESIGN lg.
    extend: {
      colors: {
        ...tokens.colors,
        // Decorative tint ramp of the single brand blue (#2563EB), used for gradients,
        // blurred glow shapes, and soft rings on the marketing page only — see
        // apps/web/design.md's "Visual Principles"/motion notes. Not part of DESIGN.md's
        // semantic token set (deliberately minimal there); this supplements it for
        // marketing-only decoration and must not be used for product/app UI.
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          500: "#2563EB",
          600: "#1D4ED8",
          700: "#1E40AF"
        }
      },
      spacing: tokens.spacing,
      fontFamily: {
        sans: tokens.fontFamily.sans,
        display: tokens.fontFamily.display
      },
      boxShadow: {
        // Pre-existing marketing-page decorative shadows.
        glow: "0 18px 70px rgba(37, 99, 235, 0.20)",
        soft: "0 18px 60px rgba(15, 23, 42, 0.10)",
        // DESIGN.md's Elevation & Depth: the two real system tiers above flat.
        card: "0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.08)",
        sheet: "0 8px 24px rgba(15,23,42,0.16)"
      }
    }
  },
  plugins: []
};

export default config;
