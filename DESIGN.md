---
version: alpha
name: GHOR-design-system
description: |
  A trust-first property marketplace system anchored on GHOR Blue (#2563EB) and a warm-white/slate-cream canvas, built to read as credible and calm rather than flashy — the brand has to out-trust a broker, not out-decorate a lifestyle app. Type runs on native system fonts (SF Pro / Roboto, no licensed face) at confident-but-modest weights, in service of the actual load-bearing content: the rent figure, the locality name, the verified badge, the owner's chat reply. Shape language is soft and consistent — rounded-full pills for every button and chip, 16px-radius cards for listings and feature surfaces, 24px radius reserved for sheets and modals — with exactly one card shadow tier and no decorative gradients. The system spans two builds from one token set: the Expo mobile app (the product) and the Next.js web app (landing page today, admin moderation console next) — both draw from this file so "trust" reads identically whether a seeker is swiping listings or a founder is approving them.

colors:
  primary: "#2563EB"
  primary-pressed: "#1D4ED8"
  primary-light: "#EFF6FF"
  primary-disabled: "#BFDBFE"
  on-primary: "#FFFFFF"

  ink: "#0F172A"
  body: "#1E293B"
  muted: "#64748B"
  muted-soft: "#94A3B8"
  hairline: "#E2E8F0"
  hairline-soft: "#F1F5F9"

  canvas: "#FFFFFF"
  surface: "#F8FAFC"
  surface-card: "#FFFFFF"
  surface-sunken: "#F1F5F9"
  on-dark: "#FFFFFF"
  surface-dark: "#0F172A"
  scrim: "rgba(15,23,42,0.55)"

  success: "#22C55E"
  success-deep: "#15803D"
  success-pale: "#DCFCE7"
  warning: "#F59E0B"
  warning-deep: "#B45309"
  warning-pale: "#FEF3C7"
  destructive: "#EF4444"
  destructive-pressed: "#DC2626"
  destructive-pale: "#FEE2E2"
  focus-ring: "#93C5FD"

  chat-sent-bg: "#2563EB"
  chat-sent-text: "#FFFFFF"
  chat-received-bg: "#F1F5F9"
  chat-received-text: "#0F172A"

typography:
  marketing-hero:
    fontFamily: "-apple-system, 'SF Pro Display', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 72px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -1.5px
  marketing-section:
    fontFamily: "-apple-system, 'SF Pro Display', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -1px
  heading-xl:
    fontFamily: "-apple-system, 'SF Pro Display', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.4px
  heading-lg:
    fontFamily: "-apple-system, 'SF Pro Text', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0
  heading-md:
    fontFamily: "-apple-system, 'SF Pro Text', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0
  price-display:
    fontFamily: "-apple-system, 'SF Pro Display', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.5px
  body-md:
    fontFamily: "-apple-system, 'SF Pro Text', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-strong:
    fontFamily: "-apple-system, 'SF Pro Text', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: "-apple-system, 'SF Pro Text', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0
  body-sm-strong:
    fontFamily: "-apple-system, 'SF Pro Text', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: 0
  caption:
    fontFamily: "-apple-system, 'SF Pro Text', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  caption-strong:
    fontFamily: "-apple-system, 'SF Pro Text', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0.2px
  button-md:
    fontFamily: "-apple-system, 'SF Pro Text', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0
  button-sm:
    fontFamily: "-apple-system, 'SF Pro Text', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0
  link:
    fontFamily: "-apple-system, 'SF Pro Text', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0

rounded:
  none: 0px
  sm: 12px
  md: 16px
  lg: 24px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    padding: 14px 24px
    height: 52px
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  button-primary-disabled:
    backgroundColor: "{colors.primary-disabled}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    padding: 13px 23px
    height: 52px
    border: 1px solid {colors.primary}
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    padding: 14px 24px
    height: 52px
  button-tertiary-text:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
  button-icon-circular:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: 40px
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 14px 16px
    height: 52px
    border: 1px solid {colors.hairline}
  text-input-focused:
    border: 2px solid {colors.primary}
    rounded: "{rounded.sm}"
  otp-box:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.heading-lg}"
    rounded: "{rounded.sm}"
    size: 52px
    border: 1px solid {colors.hairline}
  search-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    padding: 12px 16px
    height: 48px
  filter-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm-strong}"
    rounded: "{rounded.full}"
    padding: 8px 16px
  filter-chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm-strong}"
    rounded: "{rounded.full}"
  amenity-chip:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.full}"
    padding: 6px 12px
  listing-card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 0px
  verified-badge:
    backgroundColor: "{colors.success-pale}"
    textColor: "{colors.success-deep}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  phone-verified-badge:
    backgroundColor: "{colors.success-pale}"
    textColor: "{colors.success-deep}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  property-verified-badge:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  response-rate-text:
    textColor: "{colors.muted}"
    typography: "{typography.caption}"
  last-active-text:
    textColor: "{colors.muted}"
    typography: "{typography.caption}"
  view-counter-text:
    textColor: "{colors.muted}"
    typography: "{typography.caption}"
  recently-viewed-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 8px
  new-listing-badge:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  status-pill-pending:
    backgroundColor: "{colors.warning-pale}"
    textColor: "{colors.warning-deep}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  status-pill-approved:
    backgroundColor: "{colors.success-pale}"
    textColor: "{colors.success-deep}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  status-pill-rejected:
    backgroundColor: "{colors.destructive-pale}"
    textColor: "{colors.destructive-pressed}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  status-pill-rented:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.muted}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  rating-display:
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
  review-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 16px
    border: 1px solid {colors.hairline}
  star-selector:
    textColor: "{colors.ink}"
    typography: "{typography.heading-lg}"
  owner-profile-header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.heading-md}"
    rounded: "{rounded.md}"
    padding: 20px
  notification-item:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    padding: 12px 16px
  notification-item-unread:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm-strong}"
    padding: 12px 16px
  map-toggle:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm-strong}"
    rounded: "{rounded.full}"
    padding: 8px 16px
  map-pin:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.full}"
    padding: 6px 12px
  map-pin-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.full}"
    padding: 6px 12px
  map-preview-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 0px
  skeleton-block:
    backgroundColor: "{colors.hairline-soft}"
    rounded: "{rounded.sm}"
  chat-bubble-sent:
    backgroundColor: "{colors.chat-sent-bg}"
    textColor: "{colors.chat-sent-text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 10px 14px
  chat-bubble-received:
    backgroundColor: "{colors.chat-received-bg}"
    textColor: "{colors.chat-received-text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 10px 14px
  quick-reply-chip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary}"
    typography: "{typography.body-sm-strong}"
    rounded: "{rounded.full}"
    padding: 8px 14px
    border: 1px solid {colors.primary-light}
  bottom-tab-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    height: 64px
    border-top: 1px solid {colors.hairline}
  top-app-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.heading-md}"
    height: 56px
  bottom-sheet:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 24px
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 12px 16px
  admin-data-table-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    border-bottom: 1px solid {colors.hairline}
  admin-sidebar-item-active:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary}"
    typography: "{typography.body-sm-strong}"
    rounded: "{rounded.sm}"
    padding: 10px 12px
  admin-stat-tile:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.heading-xl}"
    rounded: "{rounded.md}"
    padding: 20px
    border: 1px solid {colors.hairline}
  admin-bulk-action-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm-strong}"
    rounded: "{rounded.sm}"
    padding: 10px 16px
  admin-report-category-chip:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.full}"
    padding: 4px 10px
