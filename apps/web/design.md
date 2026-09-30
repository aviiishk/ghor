# GHOR Web — Landing Page Design Notes

> **Canonical design system:** [`../../DESIGN.md`](../../DESIGN.md) — the cross-platform token set (colors, typography, spacing, shape, elevation, components) shared with `apps/mobile` lives there now. This file holds what's specific to the landing page: exact hero/section responsive sizing, motion timing, and copy tone. Where this file and `../../DESIGN.md` name the same token (e.g. `primary` blue, the two marketing typography tiers), they must match — `DESIGN.md` is the source of truth if they ever drift.

This file keeps the landing page visually consistent as new sections, copy, and components are added.

## Brand Direction

GHOR is a premium, trustworthy room and PG finder for Guwahati. The page should feel modern, spacious, conversion-focused, and local without becoming decorative or busy.

Design references: Linear, Raycast, Stripe, Airbnb, Vercel, Resend, and Awake Agency.

Primary goal: collect the first 100 waitlist users.

## Visual Principles

- Lead with clarity: every section should make the waitlist value easier to understand.
- Keep density moderate: enough detail to build trust, enough white space to feel premium.
- Use blue as the conversion color, not as a blanket tint over every surface.
- Prefer crisp cards, light borders, soft shadows, and restrained glass effects.
- Motion should feel subtle and useful: reveal content, lift cards, and gently float the phone mockup.
- Avoid generic stock-photo energy. The phone UI, room listing, chat, map pins, and city silhouette are the product visuals.

## Color Tokens

| Token | Hex | Usage |
| --- | --- | --- |
| Primary Blue | `#2563EB` | Primary buttons, active icons, progress, key highlights |
| Dark Blue | `#1D4ED8` | Button hover, gradient depth, emphasis |
| Background | `#FFFFFF` | Main page background |
| Section Background | `#F8FAFC` | Alternating sections |
| Text | `#0F172A` | Headings and strong labels |
| Muted | `#64748B` | Body copy and secondary text |
| Border | `#E2E8F0` | Cards, inputs, navbar, separators |
| Accent Amber | `#FBBF24` | Stars and small scarcity accents only |

Do not let the page become a single-hue blue interface. Use white, slate text, subtle gray surfaces, and very small amber accents to keep the palette balanced.

## Typography

Font: Inter.

- Hero heading: `72px` desktop, `44px` tablet, `36px` mobile.
- Section headings: `48px` desktop, `30px-36px` mobile.
- Card titles: `20px-24px`.
- Body copy: `16px-18px`, medium weight, relaxed line height.
- Buttons and nav labels: `14px`, bold.

Use `font-bold` for headings and important UI labels. Use `font-medium` for body text. Keep letter spacing normal.

## Layout

Global container: `min(1180px, calc(100% - 32px))`.

Section order:

1. Sticky Navbar
2. Hero
3. Waitlist
4. Features
5. How It Works
6. Testimonials
7. Final CTA
8. Footer

Hero layout: two columns on desktop, stacked on mobile. The phone mockup moves below the text on small screens.

Cards: use `16px-20px` radius for feature/testimonial/step cards. Do not nest cards inside cards.

## Components

### Navbar

- Sticky, rounded container, backdrop blur.
- Transparent at top, white glass with subtle shadow after scroll.
- Desktop: logo left, links center, CTA right.
- Mobile: logo left, compact Join CTA right.

### Buttons

Primary:

- Blue background.
- White text.
- Soft blue glow.
- Rounded `12px`.
- Arrow icon in the right side for conversion actions.

Secondary:

- White background.
- Light border.
- Slate text.
- Play icon for preview action.

All buttons should have hover lift and visible focus rings.

### Hero Visual

The phone mockup should include:

- GHOR mini logo.
- Room listing card.
- Owner chat conversation.
- Message input and send button.
- Floating map pins.
- Soft city silhouette.

Keep the mockup readable on mobile. Do not make it so large that it hides the waitlist card below the first viewport.

### Waitlist Card

Use a large blue gradient panel with:

- Scarcity label.
- First 100 users headline.
- 37/100 progress state.
- Name, email, phone fields.
- Primary "Reserve My Spot" button.
- Benefits row: No spam, Early access, Founding member perks.

The waitlist card is the main conversion surface. Any future edits should preserve its high contrast and central placement.

## Motion

Use Framer Motion for:

- Fade-up section reveal.
- Staggered cards.
- Floating phone animation.
- Button and card hover lift.

Keep durations between `0.2s` and `0.7s` for UI interactions. The phone float can loop around `5s`.

## Responsive Rules

Check these widths before release: `1440`, `1280`, `1024`, `768`, `480`, `375`.

- No text should overlap or overflow its button/card.
- Hero stacks below tablet widths.
- Feature and testimonial grids collapse from 3 columns to 2, then 1.
- Waitlist form stacks below the copy on smaller screens.
- Keep tap targets at least `44px` high.

## Copy Tone

Use concise, confident language. GHOR should sound useful and local, not hype-heavy.

Preferred phrases:

- GHOR-approved rooms and PGs (never "verified" for ordinary approval — "GHOR Verified" is reserved)
- direct owner chat
- first 100 users
- early access
- Guwahati students and professionals

Avoid:

- vague AI claims
- fake launch metrics
- exaggerated guarantees
- long paragraphs

## Accessibility

- Use semantic sections and headings.
- Buttons and icon links need accessible labels when text is not visible.
- Inputs require labels, even if visually hidden.
- Maintain visible keyboard focus states.
- Keep text contrast high, especially on blue gradient surfaces.

## Implementation Notes

- Keep shared data in `lib/data.ts`.
- Keep presentational primitives in `components/`.
- Keep page sections in `sections/`.
- Use Lucide React icons only for UI icons.
- Use Tailwind utility classes and local global helpers from `app/globals.css`.
- Keep the design asset-free unless a future image adds clear product value.
