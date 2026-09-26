# GHOR Web — Repo Context (Next.js)

> This is `apps/web` in the GHOR monorepo (formerly a standalone repo called `ghor-web`, merged in 2026-07-23). The full product spec — what GHOR is, MVP scope, data model, monetization, build order — lives in **`../../CLAUDE.md`** (root of the monorepo). Read that first. This file only covers what's specific to working in *this* workspace.
>
> **Before assuming a page or integration exists, check [STATUS.md](STATUS.md).** This app currently serves a much narrower purpose than its target scope — see below.

---

## What this app currently is vs. what it's becoming

**Today (as of 2026-07-23):** a pre-launch waitlist landing page. Collects signups (name/email/phone) via a form that writes to a Google Sheet and sends a confirmation email via Resend. No `@supabase/supabase-js`, no `apps/api` integration at all yet.

**Target scope, per the 2026-07-23 full-parity decision (root `CLAUDE.md` §3):** this app is not just landing-page-plus-admin anymore. It's a **third full consumer of `apps/api`**, alongside `apps/mobile` — a seeker or owner can complete the entire core loop (browse, search/filter, listing detail, sign up/log in, chat, and for owners: post/manage listings) from the website with no app install. Same backend, same DTOs, a second UI. See root `CLAUDE.md` §14.1 for the new `apps/web` internal folder structure (`features/*` alongside the existing `sections/`/`components/`) and §3's web stack table for the session/auth mechanics (httpOnly cookie, not `localStorage`).

**As of 2026-08-19, the core loop, the admin dashboard, notifications, and profile are all built and verified live** against `apps/api`: auth (phone OTP, onboarding), browse feed, listing detail + edit, create-listing, My Listings, chat (real-time via Socket.io + REST fallback), notifications, profile, and the full `/admin` dashboard (listings queue, reports, users, app config, analytics) all work end-to-end. Reviews, map view, owner profiles, and account deletion are still not built — see `STATUS.md` for the precise built/not-built line.

Three things land in this same Next.js project:
1. **Product routes** — the entire core loop is built, plus notifications and profile as of 2026-08-19. Still to be built from the 2026-07-23 Airbnb-level feature set: reviews, map view, owner profiles, insights. See the complete Page Inventory below.
2. **The permanent public landing page** (post-launch marketing copy, app store links, `/privacy`, `/terms`) — the current waitlist page is a pre-launch placeholder, not final landing content.
3. **The `/admin` dashboard** (listing approval queue, reports, users, app config, analytics) — root `CLAUDE.md` §14.10.

## Design system

Visual language for the current landing/waitlist page is in [design.md](design.md) — brand direction, color tokens, typography, layout, component specs, motion, copy tone. Follow it for any change to the public-facing marketing page specifically. For the **product routes** (browse/listing/chat/etc.), use **[`../../DESIGN.md`](../../DESIGN.md)** directly — that's the cross-platform token/component system shared with `apps/mobile`, and it's what those screens should be built against, not `design.md` (which is marketing-page-specific). The admin dashboard doesn't have a design doc yet — likely a denser, shadcn/ui table-driven language per root `CLAUDE.md` §14.10, still to be written.