---

## Overview

GHOR sells trust, not delight. A renter's last experience with "finding a room" was a broker demanding ₹400 to unlock a door and ₹3,500 on the way out — so the visual system's entire job is to read as *more credible than that*, not as more entertaining than Instagram. Every token in this file exists in service of three moments: **the rent figure** (the number a seeker scans for first), **the verified badge** (the reason they trust it over a Facebook group), and **the Chat with Owner button** (the single action the whole app is built to produce). Nothing in the palette, type scale, or shape system should compete with those three things for attention.

The base canvas is white and slate-cream (`{colors.surface}` — #F8FAFC), carrying **GHOR Blue** (`{colors.primary}` — #2563EB) as the system's only saturated color — every primary CTA, every active tab icon, every "Chat with Owner" button, the verified checkmark's pale wash. Type runs on **native system fonts** (SF Pro on iOS, Roboto on Android — no licensed face, unlike the Pin Sans / Cereal VF systems this file was benchmarked against) at confident-not-loud weights: screen titles sit at 30px/700, not 70px — this is a utility app checked dozens of times a day, not a marketing site visited once. The one place type is allowed to get loud is `{typography.price-display}` (32px/700) on the rent figure — GHOR's equivalent of a "hero number," the single value every seeker is scanning for.

Shape language is soft and has exactly four tiers, same discipline as the reference systems this was built against: `{rounded.full}` for every button, chip, badge, and the search bar; `{rounded.md}` (16px) for listing cards and feature surfaces; `{rounded.lg}` (24px) reserved for bottom sheets and modals; `{rounded.sm}` (12px) for inputs and OTP boxes, sitting one notch tighter than cards so form fields don't compete visually with listing photography. There is no sharp corner anywhere in the product UI.

**This file is the single source of truth for both surfaces.** `apps/mobile/design.md` and `apps/web/design.md` hold screen-specific mockup mappings and layout notes but must not redefine a token that lives here — if a color, size, or radius needs to change, it changes here first.

**Wired into code, not just documented (2026-07-23):** every color, spacing value, and font stack above lives in code form in **[`/design-tokens.js`](../design-tokens.js)**, which both `apps/mobile/tailwind.config.js` and `apps/web/tailwind.config.ts` import — one file, not two hand-synced palettes. `apps/web` also had its typography brought into line: it was loading Plus Jakarta Sans + Playfair Display via `next/font/google`, which directly contradicted this file's "system fonts only" rule; that's been removed in favor of the same system stack `apps/mobile` uses. See the Iteration Guide for the one thing that's deliberately *not* wired as a literal override (border-radius).

**Key Characteristics:**
- Single-accent CTA: GHOR Blue (`{colors.primary}`) carries every primary action — "Chat with Owner," "Sign up," active tab state, verified checkmark. Reserve it; a screen with three blue elements competing is a screen that needs editing, not a new color.
- Native system type, not a licensed face — SF Pro / Roboto at modest weights (600—700 max), because this is a checked-often utility app, not a browsed-occasionally lifestyle brand.
- Four-tier shape system: `{rounded.sm}` (12px, inputs) — `{rounded.md}` (16px, cards) — `{rounded.lg}` (24px, sheets/modals) — `{rounded.full}` (buttons/chips/badges/search). No fifth tier, no sharp corners.
- The rent figure is the system's one "loud" typographic moment (`{typography.price-display}`, 32px/700) — everything else stays under 30px.
- Trust signals get their own color language: `{colors.success}` green is reserved exclusively for the verified badge and "approved" status — it never appears decoratively.
- Status pills (`pending` / `approved` / `rejected` / `rented`) share one visual grammar across the owner's My Listings screen *and* the admin moderation queue — a founder approving a listing and an owner checking its status should recognize the same pill.
- Chat bubbles: sent messages in solid `{colors.primary}`, received in flat `{colors.surface-sunken}` — no gradient bubbles, no shadow on bubbles, because this is a functional replacement for WhatsApp, not a differentiator to over-design.
- Exactly one elevation tier above flat (a soft ambient shadow on cards); a second, stronger tier only for sheets/modals sitting over a scrim. Buttons and chips never cast a shadow.

---

## Colors

> **Locked tokens — do not repaint.** `{colors.primary}` (#2563EB), `{colors.success}` (#22C55E), and `{colors.destructive}` (#EF4444) are already compiled into `apps/mobile` (the tab bar, the design-approved mockups in `assets/`) and must not change without updating those screens too. Everything else in this section formalizes and extends root `CLAUDE.md` §16.1 into a full production palette — semantically named, with pressed/disabled/pale variants the original 9-token table didn't cover.

### Brand & Accent
- **Primary** (`{colors.primary}` — #2563EB): the only saturated color in the system. Every primary button, the active tab icon, the "Chat with Owner"/"Sign up" CTAs, inline links, the sticky contact bar.
- **Primary Pressed** (`{colors.primary-pressed}` — #1D4ED8): press/active state for primary surfaces — one notch deeper, no added shadow.
- **Primary Light** (`{colors.primary-light}` — #EFF6FF): pale wash for amenity chips, quick-reply chip borders, admin sidebar's active-item background. This is the system's only "decorative" color use, and it's still just a tint of the one brand color.
- **Primary Disabled** (`{colors.primary-disabled}` — #BFDBFE): disabled-button fill. Text stays white — never gray-on-gray, which reads as broken rather than disabled.

### Surface
- **Canvas** (`{colors.canvas}` — #FFFFFF): true white — screen background default, card fill, modal fill, text input fill.
- **Surface** (`{colors.surface}` — #F8FAFC): the faint slate-cream wash — search bar fill, filter-chip default fill, tab bar background is canvas but screen backgrounds behind cards use this.
- **Surface Sunken** (`{colors.surface-sunken}` — #F1F5F9): one notch deeper than `surface` — received chat bubbles, rented-status pill fill, disabled input fill.
- **Surface Dark** (`{colors.surface-dark}` — #0F172A): rare near-black surface, reserved for the interstitial ad screen's neutral backdrop and any full-bleed image-overlay text scrim.
- **Scrim** (`{colors.scrim}` — rgba(15,23,42,0.55)): modal/bottom-sheet backdrop over page content.

### Text
- **Ink** (`{colors.ink}` — #0F172A): headlines, screen titles, primary body text, button labels on light surfaces.
- **Body** (`{colors.body}` — #1E293B): default paragraph copy where pure ink is too heavy — listing descriptions, chat message text on light bubbles.
- **Muted** (`{colors.muted}` — #64748B): metadata (locality, "2 days ago," amenity counts), inactive tab icon, placeholder text.
- **Muted Soft** (`{colors.muted-soft}` — #94A3B8): least-emphasis text — disabled labels, empty-state captions.
- **Hairline** (`{colors.hairline}` — #E2E8F0): 1px input borders, card dividers, tab-bar top border — matches the value already coded in `apps/mobile/app/(tabs)/_layout.tsx`.
- **Hairline Soft** (`{colors.hairline-soft}` — #F1F5F9): lighter inline divider, list-row separators.

### Semantic
- **Success** (`{colors.success}` — #22C55E): verified badge checkmark only — never a generic "good" color elsewhere.
- **Success Deep** (`{colors.success-deep}` — #15803D): text color paired with `success-pale` fills (verified badge label, approved-status pill text).
- **Success Pale** (`{colors.success-pale}` — #DCFCE7): verified-badge and approved-status pill background.
- **Warning** (`{colors.warning}` — #F59E0B): reserved for the `pending` moderation state — GHOR's trust gate (root `CLAUDE.md` §11) deserves its own color, distinct from destructive-red.
- **Warning Deep** / **Warning Pale**: text/fill pair for the pending-status pill, mirroring the success pair.
- **Destructive** (`{colors.destructive}` — #EF4444): report/flag actions, delete-account confirmation, form validation errors, admin "Reject" button.
- **Destructive Pressed** (`{colors.destructive-pressed}` — #DC2626): press state; also doubles as the rejected-status pill text color.
- **Destructive Pale** (`{colors.destructive-pale}` — #FEE2E2): rejected-status pill fill.
- **Focus Ring** (`{colors.focus-ring}` — #93C5FD): 2px outer outline on focused inputs/buttons, web only (RN has no visible focus ring on touch, but the admin dashboard — keyboard-and-mouse — needs one for accessibility).

### Chat
- **Chat Sent Background** (`{colors.chat-sent-bg}` — same as `{colors.primary}`): the seeker's/owner's own outgoing messages.
- **Chat Received Background** (`{colors.chat-received-bg}` — #F1F5F9): the other participant's messages. No third color for "system" messages — keep the thread binary and calm.

---

## Typography

### Font Family
GHOR runs **native system fonts** deliberately — SF Pro Display/Text on iOS, Roboto on Android, with a web-safe fallback stack (`-apple-system, 'SF Pro Text', Roboto, 'Segoe UI', Helvetica, Arial, sans-serif`) for `apps/web`. This is not a placeholder decision to "add a custom font later" — root `CLAUDE.md` §16.2 calls it out explicitly ("no custom font at MVP") and this file keeps that: a system font costs nothing, loads instantly, and matches what users already read every other app in. Unlike the Pin Sans / Cereal VF systems this file was benchmarked against, there is no licensed-face substitution question to solve here.

### Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `{typography.marketing-hero}` | 72px | 700 | 1.05 | `apps/web` landing hero only — never inside the product |
| `{typography.marketing-section}` | 48px | 700 | 1.1 | `apps/web` landing section headings |
| `{typography.heading-xl}` | 30px | 700 | 1.2 | App screen titles ("Browse", "My Listings"), admin stat-tile numbers |
| `{typography.heading-lg}` | 22px | 600 | 1.25 | Modal/bottom-sheet titles, OTP box digits |
| `{typography.heading-md}` | 18px | 600 | 1.3 | Top app bar title, listing-card title, section subheads |
| `{typography.price-display}` | 32px | 700 | 1.15 | **The rent figure** on listing detail — the system's one loud typographic moment |
| `{typography.body-md}` | 16px | 400 | 1.5 | Default paragraph, chat message text, form field values |
| `{typography.body-strong}` | 16px | 600 | 1.5 | Form labels, emphasis inline |
| `{typography.body-sm}` | 14px | 400 | 1.45 | Card metadata (locality, date), footer copy |
| `{typography.body-sm-strong}` | 14px | 600 | 1.45 | Filter chip labels, quick-reply chip labels |
| `{typography.caption}` | 12px | 400 | 1.4 | Timestamps, helper text |
| `{typography.caption-strong}` | 12px | 700 | 1.3 | Badges, status pills, amenity chip labels |
| `{typography.button-md}` | 16px | 700 | 1 | Primary/secondary button labels |
| `{typography.button-sm}` | 13px | 700 | 1 | Compact chip/icon-button labels |
| `{typography.link}` | 15px | 600 | 1.4 | Inline links ("Already have an account? Log in") |

### Principles
The jump from `{typography.heading-xl}` (30px) to `{typography.price-display}` (32px) is deliberately small in size but distinct in *placement* — price-display always sits alone, large, at the top of the listing-detail info block, never inline with other text, so it reads as the one number worth memorizing. Everywhere else, hierarchy comes from weight (400 — 600 — 700) and color (ink — body — muted), not from size jumps — this keeps the type scale calm on a screen a seeker checks 20 times a day.

### Note on Marketing vs. Product Type
`{typography.marketing-hero}` and `{typography.marketing-section}` exist **only** for `apps/web`'s public landing page (see `apps/web/design.md`, which predates and still governs that page's exact hero/section sizing at each breakpoint). Never use them inside `apps/mobile` or the admin dashboard — the product itself should never feel like it's marketing at you.

---

## Layout

### Spacing System
- **Base unit:** 4px, scaling through `{spacing.xxs}` (4px) Â· `{spacing.xs}` (8px) Â· `{spacing.sm}` (12px) Â· `{spacing.md}` (16px) Â· `{spacing.lg}` (24px) Â· `{spacing.xl}` (32px) Â· `{spacing.xxl}` (48px) Â· `{spacing.section}` (64px, `apps/web` only).
- **Screen padding:** `{spacing.md}` (16px) horizontal on every mobile screen — listing feed, detail, chat, forms.
- **Card internal padding:** listing cards are full-bleed image with no padding around the photo (photo touches the card edge, same discipline as the reference systems' pin/property cards) — metadata block beneath uses `{spacing.md}` (16px) padding.
- **List/form field gaps:** `{spacing.sm}` (12px) between stacked inputs; `{spacing.lg}` (24px) between distinct form sections (e.g., "Basic details" vs. "Amenities" in the create-listing form).
- **Chat bubble gaps:** `{spacing.xxs}` (4px) between consecutive bubbles from the same sender, `{spacing.sm}` (12px) between a switch in sender.

### Grid & Container
- **Mobile:** single-column throughout — no multi-column layouts anywhere in `apps/mobile`. The browse feed is a single-column list of full-width listing cards (not a masonry grid — unlike the Pinterest reference this was benchmarked against, GHOR's cards need consistent width for the rent/locality/amenity metadata block to align, so photos crop to a fixed aspect ratio rather than tiling at their natural ratio).
- **Web landing (`apps/web`):** container `min(1180px, calc(100% - 32px))` — unchanged from the existing `apps/web/design.md`.
- **Admin dashboard (`apps/web/admin`, not yet built):** 2-column app shell — fixed 240px left sidebar (`{component.admin-sidebar-item-active}` etc.) + fluid content area capped at ~1400px, holding data tables and stat-tile rows.

### Whitespace Philosophy
Generous whitespace on anything marketing/onboarding (sign-in, OTP, onboarding screens already built use full-bleed centered layouts with room to breathe), tight and dense on anything transactional (the browse feed, the chat thread, the admin data table) — a seeker scanning ten listings in ten seconds needs density; a first-time visitor deciding whether to trust GHOR needs air. This mirrors the reference systems' "editorial vs. discovery" split, adapted from marketing-vs-search to onboarding-vs-product.

---

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | No shadow; `{colors.hairline}` border only where separation is needed | Inputs, filter chips, tab bar, chat bubbles, status pills — the default for nearly everything |
| 1 — Card ambient | Soft shadow: `0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.08)` | Listing cards, feature cards, admin stat tiles |
| 2 — Sheet/modal | `{colors.scrim}` backdrop + stronger shadow: `0 8px 24px rgba(15,23,42,0.16)` | Bottom sheets (report/flag, filters), the login/OTP modal-equivalent flows, image lightbox |

GHOR has exactly one shadow tier above flat, same discipline as both reference systems this file drew from — buttons, chips, and badges never cast a shadow, no matter how "primary" the action. Depth communicates hierarchy (this is a distinct surface floating over the page) but never decoration. On Android specifically, keep elevation values modest (`elevation: 2` / `elevation: 8` equivalents) — heavy Material shadows read as dated against this otherwise flat system.

### Touch/Press Feedback (mobile has no hover)
Neither reference system's hover states apply to `apps/mobile` — there is no cursor. Press feedback is opacity (`activeOpacity: 0.7`) on cards and icon buttons, and the `-pressed` color swap (already tokenized above) on filled buttons. Do not simulate a "hover lift" shadow on touch — it reads as laggy, not responsive.

---

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Full-bleed hero images, the web navbar/footer, sharp structural bands |
| `{rounded.sm}` | 12px | Text inputs, OTP boxes, toast notifications — one notch tighter than cards, so forms read as "input," not "card" |
| `{rounded.md}` | 16px | Listing cards, feature cards, admin stat tiles — the dominant component radius |
| `{rounded.lg}` | 24px | Bottom sheets, modals, image lightbox — reserved for surfaces that float over the whole screen |
| `{rounded.full}` | 9999px | Every button, every chip, every badge, the search bar, avatars, the verified checkmark circle |

Four tiers, no more — if a new component seems to need a fifth radius value, it should probably be expressed with one of the four above instead (see Iteration Guide).

### Photography Geometry
- **Listing photos (feed card):** fixed 4:3 landscape crop inside `{rounded.md}` top corners only (card metadata sits beneath, not overlaid) — unlike the Pinterest/Airbnb references, GHOR crops to a consistent ratio rather than preserving natural aspect ratio, because the rent/locality text block below needs a predictable card height across a scrolling feed of very different room photos.
- **Listing photos (detail gallery):** full-width, natural aspect ratio, swipeable, `{rounded.none}` (the gallery is the top of the screen, no surrounding card).
- **Avatars / owner profile circles:** 40px at `{rounded.full}`.
- **Verified badge icon:** a filled circle at `{rounded.full}`, `{colors.success}` fill, white checkmark glyph, 16px diameter, always paired inline with the owner's name — never floating alone.

---

## Components

### Buttons
**`button-primary`** — `{colors.primary}` fill, white text, `{rounded.full}`, 52px height, `{typography.button-md}`. Every primary CTA in the system: "Chat with Owner," "Call," "Sign up," "Post Listing," "Reserve My Spot" (web waitlist). Always paired with a trailing arrow glyph on conversion actions, per the existing convention in root `CLAUDE.md` §16.3.
**`button-primary-pressed`** — fill drops to `{colors.primary-pressed}`, no shadow change, no scale transform.
**`button-primary-disabled`** — fill drops to `{colors.primary-disabled}`, text stays white.
**`button-secondary`** — white fill, `{colors.primary}` text and 1px border, `{rounded.full}`. Paired secondary actions: "Not now," "Cancel," "Log in" next to a primary "Sign up."
**`button-destructive`** — `{colors.destructive}` fill, white text. Confirmation step only ("Delete Account," "Confirm Report") — never a first-tap action.
**`button-tertiary-text`** — no fill, `{colors.ink}` text. Low-emphasis actions ("Skip," "Edit," "See all").
**`button-icon-circular`** — `{colors.surface}` fill, 40px circle. Back button, share icon, gallery-close icon.

### Inputs
**`text-input`** / **`text-input-focused`** — white fill, `{rounded.sm}` (12px), 1px `{colors.hairline}` border default, 2px `{colors.primary}` border on focus. Used for every form field: phone number, listing title, description, locality.
**`otp-box`** — four individual 52px square boxes, `{rounded.sm}`, digit centered in `{typography.heading-lg}`. Matches the already-designed 4-digit verification screen.
**`search-bar`** — `{colors.surface}` fill, `{rounded.full}`, magnifier icon left, placeholder in `{typography.body-md}` muted. Anchors the top of the browse feed.

### Chips & Badges
**`filter-chip`** / **`filter-chip-active`** — default `{colors.surface}` fill with ink text; active flips to solid `{colors.primary}` fill with white text. City, rent-range, room/flat, amenity, and **nearby-institution** toggle filters (root `CLAUDE.md` §2 — no new component needed for institution filtering, this one already covers it).
**`amenity-chip`** — `{colors.primary-light}` fill, `{colors.primary}` text, small icon + label, `{rounded.full}`. Read-only — shown on cards and detail pages, not tappable. Also doubles as the **institution tag** display on a listing card/detail (e.g., "Near Royal Global University") — same token, no separate component, just a different label source.

**Three distinct trust badges — added 2026-07-23 (root `CLAUDE.md` §2 "Trust & quality signals"). Deliberately not the same visual weight; they mean different things and must stay visually distinguishable, not just label-distinguishable:**
- **`verified-badge`** ("Verified by GHOR") — `{colors.success-pale}` fill, `{colors.success-deep}` text, small checkmark icon, `{rounded.full}`. Derived from listing `status = approved`. Sits on the listing card/detail page, not the owner.
- **`phone-verified-badge`** — same success-pale/success-deep family as `verified-badge` but with a phone icon, not a checkmark, and its own label ("Phone Verified"). Sits on the **owner's** profile/name, derived from `profiles.phone_verified` — cheap, automatic, no admin review.
- **`property-verified-badge`** ("Property Verified") — **`{colors.primary-light}` fill, `{colors.primary}` text** (deliberately blue, not green, so it reads as a stronger/rarer signal than the other two). Derived from `listings.property_verified`, set only by an admin/agent after in-person or photo verification (§2). Never shown unless that verification actually happened — this is the one badge on this page that represents real, costly work, and diluting it by auto-granting it would make it worthless.

**`new-listing-badge`** — `{colors.surface}` fill, `{colors.muted}` text, `{rounded.full}`. Now specifically for listings with **zero reviews** (`review_count = 0`) — the ratings question itself is resolved (root `CLAUDE.md` §2, reviews are real scope), this badge just covers the "too new to have any yet" case. Never show a `0.0` or fabricated rating in its place.
**Status pills** (`status-pill-pending` / `-approved` / `-rejected` / `-rented`) — shared grammar across the owner's My Listings screen and the (not-yet-built) admin moderation queue. Warning-amber / success-green / destructive-red / sunken-gray respectively, always `{rounded.full}`, always `{typography.caption-strong}`.

**Metadata text tokens** (not badges — plain small text, no fill/border): **`response-rate-text`**, **`last-active-text`**, **`view-counter-text`** — all `{typography.caption}` in `{colors.muted}`. Examples: "Usually replies within 1 hour," "Active 2 days ago," "14 people viewed today." Keep these as quiet metadata, not badges — they're supporting signals, not the headline trust claim the three badges above are.

### Cards
**`listing-card`** — `{colors.surface-card}` fill, `{rounded.md}`, no padding around the photo. Photo (4:3, top corners rounded) + metadata block beneath: title (`{typography.heading-md}`), rent (`{typography.price-display}` at detail scale, a smaller `{typography.body-strong}` variant on the feed card itself to keep card height sane), locality (`{typography.body-sm}` muted), amenity chip row, institution-tag chip row (`amenity-chip` token, e.g. "Near Royal Global University" — only rendered if the owner tagged any), `verified-badge` + `view-counter-text` inline, owner name with `phone-verified-badge` + `response-rate-text`/`last-active-text` beneath it.
**`recently-viewed-item`** — `{colors.surface}` fill, `{rounded.md}`, compact row (thumbnail + title + rent), `{typography.body-sm}`. Client-side only (local device cache, not a backend list) — see root `CLAUDE.md` §2's distinction from the deferred full favorites system.

### Reviews & Ratings (added 2026-07-23 — root `CLAUDE.md` §2)
**`rating-display`** — deliberately restrained: a small filled star icon in `{colors.ink}` (not gold/amber — same reasoning Airbnb itself uses for its own star icon, see the Pinterest/Airbnb reference analyses this system was benchmarked against: colored stars read as decorative, ink reads as data) + the number in `{typography.body-strong}` + review count in `{typography.body-sm}` muted, e.g. "★ 4.8 (23)". Replaces `new-listing-badge` once a listing has `review_count > 0`. **Never a second loud typographic moment** — `{typography.price-display}` stays the system's one hero number; ratings are real but quiet, per the Do's/Don'ts below.
**`review-card`** — white fill, `{rounded.md}`, 1px hairline border, 16px padding. Reviewer name + `rating-display` (this instance's own rating, not the aggregate) + `{typography.body-sm}` comment + relative date. Stacked in a list on listing detail, most recent first.
**`star-selector`** — five tappable star icons at `{typography.heading-lg}` size, `{colors.ink}` when filled, `{colors.hairline}` when empty. The only input control in the system that isn't a `text-input`/`otp-box`/chip — used solely on the gated "Write a review" screen.

### Map (added 2026-07-23 — root `CLAUDE.md` §2, provider not yet chosen)
**`map-toggle`** — a two-option segmented control ("List" / "Map") anchored at the top of the browse feed, `{colors.surface}` default / `{colors.primary}` active per the existing `filter-chip`/`filter-chip-active` pattern (reused, not a new toggle mechanism).
**`map-pin`** / **`map-pin-active`** — a small rounded pill showing the listing's rent (e.g. "₹7k"), `{colors.ink}` fill by default, flips to `{colors.primary}` when its corresponding preview card is open. Airbnb-style price-on-the-pin, not a generic teardrop marker — the price is the information worth surfacing at map-glance scale.
**`map-preview-card`** — a compact `listing-card` variant (same token, reduced content: photo + title + `price-display` only, no amenity/badge rows) that floats over the map when a pin is tapped.

### Chat
**`chat-bubble-sent`** / **`chat-bubble-received`** — `{rounded.md}`, no shadow, no tail/pointer graphic (a flat modern bubble, not a skeuomorphic speech-bubble shape). Sent bubbles right-aligned in solid `{colors.primary}`; received bubbles left-aligned in flat `{colors.surface-sunken}`.
**`quick-reply-chip`** — white fill, `{colors.primary}` text and border, `{rounded.full}`. The four hardcoded suggestions ("Is parking available?" etc.) per root `CLAUDE.md` §16.6 — tapping inserts text, never auto-sends.

### Navigation
**`bottom-tab-bar`** — white fill, 64px height, 1px `{colors.hairline}` top border. **Role-conditional tab count (2026-07-23):** seekers get 3 tabs (Home / Chat / Profile) — already implemented in `apps/mobile/app/(tabs)/_layout.tsx`, this entry formalizes those exact values as the system token. Owners get a 4th tab, **Listings**, inserted between Home and Chat (their own listings + status pills + "+ New Listing"). Home renders the same Browse-feed content for both roles — the tab bar grows by one tab for owners, nothing about Home's content changes. See `apps/mobile/design.md`'s Mobile-only conventions for the full reasoning.
**`top-app-bar`** — white fill, 56px height, `{typography.heading-md}` centered or left-aligned title depending on screen, back-chevron icon-button when not a root tab screen.

### Overlays
**`bottom-sheet`** — white fill, `{rounded.lg}` on top corners only, floats over `{colors.scrim}`, 24px internal padding. Used for report/flag reason selection, filter panels, and the share sheet.
**`toast`** — `{colors.ink}` fill, white text, `{rounded.sm}`, bottom-anchored, auto-dismiss. Non-blocking confirmations ("Listing saved," "Message sent").

### Notifications & Owner Profile (added 2026-07-23 — root `CLAUDE.md` §2)
**`notification-item`** / **`notification-item-unread`** — a plain list row (icon + text + relative timestamp), no card/border. Unread flips the background to `{colors.primary-light}` and the text weight to `{typography.body-sm-strong}` — the only visual difference; no separate unread dot/badge needed. Matters most on `apps/web`, which gets no mobile push at all — this list is the primary "catch up" surface there.
**`owner-profile-header`** — white fill, `{rounded.md}`, 20px padding. Avatar/initials circle, name, the three trust badges inline (`verified-badge` doesn't apply here — this is `phone-verified-badge` and, if applicable, the ID-verification state), `response-rate-text`, member-since caption, followed by a `listing-card` grid/list of their other approved listings. The Airbnb "host profile" analog.

### Admin (`apps/web/admin`, not yet built — see root `CLAUDE.md` §14.10)
**`admin-sidebar-item-active`** — `{colors.primary-light}` fill, `{colors.primary}` text, `{rounded.sm}`. Inactive items are transparent with `{colors.muted}` text.
**`admin-data-table-row`** — white fill, 1px `{colors.hairline-soft}` bottom rule, no zebra striping (striping competes with the status-pill color coding within each row).
**`admin-stat-tile`** — `{colors.surface-card}` fill, `{rounded.md}`, 1px hairline border, the big number in `{typography.heading-xl}`, label beneath in `{typography.body-sm}` muted. Elevation level 1 (card ambient shadow).
**`admin-bulk-action-bar`** — `{colors.ink}` fill, white text, `{rounded.sm}`, appears pinned above the data table when 1+ rows are selected ("3 selected — Approve all / Reject all"). Added 2026-07-23 alongside bulk-approve/reject (root `CLAUDE.md` §2).
**`admin-report-category-chip`** — `{colors.surface-sunken}` fill, ink text, `{rounded.full}`, `{typography.caption-strong}`. Renders `reports.reason_category` (spam/fake/inappropriate/other) as a filter/breakdown chip in the Reports section — added 2026-07-23.

Once the admin dashboard is actually built, expect it to add **shadcn/ui** primitives (root `CLAUDE.md` §3) on top of these tokens — shadcn's own component defaults (dialog, toast, dropdown) should be reskinned to these colors/radii, not left at shadcn's default slate/zinc theme.

---

## Do's and Don'ts

### Do
- Reserve `{colors.primary}` for the one primary action per screen. If a screen has "Chat with Owner," "Call," and a filter-chip all trying to be blue and filled, at least two of them need to step down to secondary/tertiary treatment.
- Keep `{typography.price-display}` alone and prominent — it is the system's one intentionally loud typographic moment. Don't shrink it to fit inline with other metadata.
- Pair the verified badge with the owner's name every time it appears — never show the green checkmark as a standalone decorative element.
- Keep the three trust badges (`verified-badge`, `phone-verified-badge`, `property-verified-badge`) visually distinct, per their component specs above — a seeker should be able to tell "the listing was approved" apart from "someone actually visited this property" at a glance, not just by reading the label.
- Use the shared status-pill vocabulary (`pending`/`approved`/`rejected`/`rented`) identically on the owner-facing My Listings screen and the admin moderation queue.
- Keep chat bubbles flat — no shadow, no gradient, no tail graphic.
- Use system fonts as specified. Do not add a custom/licensed font "for polish" — it directly contradicts a deliberate, documented MVP decision (root `CLAUDE.md` §16.2).

### Don't
- Don't introduce a fifth border-radius value. The system is `{rounded.sm}` (12, inputs) — `{rounded.md}` (16, cards) — `{rounded.lg}` (24, sheets) — `{rounded.full}` (pills). Nothing between md and lg, nothing above lg except full.
- Don't add a card shadow beyond elevation level 1. There is no "extra emphasis" card treatment — if a card needs to stand out, change its content or add a badge, not a bigger shadow.
- Don't use `{colors.success}` (green) decoratively. It means "verified" or "approved" and nowhere else.
- Don't preserve pin/property-card natural aspect ratios on the mobile browse feed. GHOR crops listing photos to a fixed 4:3 ratio deliberately — card-height consistency matters more here than photo-composition purity, because the metadata block beneath must align down a scrolling feed.
- Don't put a hover-only interaction anywhere in `apps/mobile` — there is no cursor. Any interaction spec'd as "on hover" needs a tap/press equivalent instead.
- Don't let `{component.rating-display}` become a second loud typographic moment — keep it at `{typography.body-strong}` scale, never `{typography.price-display}` scale. One hero number per screen, and it's the rent.
- Don't color star icons gold/amber. `{colors.ink}`, matching `{component.rating-display}`'s spec — a colored star reads as decorative, an ink star reads as data.

---

## Responsive Behavior

### Mobile device classes (`apps/mobile`)
| Class | Width | Key Changes |
|---|---|---|
| Small phone | 360—390px | Base spacing scale as documented; listing card image height compresses slightly (4:3 held, absolute height shrinks) |
| Standard phone | 390—430px | Default design target — all mockups in `assets/` are drawn at this class |
| Large phone / phablet | 430—480px | Extra horizontal breathing room only; no new columns |
| Tablet (later) | 600px+ | Not designed yet — GHOR is phone-only at MVP (no tablet-specific layout exists; if a tablet opens the app, it should letterbox to phone width rather than stretch, since a 2-column feed isn't designed) |

The mobile app never gains a second grid column at any device class currently in scope — that's a deliberate difference from both reference systems' desktop grids, since GHOR has no desktop/tablet product surface at MVP.

### Web breakpoints (`apps/web`)
Unchanged from the existing `apps/web/design.md`: 1440 / 1280 / 1024 / 768 / 480 / 375. The admin dashboard (not yet built) should additionally define a sidebar-collapse breakpoint around 1024px (sidebar becomes an overlay drawer below that width, matching the mobile-app's own bottom-sheet pattern for consistency across the two builds).

### Touch Targets
All interactive elements meet WCAG AA (≥44×44px). `{component.button-primary}`/`{component.button-secondary}` sit at 52px height. `{component.button-icon-circular}` is 40×40 with padding extending the effective hit area to 48×48. `{component.filter-chip}`/`{component.amenity-chip}` are ~36px visual height with padding bringing the tappable area to 44px.

---

## Iteration Guide

1. Change a token here first, then in **[`../design-tokens.js`](../design-tokens.js)** — the code form both `apps/mobile/tailwind.config.js` and `apps/web/tailwind.config.ts` import from. Never hand-edit a hex/px value inside a component as a one-off; NativeWind classes and Tailwind config should reference these tokens by name. One exception, deliberately not wired up: border-radius is **not** applied as a Tailwind scale override in either config — Tailwind's own `xl`/`2xl`/`3xl` already equal this file's `sm`/`md`/`lg` in px, and both apps' existing markup depends on Tailwind's *other* default radii (e.g. `rounded-lg` at 8px) that this file doesn't define a tier for. See the comment block at the top of either `tailwind.config` for the exact mapping.
2. Reference tokens directly (`{colors.primary}`, `{component.button-primary}`, `{rounded.full}`) in code comments and PR descriptions — don't paraphrase ("the blue button") when a precise token exists.
3. Before adding a new component entry, check whether it can be expressed with an existing token combination (a listing-card variant, a status-pill color, a button treatment) — this system is intentionally small; resist growing it.
4. Any new color needs a semantic name and a stated scope (where it's allowed to appear) before it's added — a color with no scope constraint drifts into decorative use within a few screens.
5. Cross-check new mobile screens against the mockup screen inventory in `apps/mobile/design.md` and new web screens against `apps/web/design.md` — those files map tokens to actual approved layouts; this file defines the tokens themselves.
6. When the admin dashboard build starts, extend the "Admin" component subsection here rather than starting a parallel design.md for it — it's a different density, not a different brand.
7. Revisit `Known Gaps` below at the start of any work that touches one of the listed items — don't silently invent an answer to an explicitly-open question (ratings, dark mode, tablet).

---

## Redesign Amendments (2026-09-26) — "Blue, Navy & Cream"

The founder judged the shipped UI "dull, blank, generic — a CRUD app, not a marketplace". The audit found the cause was **composition, not palette**: white cards on a white/slate canvas, one font at similar sizes, text-only status and empty states, and a build that had drifted far from the approved mockups in `/assets` (photo overlays, icon-led amenities, owner card, sticky price bar were all missing). Trust-first stays; these amendments change how the tokens are *used*. Where this section conflicts with anything above, **this section wins**.

**Tokens added (in `design-tokens.js`) — depth and warmth without a second saturated brand color:**
- `navy` #0B1B3F / `navy-soft` #15295A — a deep shade of the same blue family. Hero/search bands, the sticky contact bar, dark feature blocks, active filter chips, the admin header.
- `cream` #FBF8F3 / `cream-deep` #F3EDE3 — warm off-white. The product canvas is now `cream` (was `surface`), so white cards read as surfaces instead of floating white-on-white; `cream-deep` for secondary tiles.
- `primary-tint` #DBEAFE — icon-tile washes.
- Locked tokens unchanged: `primary` #2563EB, all semantic colors, the four radius tiers. Green is still verification-only.

**Typography:** one display face on **web only** — Geist, self-hosted via the `geist` package (`--font-geist-sans`, no third-party request, no layout shift) — for all `h1`–`h4`, with tight tracking (-0.02em product, down to -0.04em marketing). Body text stays on the system stack. `apps/mobile` stays 100% system font (no font download on budget Android); `fontFamily.display` lists the CSS var first, which React Native ignores.

**Elevation:** still flat-by-default, but two additions: a soft "lifted" shadow (`0 18px 40px -18px rgba(11,27,63,.35)`) for hovered/featured cards and the sticky contact card, and frosted `glass-chip` overlays (white/85 + blur on web; solid white/92 on mobile — blur is costly on Android) for text laid over photography.

**Components (single implementations):** `apps/web/components/ui` — `Badge`, `VerifiedBadge`, `StatusBadge` (replaces `StatusPill`; statuses read Live / In review / Needs changes / Draft / Rented), `PriceTag`, `Chip`, `SectionHeader`, `IconTile`, `Avatar` (deterministic initials — no profile photos exist), `EmptyState`, `Skeleton`, `SkeletonListingCard`. Mobile has `src/components/EmptyState.tsx`. Amenities are icon-led everywhere via `amenityIcon()` / `amenityLabel()`.

**Photography:** listing cards are 4:3 with overlays (type, "Verified", photo count, rent on a frosted chip, availability when known); detail uses a gapless mosaic (1 + up to 4) with a full-screen lightbox on web and a swipe strip + "1 / N" counter on phones. Landing imagery is cropped from the approved mockup renders in `/assets` (illustrative only, never presented as a live listing) — replace with real photography once owners onboard.

**Motion:** GSAP only on the marketing landing page, always behind `prefers-reduced-motion`, content visible by default, with a 2.5s force-finish safety net. Product screens get only press (`.press` scale 0.98), hover, sheet/modal and skeleton shimmer.

**Empty & loading states:** every list has a designed `EmptyState` (icon composition + human title + one line + next action) and a layout-matched skeleton — never a bare spinner or "No data found".

**Honesty rule (enforced during the redesign):** no invented listings, ratings, testimonials, user counts or partner logos. Discovery sections (Popular areas, Recently added, Under ₹7,000) render only when real API data backs them. The previous landing page's fabricated social proof ("Trusted by…", 5 stars, "37 spots claimed", placeholder avatars) was removed.

## Known Gaps

- ~~**Map provider not yet chosen**~~ — resolved 2026-09-25: OpenStreetMap (Leaflet on web and in a mobile WebView; rent-pill pins as specced). (root `CLAUDE.md` §2 "Map view") — `{component.map-pin}`/`{component.map-toggle}` are speced generically; the actual map rendering (Google Maps vs. Mapbox/Leaflet) will constrain exact pin/marker implementation once picked.
- **Browse-feed grid layout for `apps/web` is still unresolved** (`apps/web/CLAUDE.md`) — affects how `map-toggle`'s "List" view and the map view itself lay out side-by-side or stacked on desktop.
- **No skeleton-loading component spec yet beyond the token** — `{component.skeleton-block}` exists as a color/radius token but shapes (card-skeleton, row-skeleton) per screen aren't laid out.
- **No dark mode.** `app.config.ts` sets `userInterfaceStyle: 'light'` — this file has no dark-surface component variants beyond the single `{colors.surface-dark}` token used for the ad-interstitial backdrop. A real dark mode is not in scope.
- **No tablet/desktop mobile-app layout.** GHOR is phone-only; see Responsive Behavior above.
- **Admin dashboard visuals are speculative.** The "Admin" component subsection is a forward-looking spec written before that surface exists (per `apps/web/STATUS.md`) — revise it against real screens once built, don't treat it as locked the way the mobile tokens are.
- **Interstitial ad screen has no detailed spec.** Root `CLAUDE.md` §14.6/apps/mobile/design.md deliberately keep this minimal (native AdMob interstitial, not custom UI) — `{colors.surface-dark}` is the only token reserved for it.
- **No motion/animation spec.** Neither reference system's motion section was adapted here — GHOR's screen-transition and press-feedback timing hasn't been specified yet beyond "press = opacity/color swap, no hover lift" above.
- **Accessibility beyond touch-target sizing** (screen-reader labels, dynamic type scaling, color-contrast audit against `{colors.muted}` on `{colors.surface}`) has not been formally checked.
