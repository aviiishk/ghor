import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
// Same shared tokens as apps/web and apps/mobile (../../design-tokens.js, ../../DESIGN.md).
import tokensImport from "../../design-tokens";

const tokens = tokensImport as unknown as {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  fontFamily: Record<string, string[]>;
};

// shadcn/ui + Bklit components use shadcn's semantic color names. They are mapped onto the
// CSS variables in app/globals.css, which are set FROM the GHOR tokens — so shadcn pieces
// render in GHOR's palette, not a generic theme. GHOR token names (primary, muted, …) stay
// as-is; only names GHOR doesn't already define are added here.
const semantic = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ...tokens.colors,
        background: semantic("background"),
        foreground: semantic("foreground"),
        card: { DEFAULT: semantic("card"), foreground: semantic("card-foreground") },
        popover: { DEFAULT: semantic("popover"), foreground: semantic("popover-foreground") },
        secondary: { DEFAULT: semantic("secondary"), foreground: semantic("secondary-foreground") },
        accent: { DEFAULT: semantic("accent"), foreground: semantic("accent-foreground") },
        "primary-foreground": semantic("primary-foreground"),
        "muted-foreground": semantic("muted-foreground"),
        "destructive-foreground": semantic("destructive-foreground"),
        border: semantic("border"),
        input: semantic("input"),
        ring: semantic("ring")
      },
      spacing: tokens.spacing,
      fontFamily: { sans: tokens.fontFamily.sans, display: tokens.fontFamily.display },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.08)",
        sheet: "0 8px 24px rgba(15,23,42,0.16)"
      }
    }
  },
  plugins: [animate]
};

export default config;