**The tokens are wired into code, not just documented:** `tailwind.config.ts` imports colors/spacing/fontFamily from `../../design-tokens.js` (shared with `apps/mobile`) — use the resulting classes (`bg-primary`, `text-ink`, `border-hairline`, etc.) rather than raw hex. A `brand` tint scale (50/100/200/300/700) is also defined in the config for **decorative-only** use (gradients, blurred glow shapes) on the marketing page — it's not part of `../../DESIGN.md`'s semantic set and must not be used for anything meant to carry meaning (that's what `primary`/`primary-pressed`/`primary-light` are for). Border-radius is not overridden: Tailwind's default `rounded-xl`/`rounded-2xl`/`rounded-3xl` already equal `DESIGN.md`'s sm/md/lg. As of 2026-07-23 this app also no longer loads Plus Jakarta Sans/Playfair Display via `next/font/google` — it uses the same system-font stack as `apps/mobile`, per `DESIGN.md`.

**Browse-feed layout — resolved 2026-08-18:** a responsive multi-column grid (1 col mobile width, 2 col tablet, 3 col desktop via `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`), not a constrained single column matching `apps/mobile`. Desktop width is the whole reason to build a distinct web browse feed; a forced single column would waste it. See `app/(product)/browse/page.tsx`.

**Session/auth mechanism — resolved 2026-08-18 (BFF proxy pattern):** an httpOnly cookie can't be read by browser JS, so client-side code never attaches a Bearer token itself the way `apps/mobile`'s `lib/apiClient.ts` does. Instead:
- `app/api/gateway/[...path]/route.ts` is a catch-all server-side proxy — every authenticated `apps/api` call from `features/*/api.ts` goes through `lib/apiClient.ts` → `fetch('/api/gateway'+path)`, and the route handler reads the `ghor_at`/`ghor_rt` httpOnly cookies via `next/headers`'s `cookies()`, attaches the Bearer token, and does the same single refresh-and-retry-on-401 that `apps/mobile` does client-side — just server-side, since only the server can read/rotate the refresh cookie.
- `app/api/auth/otp/{send,verify}/route.ts` and `app/api/auth/logout/route.ts` are separate, dedicated routes (not the generic gateway) because they're the ones that create/destroy the session cookies — `otp/verify` is the only place a `ghor_at`/`ghor_rt` pair gets `response.cookies.set()`.
- Both tokens are fully server-side at all times; the browser only ever holds an httpOnly cookie it can't read. This is a heavier pattern than `apps/mobile`'s direct client-side Bearer attach, but it's what the "httpOnly cookie, not localStorage" decision actually requires once you need client-side mutations (forms, infinite scroll) against a cookie JS can't see.
- `middleware.ts` gates protected routes on cookie *presence* only (not signature verification — that would need the JWT secret in the Edge runtime) — same "known gap, not an oversight" tradeoff `apps/mobile`'s root layout auth gate accepts.

**Two narrow, deliberate exceptions to "never expose a token to browser JS," added 2026-08-18 for chat:**
- `app/api/chat/socket-token/route.ts` reads the httpOnly `ghor_at` cookie server-side and returns the raw access token to the browser — but *only* so `lib/socket.ts` can hand it to `io(NEXT_PUBLIC_API_URL, { auth: { token } })` for the Socket.io handshake. A raw WebSocket connection from the browser can't carry an httpOnly cookie set on this app's origin, and proxying a stateful bidirectional Socket.io connection through a second Next.js hop wasn't worth the complexity here — so the chat socket connects to `apps/api` directly (not through `/api/gateway`), using this short-lived (15m) ticket. `NEXT_PUBLIC_API_URL` is a new browser-exposed env var for exactly this — everything else still goes through the server-side-only `API_URL`.
- **`app/api/auth/onboarding/route.ts` exists as a dedicated route, not the generic gateway**, because `apps/api`'s `PATCH /auth/onboarding` now reissues a fresh token pair whenever onboarding changes a user's role (fixing a stale-JWT-role bug found live this pass — see `../api/STATUS.md`). The generic gateway proxy only knows how to refresh-and-set-cookies on a 401; it has no reason to inspect an ordinary 200 response body for tokens. This route does that one specific thing, mirroring `otp/verify`'s cookie-setting pattern.

**Logged-in navigation (decided 2026-07-23):** once signed in, the marketing navbar is replaced by a persistent top nav for the product area — `Browse | Listings (owner-role accounts only) | Chats | Profile`, mirroring `apps/mobile`'s role-conditional tab bar (`apps/mobile/design.md`) exactly: seekers see 3 links, owners see the same 3 plus "Listings." No sidebar, no bottom-tab-bar lookalike on desktop — a persistent top nav is the standard pattern here, consistent with most desktop web products.

## Repo layout

```
app/
  page.tsx                     # marketing landing/waitlist page
  api/waitlist/                 # Waitlist signup endpoint
  api/debug-google/              # Google Sheets integration debug route
  api/gateway/[...path]/         # BFF proxy — see "Session/auth mechanism" above
  api/auth/otp/{send,verify}/    # session-creating routes (set httpOnly cookies)
  api/auth/onboarding/            # session-mutating route (reissues cookies on role change), built 2026-08-18
  api/auth/logout/               # session-destroying route (clears cookies)
  api/chat/socket-token/          # issues a short-lived token for the Socket.io handshake, built 2026-08-18
  (auth)/{sign-in,verify-otp,onboarding}/  # built 2026-08-18
  (product)/                    # route group — shared TopNav layout, doesn't affect URLs
    layout.tsx                   # renders <TopNav /> + children
    browse/, listing/[id]/, listing/[id]/edit/, listing/new/, my-listings/   # edit/ built 2026-08-19, rest 2026-08-18
    chats/, chat/[conversationId]/                        # built 2026-08-18
    notifications/, profile/                               # built 2026-08-19 (profile/ was a dead link before)
  admin/                         # NOT inside (product) — its own layout, no TopNav, built 2026-08-18
    layout.tsx                    # role gate (profile.role === 'admin') + admin header/sidenav
    page.tsx                      # listings queue
    reports/, users/, config/, analytics/
middleware.ts                   # route gate — protected vs. signed-out-only prefixes, includes /admin
features/
  auth/{api.ts, hooks.ts}         # built 2026-08-18
  listings/{api.ts, hooks.ts, components/}  # built 2026-08-18
  institutions/{api.ts, hooks.ts}  # built 2026-08-18
  chat/{api.ts, hooks.ts, components/QuickReplies.tsx}  # built 2026-08-18
  admin/{api.ts, hooks.ts}        # built 2026-08-18
  notifications/{api.ts, hooks.ts} # built 2026-08-19
sections/               # Page sections (hero, features, waitlist, testimonials, footer, ...) — marketing only
components/             # button, logo, reveal, section-heading (marketing) + TopNav.tsx (product)
lib/                    # data.ts/email.ts/googleSheets.ts (marketing) + apiClient.ts, queryClient.ts, cloudinary.ts, socket.ts (product, built 2026-08-18)
google-apps-script/     # Apps Script backing the Google Sheet waitlist storage
```

Note the split: `sections/`/`components/`'s marketing files/most of `lib/` are marketing-page-only and stay as-is. Product work lives in `features/*`, `app/(product)/*`, `app/(auth)/*`, and the three `app/api/*` route groups — see STATUS.md for exactly what's built vs. still missing (chat, reviews, map view, owner profiles, notifications, `/admin`).

## Page Inventory (complete, as of 2026-07-23) — none of this exists yet except marketing

Mirrors `apps/mobile/design.md`'s Screen Inventory route-for-route, since full parity (root `CLAUDE.md` §3) means the same pages, just a different UI toolkit. Routes marked **NEW** were added alongside the 2026-07-23 Airbnb-level feature set.

### Marketing (public, unauthenticated)

| Page | Route | Notes |
|---|---|---|
| Landing/waitlist | `/` | Built — see `design.md` |
| Privacy Policy | `/privacy` | Not built — required before Play Store submission (root `CLAUDE.md` §15.3) |
| Terms of Service | `/terms` | Not built |

### Auth

| Page | Route | Notes |
|---|---|---|
| Sign in | `/sign-in` | ✅ Built 2026-08-18 — phone OTP live end-to-end; Google button is a "coming soon" placeholder, same as mobile |
| Verify OTP | `/verify-otp` | ✅ Built 2026-08-18 |
| Onboarding | `/onboarding` | ✅ Built 2026-08-18 — name + role selector |

### Product — top nav (role-conditional, see "Logged-in navigation" above)

| Page | Route | Seeker | Owner | Notes |
|---|---|---|---|---|
| Browse | `/browse` | ✅ | ✅ | ✅ Built 2026-08-18 — search (client-side over loaded pages), room/flat filter, infinite "Load more", multi-column grid. Sort options and Map/List toggle not built yet. |
| Listings | `/my-listings` | — | ✅ | ✅ Built 2026-08-18 — status pills, "+ New Listing". Drafts show like any other status; no separate drafts-only view yet. |
| Chats | `/chats` | ✅ | ✅ | ✅ Built 2026-08-18 — conversation list, other party's name + last-message preview |
| Profile | `/profile` | ✅ | ✅ | ✅ Built 2026-08-19 — was a dead link before (nav pointed here, no page existed). Identity card, a Notifications entry point, Sign Out. Editing name/phone and account deletion still not built. |

### Product — other pages

| Page | Route | Notes |
|---|---|---|
| Listing detail | `/listing/[id]` | ✅ Built 2026-08-18, updated 2026-08-19 — photo gallery w/ thumbnail strip, role-conditional CTA (Call/real Chat for others; owner gets status-transition buttons **plus a new "Edit Details" button**). Ratings/reviews, similar listings, lightbox, map snippet not built. |
| Edit listing | `/listing/[id]/edit` | ✅ **New 2026-08-19** — content fields only (title, locality, rent, deposit, description, amenities, institutions); photos shown read-only since `apps/api`'s update endpoint doesn't touch `images`. |
| Create listing | `/listing/new` | ✅ Built 2026-08-18 (create only) — Save as Draft vs. Submit for Review, photo upload via native `<input type="file">` (no client-side compression, see STATUS.md), amenity + institution tagging. |
| Chat thread | `/chat/[conversationId]` | ✅ Built 2026-08-18 — real-time via `lib/socket.ts`, REST fallback, quick-reply chips |
| Notifications | `/notifications` | ✅ **Built 2026-08-19** — matters more here than on mobile, since there's no web push. Unread-dot list, "Mark all read," tap-to-navigate into the relevant chat/listing. Reachable from a new bell icon in `TopNav` and from `/profile`. |
| Owner profile | `/owner/[id]` | Not built — Airbnb "host profile" analog |
| Write a review | `/listing/[id]/review` | Not built, gated to qualifying reviewers (root `CLAUDE.md` §2) — depends on `apps/api` having a reviews module, which doesn't exist |
| Listing insights | `/my-listings/[id]/insights` | Not built, owner-only |

### Admin (founder-only, root `CLAUDE.md` §14.10) — built 2026-08-18, verified live

| Page | Route | Notes |
|---|---|---|
| Admin login | `/admin/login` | **Not a separate page** — reuses `/sign-in` (phone OTP; Google isn't live), gated by role in `app/admin/layout.tsx` after `middleware.ts` enforces the session. |
| Listings queue | `/admin` | ✅ Built — per-row Approve/Reject, checkbox-driven bulk approve/reject bar |
| Reports | `/admin/reports` | ✅ Built — category chip per report, Dismiss/Confirm actions (Confirm reverts the listing to `pending`) |
| Users | `/admin/users` | ✅ Built — table with role/listing-count/banned status, Ban/Unban toggle |
| App config | `/admin/config` | ✅ Built — inline-editable key/value list (JSON-parsed values) + an add-new-key form |
| Analytics | `/admin/analytics` | ✅ Built — stat-card grid (no chart library added), explicitly flags which funnel numbers are actually tracked vs. structurally zero today |

All five pages call `apps/api`'s admin-guarded endpoints through the existing `/api/gateway` proxy (`features/admin/api.ts`) — no new session-handling was needed since none of these mutate tokens the way onboarding/otp-verify do. `app/admin/layout.tsx` is deliberately **not** nested under `app/(product)` — it has its own header/sidenav, not the seeker/owner `TopNav`, matching root `CLAUDE.md` §14.10's "cleanly separated from the user-facing app."

### Not found

| Page | Route |
|---|---|
| 404 | Next.js default `not-found.tsx` |

## Conventions

- Keep shared copy/data in `lib/data.ts`, not hardcoded in section components. (This applies to the marketing page; product features get their own `features/*/api.ts` per root `CLAUDE.md` §14.2 — never call `apps/api` directly from a component.)
- Icons: `lucide-react` only (matches `lucide-react-native` in `apps/mobile` for visual consistency across surfaces).
- Tailwind CSS for styling; global helpers in `app/globals.css`.
- **Product routes and the admin dashboard both call `apps/api`** (its own JWT/`role` checks) — not Supabase directly, and not a shared `@ghor/backend`/Prisma types package (that pattern was superseded before it was ever used here; see root `CLAUDE.md`'s "Architecture pivot" note and `apps/api/CLAUDE.md`). There is no `@supabase/supabase-js` dependency in this app and none should be added.
- **Session/auth**: httpOnly cookies (`ghor_at`/`ghor_rt`) via the BFF proxy pattern in `app/api/gateway` + `app/api/auth/*` — see "Session/auth mechanism" above for the full shape. Never attach a Bearer token from client code directly; always go through `lib/apiClient.ts` → `/api/gateway`.
- **Never call `/api/gateway` or `apps/api` outside a feature's `api.ts`** — same rule as root `CLAUDE.md` §14.2, now enforced on this surface too (`features/auth/api.ts`, `features/listings/api.ts`, `features/institutions/api.ts`).
- Deployed to Vercel, domain `ghor.co.in` (per root `CLAUDE.md` §3). In this monorepo, Vercel's project "Root Directory" setting needs to point at `apps/web` — not yet configured, see STATUS.md.
