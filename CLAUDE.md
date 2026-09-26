# GHOR — Project Context for Claude Code

> **How to use this file:** This is the single source of truth for what GHOR is, what we're building first, the stack, the constraints, and the build order. It is auto-loaded by Claude Code at the start of every session in this repo. Update it whenever a decision changes.
>
> Related root docs: **[`DESIGN.md`](DESIGN.md)** (UI/token system, supersedes §16 below), **[`LAUNCH.md`](LAUNCH.md)** (launch timing, pre-launch supply seeding, growth/PR plan — read this before touching §10's build order or §13's success metrics), **[`STATUS.md`](STATUS.md)** (current build state across all three apps).

---

## 1. What GHOR is

GHOR is a property discovery marketplace for Assam and Northeast India. "Ghor" means "home." It connects people looking for places to live directly with property owners, removing brokers and the friction of Facebook/WhatsApp groups.

**The core problem, in one real example:** A renter asked a broker for help. The broker charged ₹400 just to *show* rooms, and would take ~₹3,500 commission on a ₹7,000/month room if finalized — nearly ₹3,900 in broker tax on a single rental. GHOR removes that. Discovery and contact are free.

**Launch positioning:** "No ₹400 viewing fees. No ₹3,500 brokerage. Find your room directly."

**Long-term vision:** the most trusted property platform in Northeast India, expanding into PGs, hostels, land, sales, and property services. But none of that is in scope now — see MVP below.

---

## 2. What we are building FIRST (MVP scope)

The MVP exists to answer one question as cheaply as possible: **will real owners in one city list on GHOR, and will seekers contact them through it instead of going to a broker or Facebook?**

Everything that doesn't directly serve that loop is cut.

### In scope
- **Login required before browsing.** Seekers must sign up and log in before they can see listings. (Trade-off noted in §7 — top-of-funnel friction at launch; middle-ground option documented there.)
- **Two property types only:** rooms and flats.
- **Owner posts a listing** (requires auth): title, type, rent, deposit, locality, city, description, amenities, available-from, photos.
- **Photo uploads** via Cloudinary.
- **Search & filter:** city, rent range, room/flat, a few amenity toggles, and **nearby institution tags** (see "Nearby institution tags" below).
- **Listing detail page** with photo gallery, details, and a Google Maps *link* (no embedded map yet).
- **In-app real-time chat (replaces WhatsApp)** + **Call** (`tel:`). WhatsApp is intentionally NOT used — GHOR owns the conversation channel. An **interstitial ad is shown before every contact action** (tapping Chat or Call) — ad → then chat thread opens / number dials. Ad frequency must be a config value, not hardcoded, so it can be tuned if it suppresses contact rate. Tapping a new-message push notification opens the relevant chat thread directly (deep link, see §14.12).
- **Manual moderation:** new listings default to `pending`; the founder approves them before they go live. This is the trust layer and the differentiator vs. Facebook groups.
- **Share listing:** native share sheet (e.g., to WhatsApp) with a deep link back to the listing — opens directly in-app if GHOR is installed (see §14.12).
- **Report/flag listing:** seekers can report a bad/spam listing with a reason; a listing automatically reverts to `pending` after accumulating `N` open reports, returning it to the admin queue (§6, §14.2).
- **Account deletion:** in-app flow to delete an account and its associated data — required by Play Store policy for apps with accounts (§15.4).

### Trust & quality signals (added 2026-07-23 — see `LAUNCH.md`'s trust discussion for why)

Split deliberately into "cheap, ship at launch" and "real new work, reopens a prior cut-scope call." Both groups are now in scope; the distinction is about build order and cost, not priority.

**Cheap — computed from data the app already has:**
- **"Phone Verified" badge** on a profile — derived from having completed phone OTP (already a login method); no new verification flow, just surfacing existing state.
- **"Verified by GHOR" badge on the listing** — derived from `status = approved`; no new moderation step, just surfacing existing state more visibly on the card/detail page.
- **Response rate / response time** ("usually replies within 1 hour") on the owner — computed from `messages` timestamps (time between a received message and the owner's next reply). No new table required; consider a cached/denormalized field on `profiles` once real volume makes the live computation slow.
- **"Active X days ago"** on the owner — derived from a new `last_active_at` timestamp on `profiles`, updated on session activity.
- **"Mark as rented" reminder** — a one-time soft nudge if a listing hasn't been touched in N days. **Not** the fuller "still available?" auto-flagging system below, which stays deferred — this is just a notification, no automatic status change.
- **Recently viewed / recently contacted list** — client-side only (local device cache), no backend table. **Not** the fuller favorites/saved-listings system below, which stays deferred — this is just "don't lose track of what I already looked at."
- **"X people viewed this today"** on a listing — derived from the existing `events` table (`listing_view` rows already tracked for analytics, §14.13), no new tracking needed.
- **Minimum photo count on listing creation** (3+ photos) — form-level validation in the create-listing flow, no schema change.

**Real new work — this reopens the "verification badges, KYC" cut-scope decision below, deliberately:**
- **Owner ID verification** (Aadhaar/PAN-style) — a real KYC flow: document upload, an admin review step distinct from listing moderation, a verification-status badge on the owner's profile. Needs its own data model (§6), its own admin queue, and a compliance/data-handling review (ID documents are sensitive — see §15 production-readiness checklist) before this goes live, not just before it's built.
- **In-person/photo property verification** — an agent or the founder confirms a listing is real before its first approval, producing a distinct "Property Verified" badge separate from the base moderation `approved` status. High trust value, but scales with founder/agent time, not with the codebase — factor this into `LAUNCH.md`'s seeding-capacity planning, not just the build plan.

**Admin/web side (added alongside the above):**
- **Bulk-approve / bulk-reject** in the moderation queue.
- **Report reason breakdown** — `reports` gets a fixed `reason_category` enum (spam / fake / inappropriate / other) alongside the existing free-text `reason`, so the admin dashboard can chart categories instead of only reading free text.

### Nearby institution tags (added 2026-07-23)

Owners can tag a listing with the schools/colleges/universities it's near (e.g., "Near Royal Global University"); seekers can filter the browse feed by the same tags. This is student/professional demand made explicit — a huge share of Guwahati room-hunting is driven by "I need to be near my college," and right now that's buried in free-text descriptions instead of being filterable.

**Design decision: a curated, admin-managed list of institutions, not free-text tags.** Free text fragments immediately ("RGU" vs "Royal Global" vs "Royal Global University" vs a typo) and stops filtering from working at all — the whole point is that a seeker's filter tap and an owner's tag have to refer to the exact same thing. Concretely:
- A new `institutions` table (curated: name, `type` — `school` | `college` | `university`, `city`), seeded manually by the founder for Guwahati's actual institutions to start (a handful of well-known ones — Gauhati University, Cotton University, Royal Global University, IIT Guwahati are real examples to confirm and expand from — don't treat this doc's list as complete or authoritative; the founder, being local, is the source of truth for what to seed).
- A listing can tag **multiple** institutions (many-to-many) — a PG near both a coaching center and a university tags both.
- **No admin UI to manage this list at MVP** — matches the existing manual-scale philosophy already used for moderation (§11). If an owner wants an institution that doesn't exist yet, that's a founder-handled request (via chat, same as everything else at this scale) until volume justifies building a self-serve admin CRUD for it.
- On the listing form: a searchable multi-select (type-ahead over the curated list), not a free-text box — this is what actually enforces the "same tag" guarantee above.
- On the listing card/detail and the browse feed filter bar: reuses the existing `amenity-chip`/`filter-chip` visual system (`DESIGN.md`) — this doesn't need new UI components, just a new filterable dimension.
- Scoped with a `city` field on `institutions` from day one (even though MVP is Guwahati-only, §2) so expanding to Jorhat/Dibrugarh/Sivasagar later doesn't require a schema change — just seeding more rows.

### Reviews & ratings (added 2026-07-23 — reopens the §12/§16.5 deferral, deliberately)

The ratings-display question (§12) is now resolved: **build real reviews**, not a placeholder badge. This is the single biggest addition in this pass — real data model, a moderation-adjacent policy, and a genuine UI surface on both apps.

- **Who can review what:** a seeker can leave one review (1–5 stars + optional comment) per listing, **gated to seekers who've actually messaged that listing's owner** — enforced by checking a `Conversation` exists between the reviewer and the listing before allowing the review. This is the anti-fake-review mechanism; there's no purchase/checkout event in GHOR's model (no booking, no payment) to gate on instead, so "did you actually make contact" is the closest real signal available.
- **Not pre-moderated, but reportable/hideable.** Requiring admin approval before every review goes live would kill the immediacy that makes reviews valuable, and doesn't fit the founder's manual-moderation bandwidth once volume grows past listings alone. Instead: reviews go live immediately, and admin can hide one (same trust posture as reports on listings) — a `hidden` flag, not a `pending` gate.
- **Aggregates are denormalized onto the listing** (`avg_rating`, `review_count`) — read on every browse-feed render, so computing live from the reviews table on every request doesn't scale; recompute on review create/hide.
- **Display, restrained on purpose:** a modest inline rating (star row + "4.8 (23)") replaces `new-listing-badge` once a listing has reviews — **not** a second giant hero number competing with `price-display`. `DESIGN.md`'s "exactly one loud typographic moment" rule stays intact; ratings are real but quiet.
- **New pages:** a review list on listing detail, and a "Write a review" screen/sheet (gated — only rendered for eligible reviewers). The `~~Write a Review~~` "do not build" line from the old screen inventory is reversed; see the page inventories in `apps/mobile/design.md`/`apps/web/CLAUDE.md`.
- Reviews are about the **listing**, not a separate owner-rating system — an owner's overall reputation is the aggregate of their listings' reviews, not a second parallel rating.

### Map view on the browse feed (added 2026-07-23 — reopens the §7/§14.11 maps deferral, deliberately)

Also reopened: owners currently only ever enter a locality name, no coordinates exist anywhere in the system. Adding a real map means:
- **New geocoding step**: when a listing is created/updated, `apps/api`'s listings module calls a geocoding API (locality + city + state text → lat/long) and stores the result. Owners still only type a locality name — geocoding happens server-side, invisibly; this doesn't change the "owners think in locality names" principle from the original deferral, it just adds a machine-readable coordinate behind that same text input.
- **Map provider — not yet chosen.** Google Maps Platform (consistent with the existing "Google Maps link" already in scope, generous but usage-billed free tier) vs. Mapbox/Leaflet+OpenStreetMap (fully free tier, less brand-familiar). Given the project's cost-consciousness (`STATUS.md`/`LAUNCH.md`'s running theme), this deserves a real cost comparison before picking — not decided in this pass.
- **Browse feed gets a Map/List toggle** (segmented control) — List is the existing default view; Map shows a pin per listing in the current filtered set (pin displays the rent, Airbnb-style), tapping a pin surfaces a mini preview card, tapping the preview opens the full listing detail.
- This is a genuinely large addition — a new backend integration, new schema fields, and new client-side map SDK work on **both** `apps/mobile` and `apps/web` (per the full-parity decision, §3) — factor this into the `LAUNCH.md` timeline discussion when it's next revisited.

### Additional Airbnb-level polish (added 2026-07-23 — smaller, no scope reopening)

- **Full-screen photo gallery/lightbox** on listing detail — swipeable, tap-to-expand from the inline gallery. Pure frontend, uses photos that already exist.
- **Owner profile page** (`/owner/[id]` web, `owner/[id]` mobile) — the Airbnb "host profile" analog: name, verification badges (phone/ID/property, §2), response rate, member-since date, and a list of their other approved listings. Pure read query against existing `profiles`/`listings` data — no schema change.
- **"Similar listings" section** on listing detail — same locality, institution tag, or price band, shown as a horizontal card row at the bottom of the page. Query-only, no schema change.
- **Sort options** on the browse feed (newest, price low→high, price high→low, most viewed) — uses fields that already exist (`created_at`, `rent`, the view-count `events` rows from §2's trust signals).
- **In-app notification/activity center** — a feed of things relevant to the signed-in user (new message, listing approved/rejected, new review, listing viewed milestone) — see §6 for the new `notifications` table this needs. Distinct from push notifications: this is the "I'm in the app, show me what I missed" surface, and it matters more on **web**, which doesn't get mobile push at all — email + this in-app center are the web equivalent.
- **Listing drafts** — an owner can save an incomplete listing form and resume later, without it being submitted for moderation. A new `draft` status on `listings.status` (§6), never moderated, only visible to its own owner, excluded from the "force to `pending` on publish" rule until the owner actually publishes it.
- **Owner insights** — a simple per-listing stats view (views over time, inquiry count, response rate) on top of data already tracked (`events`, `messages`) — no new tables, just aggregation queries and a chart.
- **Skeleton loading states** instead of spinners, matching content shape (a gray listing-card-shaped placeholder while the feed loads, etc.) — pure frontend polish, see `DESIGN.md`.

### Explicitly CUT or deferred (do not build yet)
- WhatsApp contact — intentionally dropped; replaced by in-app chat (see In scope). Note the tradeoff in §7.
- Google / social login — email now, phone OTP later (see §5).
- **Full favorites / saved-listings system** — fast-follow after launch. (The lightweight "recently viewed/contacted" list above is *not* this — it's a smaller, backend-free stand-in, not a replacement for the real feature.)
- Interactive maps & lat/long picker — owners think in locality names; a Maps link is enough.
- Rich profiles, profile images — owner needs name + phone only. (ID-verification documents, above, are handled as a distinct, access-controlled admin flow — not a "rich profile" the seeker sees.)
- Security deposit / available-from / pincode / full amenity list can be trimmed to keep the listing form under 3 minutes.
- Roommate matching, land/sales, agent accounts — all later phases. (Verification badges/KYC moved out of this line 2026-07-23 — see "Trust & quality signals" above.)
- **Full "still available?" freshness auto-flagging system** — periodic owner prompts to confirm/refresh stale listings, with automatic status changes. Fast-follow after launch. (The simple one-time "mark as rented" reminder above is *not* this — no automatic flagging, just a notification.)
- **Multi-language support (Assamese, Hindi)** — English-only at MVP, no i18n scaffold yet either. Revisit once the core loop is validated; retrofitting i18n later is a known, bounded cost.

### Launch geography
**Guwahati only.** Do not spread across multiple cities. Concentrate liquidity in one place so the feed looks full. Being based in Guwahati is a major advantage for the hands-on cold-start (recruiting testers, meeting landlords/PG operators, seeding listings in person). Guwahati is bigger and more competitive than smaller Assam towns, so manual seeding and the trust/quality gate matter even more as the edge. Expand to Jorhat, Dibrugarh, Sivasagar and other Assam cities after Guwahati works.

---

## 3. Tech stack

Single-language TypeScript across all three surfaces (mobile app, landing page, admin dashboard), minimal moving parts, optimized for fast solo building with an AI assistant and for scaling later without rewrites.

### Four surfaces, one monorepo

| Surface | Path | URL | Notes |
|---|---|---|---|
| **Mobile app** | `apps/mobile` | Play Store / App Store | Expo + React Native. Used by both seekers and room owners (role-based UI). |
| **Web** | `apps/web` | `ghor.co.in` | **Three things in one Next.js project** (see below): the public marketing/landing page, a **full seeker + owner web product**, and the founder-only admin dashboard. |
| **Backend API** | `apps/api` | (internal — not public-facing directly) | Custom NestJS server. Both `apps/mobile` and `apps/web` talk to this, never to Postgres directly. |

`apps/mobile`, `apps/web`, and `apps/api` are npm workspaces in a single repo, all deployed independently (`apps/web` to Vercel).

> **Restructure note (2026-07-23, monorepo):** this used to be two separate git repos (`ghor-app`, `ghor-web`). Consolidated into a single monorepo.
>
> **Architecture pivot (2026-07-23, backend):** GHOR originally ran "Supabase-direct" — `apps/mobile` and `apps/web` talked to Supabase via `supabase-js`, with Postgres RLS enforcing authorization, no custom server. That's been deliberately reversed: the founder wants full control over business logic and authorization living in code they own, not in RLS policies. `apps/api` (NestJS + Prisma) is now the only thing that talks to Postgres; Supabase Auth, Realtime, and RLS are no longer used (Postgres itself may still be Supabase-hosted, or may move — that's just a connection string). **Cost of this decision, on record:** a real Node host is now required (not just Supabase's free tier), the build is bigger than the original 4-week solo estimate, and auth (Google OAuth + phone OTP) had to be rebuilt from scratch instead of using Supabase Auth. See `apps/api/CLAUDE.md` and `apps/api/STATUS.md` for where that stands. Don't re-introduce direct `supabase-js` calls from the apps — that's the exact pattern being removed.
>
> **Scope expansion (2026-07-23, web product):** `apps/web` was landing page + admin only. Per an explicit decision, it's now also a **full parallel product surface** — a seeker or owner can complete the entire core loop (browse, search/filter, listing detail, sign up/log in, chat, and for owners: post/manage listings) from the website with no app install, same model as BookMyShow's web+app parity. This roughly doubles the client-side build (mobile's core-loop screens now need a web equivalent too), against the same `apps/api` backend — the backend doesn't change, but this **pushes the realistic launch timeline out past `LAUNCH.md`'s original September 2026 estimate**, accepted explicitly as the tradeoff for launching both surfaces together. See `LAUNCH.md` for the revised timing discussion and §14.1 below for `apps/web`'s new internal folder structure.

### Mobile app stack

| Layer | Choice | Notes |
|---|---|---|
| **Mobile app** | React Native via **Expo** (TypeScript), **Expo Router** | Cross-platform Android + iOS from one codebase. File-based routing. |
| **Backend** | Custom **NestJS API** (`apps/api`) | App talks to `apps/api` over HTTP/WebSocket, behind a thin service layer (see §14) — never to Postgres or Supabase directly. |
| **Data access** | `fetch`/HTTP client + typed request/response DTOs, wrapped in a `features/*/api.ts` service layer | Same service-layer convention as before, just calling `apps/api` endpoints instead of `supabase-js`. This is exactly why that convention existed — see §14.2. |
| **Real-time chat** | WebSocket connection to `apps/api`'s Socket.io gateway | `messages` persisted via Prisma in `apps/api`; the gateway pushes new messages to connected clients. Basic text thread for v1 — skip typing indicators/read receipts initially. |
| **Notifications** | **Expo Push Notifications** (+ email fallback) | **Mission-critical** now that WhatsApp is gone — owners must be pinged on every new message/inquiry or they'll miss it. Sent directly from `apps/api` on message creation — no more Postgres-trigger indirection. |
| **Ads** | **Google Mobile Ads (AdMob)** via `react-native-google-mobile-ads` (Expo config plugin) | Interstitial shown before each contact action. Needs a free AdMob account. Frequency configurable (see §2/§8/§14), served from `apps/api`'s `app_config` table. |
| **Auth** | Custom, via `apps/api` — Google OAuth + phone OTP, JWT access/refresh tokens | Email/password dropped (unchanged decision). `apps/api` verifies Google's token and handles OTP generation/verification itself; see §5 for the DLT/SMS API details, which still apply. |
| **Images** | **Cloudinary** (free tier) | Unchanged by the architecture pivot. Store image URLs in Postgres. Compress/resize client-side before upload. |
| **Builds** | **EAS Build** | Cloud builds for Android/iOS; no Mac needed for iOS. |
| **UI** | NativeWind (Tailwind for RN) or a clean RN component approach | Mobile-first, fast to build. |
| **Server state** | TanStack Query | For caching API reads, mutations, optimistic updates, and infinite-scroll pagination (see §14). |
| **Error monitoring** | **Sentry** (free tier) | Crash/error reporting from day one — see §15.1. |
| **OTA updates** | **EAS Update** | Ship JS fixes to testers/users without an app-store review — see §15.2. |
| **Analytics** | `events` table (via `apps/api`) + `lib/analytics.ts` | Lightweight funnel tracking, no new vendor — see §14.13/§15.5. |
| **Payments (later)** | **Razorpay** (UPI + cards) | Only when monetization starts. Needs a registered business entity + GST. |

### Backend stack (`apps/api`)

| Layer | Choice | Notes |
|---|---|---|
| **Framework** | **NestJS** (TypeScript) | Module-per-feature, matching the `features/*` convention already used in `apps/mobile`. |
| **Database access** | **Prisma** (`prisma/schema.prisma`) | Single source of truth for the schema. Migrations via `prisma migrate`, not the Supabase CLI. |
| **Database** | **Postgres** — currently the existing Supabase-hosted instance, connected to directly via `DATABASE_URL` | Supabase is now just a Postgres host here, nothing more. Could move to any Postgres provider later without touching application code, since Prisma is the only thing that knows the connection string. |
| **Auth** | Custom JWT (access + refresh), Google OAuth token verification, phone OTP (own `phone_otps` table) | Replaces Supabase Auth entirely. See `apps/api/CLAUDE.md`. |
| **Real-time chat** | **Socket.io** gateway inside this app | Replaces Supabase Realtime. |
| **Authorization** | NestJS guards/services | Replaces Postgres RLS. Every "own rows only" / "admin only" rule that used to be an RLS policy needs an explicit equivalent here — see `apps/api/STATUS.md` for the list carried over from the old policies. |
| **Hosting** | Not yet chosen — default recommendation **Railway** (good fit for a long-running Node + WebSocket process) | Real ongoing cost now, unlike the Supabase-free-tier-only version of this stack. Not yet set up. |

### Web stack (`apps/web`)

| Layer | Choice | Notes |
|---|---|---|
| **Framework** | **Next.js 14** (App Router, TypeScript) | One project, three purposes: public marketing (`/`), the seeker/owner web product (`/browse`, `/listing/[id]`, `/chat/[id]`, `/my-listings`, etc.), and admin (`/admin`). File-based routing mirrors Expo Router familiarity. |
| **Hosting** | **Vercel** (free hobby tier) | Custom domain support. Point `ghor.co.in` DNS to Vercel — zero config. |
| **UI** | **Tailwind CSS** + **shadcn/ui** | Same Tailwind familiarity as NativeWind in the app, same `DESIGN.md` tokens via the shared `design-tokens.js`. shadcn covers admin table/dialog/badge/toast components. |
| **Data access** | `fetch`/HTTP client + typed request/response DTOs, wrapped in a `features/*/api.ts` service layer | **Same convention as `apps/mobile`** (§14.2) — the web product isn't a special case, it's a second consumer of the identical `apps/api` endpoints. Marketing routes (`/`, `/privacy`, `/terms`) need no backend calls; the waitlist form posts to Google Sheets, unrelated to `apps/api`. |
| **Auth** | `apps/api`'s auth (same JWT scheme as the mobile app), session stored in an httpOnly cookie | Web needs its own session storage decision distinct from mobile's `expo-secure-store` — an httpOnly cookie (set by a Next.js route handler after `apps/api` issues the JWT pair) is the standard web-safe equivalent, not `localStorage` (XSS-exposed). Same login methods (Google OAuth, phone OTP) as the app; admin login is the same flow, just gated by `role = 'admin'` after. |
| **Real-time chat** | WebSocket connection to `apps/api`'s Socket.io gateway | Same gateway `apps/mobile` uses — a second client, not a second backend feature. |
| **Server state** | TanStack Query | Same as mobile — caching, mutations, infinite-scroll for the browse feed grid (see §14.1 layout note). |
| **Domain** | `ghor.co.in` | Marketing: `ghor.co.in`. Product: `ghor.co.in/browse`, `/listing/[id]`, etc. Admin: `ghor.co.in/admin`. Privacy Policy: `ghor.co.in/privacy`. Terms: `ghor.co.in/terms`. A mobile deep link (`ghor://listing/[id]`) and the web route (`ghor.co.in/listing/[id]`) should resolve to the same listing — keep IDs consistent across both, they already are since both call the same `apps/api`. |

**Platform priority:** **Android first**, iOS right after. The Assam market is overwhelmingly Android, and Android-first sidesteps Apple review friction during the launch crunch.

**Database region:** Postgres is currently on AWS `ap-south-1` (Mumbai) via the existing Supabase project — closer to Assam than the originally-planned Singapore region, and no reason to move it just because of the backend pivot.

**Scaling note:** this stack (NestJS + Prisma + Postgres) genuinely scales to millions of users with no rewrites needed — provided the module/guard-per-feature architecture in §14 is followed from day one. The real near-term cost isn't scaling, it's that there's now meaningfully more to build (and host) before first launch than the original Supabase-direct plan assumed.

---

## 4. App flow (end to end)

**Seeker journey**
1. **Signs up / logs in first**, then lands on the browse feed of **approved** listings for Guwahati, newest first.
2. Uses search bar + filters (city, rent range, room/flat, amenities). App queries `apps/api` for matching `approved` listings.
3. Taps a listing → detail page: photo gallery (Cloudinary), description, rent, deposit, amenities, locality, available-from, owner name, Maps link.
4. Taps **Chat with Owner** or **Call** → **an interstitial ad shows first**, then: Chat opens an in-app real-time thread with the owner / Call dials the owner's number (`tel:`). **This is the core conversion event.** Note: the design shows a "Book Now" button — this is renamed to "Chat with Owner" and opens the same chat thread. There is no separate booking flow.

**Owner journey**
1. Signs up / logs in via Google or phone OTP → brief onboarding sets name + role (`owner`) → profile created.
2. Creates a listing via a short form (target: under 3 minutes), uploads photos to Cloudinary.
3. Listing saves with `status = pending`.
4. After founder approval, listing goes live in the feed. Owner receives calls and **in-app chat messages**, and is **pushed/emailed a notification** for every new inquiry (critical — they have no WhatsApp ping anymore).
5. Owner can edit a listing or mark it rented/unavailable (drops it from the feed).

**Founder / admin (moderation)**
- Reviews `pending` listings (via the admin dashboard's Listings queue, §14.10, once built — pre-dashboard, directly against the database).
- Approves legitimate listings (`status → approved`) or rejects spam. Only `approved` listings appear in browse.

**Behind the scenes**
- Expo app / web app ↔ `apps/api` over HTTP/WebSocket, accessed only through the `features/*/api.ts` service layer (§14.2). `apps/api` ↔ Postgres via Prisma — nothing else talks to Postgres directly.
- Images live in Cloudinary; their URLs are stored in Postgres.
- Moderation is a status flag, checked/changed only through `apps/api`'s admin-guarded endpoints.

---

## 5. Auth — Google OAuth + Phone OTP (email/password dropped)

The MVP ships with **two auth methods only**: Google OAuth and phone number + OTP. Email/password is not used. This means the Forgot Password and Reset Password flows are out of scope.

> **Post-pivot note:** auth used to be Supabase Auth (a dashboard toggle + a custom SMS hook Edge Function). Per the 2026-07-23 architecture pivot (§3), `apps/api` now owns all of this itself — it verifies Google's token directly, generates/verifies OTPs itself (`phone_otps` table, §6), and issues its own JWT access/refresh tokens (`refresh_tokens` table, §6). The *product* decision (Google + phone OTP, no passwords) is unchanged; only who implements the mechanics changed.

### Google OAuth
- Google Cloud Console OAuth credentials (client ID/secret) — same credentials as before, now consumed directly by `apps/api` instead of being handed to Supabase.
- In the Expo app: `expo-auth-session` gets a Google ID token, sends it to `apps/api`'s login endpoint, which verifies it server-side (Google's public keys) and issues GHOR's own JWT pair.
- Deep-link redirect wired to the `ghor://` scheme (§14.12) stays the same regardless of which backend verifies the token.

### Phone OTP
- `apps/api` generates the OTP itself, stores a hash + expiry in `phone_otps`, and sends it via the **owner-provided bulk SMS API** directly (no more Supabase Edge Function indirection).
- **Dependency:** the founder will provide the bulk SMS API credentials and endpoint. Wire these into `apps/api`'s environment (never hardcode). Until credentials are provided, stub the send step and test with a fixed OTP in dev.
- **DLT compliance note:** In India, SMS OTPs legally require DLT registration (TRAI mandate). Confirm the provided SMS API is DLT-registered before going to production — unregistered routes are blocked by Indian carriers. This is the provider's responsibility, not a GHOR build task.
- The OTP input screen (4-digit box UI, already designed — see §16) is used for this flow, unchanged.

### Post-auth onboarding
- First-time users (new OAuth or phone signup) land on a brief onboarding screen to set **Full Name** and **Role** (seeker / owner) — data saved to `profiles`. This replaces the traditional "sign up form."
- Returning users go directly to the browse feed.

### Screens removed from scope
- **Forgot Password** — no passwords in the system.
- **Reset Password** — no passwords in the system.
Both were designed but are now obsolete. Do not build them.

---

## 6. Data model (Postgres via Prisma, in `apps/api`)

> **Post-pivot note:** this used to be Supabase SQL migrations with RLS. It's now `apps/api/prisma/schema.prisma`, applied via `prisma migrate`. The tables below are still accurate; the enforcement mechanism (last subsection) changed from RLS policies to NestJS guards/services. Two tables were added that didn't exist before — `refresh_tokens` and `phone_otps` — needed because auth is now handled by `apps/api` itself instead of Supabase Auth. See `apps/api/CLAUDE.md`/`STATUS.md` for current status.

Keep it lean for the MVP, but indexed for scale (see §14.4 for index list).

**`profiles`** (the user table itself now — no more `auth.users` to be 1:1 with, since Supabase Auth isn't used)
- `id` (uuid), `full_name`, `phone` (unique, nullable), `google_id` (unique, nullable), `role` (`seeker` | `owner` | `admin`, default `seeker`), `banned` (bool, default false), `created_at`
- One of `phone`/`google_id` is set depending on which login method the user used; both may eventually be set if a user links both.
- **Trust fields (added 2026-07-23, see §2 "Trust & quality signals"):** `phone_verified` (bool, default false — set true once the phone OTP flow succeeds; drives the cheap "Phone Verified" badge), `last_active_at` (timestamptz, nullable — touched on session activity; drives "Active X days ago"), `id_verification_status` (`none` | `pending` | `verified` | `rejected`, default `none` — the real-work KYC flow), `id_document_url` (text, nullable — the uploaded ID document; sensitive, access-controlled to `admin` only, never returned to any non-admin caller, including the owner's own profile fetch, once uploaded).

**`refresh_tokens`** (new — needed for custom JWT auth)
- `id` (uuid), `user_id` (FK profiles), `token_hash`, `expires_at`, `created_at`, `revoked_at` (nullable)
- Store only a hash of the refresh token, never the raw value. Rotate on use.

**`phone_otps`** (new — needed for custom phone OTP, replacing Supabase's built-in OTP handling)
- `id` (uuid), `phone`, `code_hash`, `expires_at`, `attempts` (int, default 0), `created_at`
- One row per OTP send; verify by hashing the submitted code and comparing, then delete or mark used.

**`listings`**
- `id` (uuid), `owner_id` (FK profiles), `title`, `description`, `property_type` (`room` | `flat`), `rent` (int), `deposit` (int, nullable), `locality`, `city`, `state`, `available_from` (date, nullable), `amenities` (jsonb — flexible flags), `status` (`draft` | `pending` | `approved` | `rejected` | `rented`, default `pending`), `created_at`, `updated_at`
- **Trust field (added 2026-07-23):** `property_verified` (bool, default false) — set only by an admin/agent after in-person or photo verification (§2). Deliberately separate from `status = approved`: a listing can be approved (passed spam/quality moderation) without being property-verified (nobody visited it yet). Drives the distinct "Property Verified" badge, never conflated with the base "Verified by GHOR" (= `approved`) badge in the UI.
- **`draft` status (added 2026-07-23, §2 "Additional Airbnb-level polish"):** an owner-only, unmoderated state for a listing still being filled in. Never visible to anyone but its owner, never subject to the "force to `pending`" insert rule, never counted in moderation-queue metrics. Only transitions *out* of `draft` (to `pending`) when the owner explicitly publishes — that's the one place the "force pending" service-layer rule actually fires.
- **Map fields (added 2026-07-23, §2 "Map view"):** `latitude`/`longitude` (float, nullable) — populated server-side by a geocoding call on create/update from the existing `locality`/`city`/`state` text, never entered directly by the owner. Nullable because geocoding can fail (bad/ambiguous locality text) — the listing still works without it, it just won't appear on the map view, only in the list view.
- **Rating aggregates (added 2026-07-23, §2 "Reviews & ratings"):** `avg_rating` (float, nullable), `review_count` (int, default 0) — denormalized from `reviews` (below), recomputed on review create/hide. Nullable `avg_rating` (not zero) distinguishes "no reviews yet" from "reviewed and rated zero," which matters for correct `new-listing-badge` vs. `rating-display` rendering logic.
- Application-layer validation (not a DB constraint): publishing out of `draft` requires **3+ photos** in `listing_images` — enforced in the create-listing service, not the schema.

**`listing_images`**
- `id` (uuid), `listing_id` (FK listings), `cloudinary_url`, `position` (int)

**`institutions`** (new — see §2 "Nearby institution tags")
- `id` (uuid), `name`, `type` (`school` | `college` | `university`), `city`, `created_at`
- Curated/admin-managed, not user-generated — see §2 for why free text was rejected here.

**`listing_institutions`** (new — many-to-many join)
- `listing_id` (FK listings), `institution_id` (FK institutions), composite PK on both
- Index on `institution_id` (the browse-feed filter query direction) in addition to the composite PK (which already covers the `listing_id` direction).

**`conversations`** (one per seeker↔owner↔listing thread)
- `id` (uuid), `listing_id` (FK listings), `seeker_id` (FK profiles), `owner_id` (FK profiles), `created_at`, `last_message_at`
- Unique on (`listing_id`, `seeker_id`) so re-contacting reuses the thread.

**`messages`**
- `id` (uuid), `conversation_id` (FK conversations), `sender_id` (FK profiles), `body` (text), `created_at`, `read_at` (nullable)
- Delivered to connected clients via `apps/api`'s Socket.io gateway, scoped per `conversation_id` (not a Supabase Realtime subscription anymore). Push/email notification to the recipient sent directly from `apps/api` on insert (server-side, see §14.5).

**`push_tokens`** (added for scale-readiness, see §14.4)
- `id` (uuid), `user_id` (FK profiles), `expo_push_token` (text), `device_id` (text, nullable), `created_at`
- A user may have multiple devices; don't cram tokens into `profiles`.

**`app_config`** (added for scale-readiness, see §14.6)
- `key` (text, PK), `value` (jsonb), `updated_at`
- Holds tunables like `ad_frequency`, `page_size`, `report_threshold`, feature flags — readable by all authenticated users, writable only by `admin`. Lets you change ad frequency, the report auto-revert threshold, or roll out phone OTP without a new app build.

**`reports`** (added for trust & safety, see §14.2)
- `id` (uuid), `listing_id` (FK listings), `reporter_id` (FK profiles), `reason` (text), `reason_category` (`spam` | `fake` | `inappropriate` | `other`, added 2026-07-23 — see §2), `status` (`pending` | `reviewed` | `dismissed`, default `pending`), `created_at`
- `apps/api`'s reports service reverts `listings.status` to `pending` once a listing accumulates `report_threshold` (from `app_config`) open reports, returning it to the admin queue — this was a Postgres trigger before the pivot, now it's application logic (see `apps/api/STATUS.md`).
- `reason_category` is a required enum picked by the reporter (a short dropdown, not a text field); `reason` stays free text for detail. This is what lets the admin dashboard chart report categories instead of only reading free text.

**`events`** (added for analytics, see §14.13/§15.5)
- `id` (uuid), `user_id` (FK profiles, nullable), `event_name` (text), `properties` (jsonb, nullable), `created_at`
- Lightweight funnel tracking: `signup`, `listing_view`, `contact_tap`, `chat_started`, `listing_created`. Insert-only from the client.

**`favorites`** (deferred — include when building the fast-follow)
- `id` (uuid), `user_id` (FK profiles), `listing_id` (FK listings), `created_at`

**`reviews`** (new — see §2 "Reviews & ratings")
- `id` (uuid), `listing_id` (FK listings), `reviewer_id` (FK profiles), `rating` (int, 1–5), `comment` (text, nullable), `hidden` (bool, default false — admin-set, not a `pending` gate), `created_at`
- Unique on (`listing_id`, `reviewer_id`) — one review per seeker per listing.
- Creation gated in the service layer: only allowed if a `conversations` row exists linking `reviewer_id` to that listing's `owner_id` for that `listing_id` — i.e., you must have actually messaged the owner about this listing to review it.

**`notifications`** (new — see §2's in-app notification/activity center)
- `id` (uuid), `user_id` (FK profiles), `type` (`new_message` | `listing_approved` | `listing_rejected` | `new_review`, extendable), `payload` (jsonb, nullable — e.g. the conversation/listing id to deep-link to), `read_at` (timestamptz, nullable), `created_at`
- Written server-side by `apps/api` whenever it would otherwise send a push/email — this table is the durable, in-app-readable record of the same events, not a separate notification system to keep in sync.

**Authorization rules** (enforced by `apps/api` guards/services — this used to be a Postgres RLS policy summary; same rules, different enforcement layer, no database-level safety net anymore)
- `listings`: any **authenticated** user can list/read where `status = 'approved'` (browse still requires login); an owner can read/create/update/delete their own rows, **including their own `draft` rows, which no other non-admin user can ever read**; only `admin` can change `status` (except the owner-initiated `draft → pending` publish transition) or `property_verified`. New non-draft inserts force `status = 'pending'` and `property_verified = false` in the service layer; `latitude`/`longitude` are never client-settable, only written by the geocoding step.
- `listing_images`: readable when the parent listing is approved or owned by the requester; create/delete by the owning user.
- `institutions`: readable by all authenticated users (needed for the listing form's type-ahead and the browse filter bar); create/update/delete restricted to `admin` (no self-serve creation at MVP, §2).
- `listing_institutions`: readable wherever the parent listing is readable; create/delete by the listing's owning user only (tagging your own listing), never referencing another owner's listing.
- `conversations`: readable/writable only by its `seeker_id` and `owner_id`.
- `messages`: a user can read/send only in conversations where they are a participant; `sender_id` must equal the authenticated user (from the JWT, not client-supplied).
- `profiles`: readable (owner name, `phone_verified`, `last_active_at`, `id_verification_status` shown — the last as a badge only, never the underlying `id_document_url`); each user updates only their own `full_name`/`phone`, and cannot set their own `role` to `admin`, touch `banned`, `phone_verified`, or `id_verification_status`/`id_document_url` (all admin-only or system-set, enforced in the service layer). `last_active_at` is touched automatically by the API on authenticated requests, never client-supplied.
- `push_tokens`: each user manages only their own rows.
- `app_config`: readable by all authenticated users; writable only by `admin`.
- `reports`: any authenticated user can create one (`reporter_id` = self); read/update restricted to `admin`.
- `events`: any authenticated user can create one (`user_id` = self or null); read restricted to `admin`.
- `favorites`: each user manages only their own rows.
- `reviews`: readable by anyone who can read the parent listing; create restricted to authenticated users with a qualifying `conversations` row (see §6's `reviews` entry) and `reviewer_id` = self; update restricted to `admin` (only the `hidden` flag — a reviewer cannot edit their own review's rating/comment after posting, matching Airbnb's own no-edit-after-post norm and simplifying the "is this still the same review" trust question).
- `notifications`: each user reads/updates (`read_at`) only their own rows; created only by `apps/api` server-side, never client-inserted.

---

## 7. Constraints & gotchas (the non-obvious stuff)

These are the things that will trip up the build/launch if ignored:

1. **Google Play 14-day gate.** A *new personal* Play developer account must run a closed test with **≥12 testers opted in for 14 continuous days** before applying for production. → **Start closed testing early** (around the point you have a rough working build, ~day 10–12), using 12 real Guwahati renters/owners as testers (doubles as first user feedback + first listings). The 14-day clock then runs in parallel with finishing the app, instead of adding two weeks at the end.
2. **Business entity is the keystone.** A registered entity (with GST) unlocks THREE things at once: (a) an **organization** Play account that is **exempt from the 14-day gate**, (b) DLT eligibility for **phone OTP**, and (c) **Razorpay** for payments/monetization. Getting the entity early is high-leverage.
3. **Image egress.** GHOR is photo-heavy; route images through Cloudinary, compress client-side before upload (§14.7), or you'll blow Supabase's free egress quickly.
4. **Login-first browsing (product decision), applied the same way on both surfaces.** Seekers must sign up before seeing listings — on `apps/mobile` and on the `apps/web` product routes alike, per the 2026-07-23 decision to build full web/app parity (§3). Watch-item: this is top-of-funnel friction, worst at launch when the feed is thin and a new visitor can't yet judge GHOR's value — and it's a bigger cost on web specifically, since a login wall is exactly what blocks the SEO/Google-search-discovery benefit a public website could otherwise offer. That tradeoff was made explicitly (full parity chosen over a public no-login browse option), not overlooked — but if install-to-signup/visit-to-signup conversion looks weak on either surface, the fallback is the same middle path: show the feed to everyone but require login on listing-tap/contact (you still capture nearly all users, since chat needs an account anyway).
5. **Moderation is a feature, not a delay.** The `pending → approved` gate is what makes GHOR trustworthy. Keep it.
6. **Don't try to capture the broker's success fee.** Even with in-app chat, once two people decide to deal they can exchange numbers and close off-platform — you can't reliably see or enforce a commission. Revenue comes from the supply side wanting visibility, never from taxing the transaction. (See §8.)
7. **Owner reachability is now critical (WhatsApp is gone).** With WhatsApp, owners got pinged without needing the app. In-app chat means **both parties must be in GHOR for a message to land**, so an inactive owner can miss inquiries — and "I messaged owners and got no reply" destroys seeker trust fast. Mitigations are mandatory, not optional: reliable Expo push on every message, an **email fallback** for new inquiries, and (once DLT is done) an **SMS alert** for unread messages. This raises the value of phone OTP/contact info for owners.
8. **The ad gates your core conversion event — watch it.** An interstitial before every Chat/Call tap sits on the single most valuable action in the app. This is a deliberate product decision, but keep ad frequency configurable (via `app_config`, §14.6) and **monitor contact-rate**; if conversions drop at launch (when proving the loop matters most), dial frequency down without shipping a new build.
9. **Legal pages and account deletion block Play Store submission too**, not just the 14-day testing gate. Privacy Policy, Terms of Service, and an in-app account-deletion flow are required before you can apply for production — budget time for these in Week 3 (§15).

---

## 8. Monetization roadmap (do NOT monetize early)

GHOR is a two-sided marketplace starting from zero. The scarce resource is listings. Monetizing before there's liquidity chokes supply and kills the marketplace. So:

- **Phase 0 — launch → liquidity (first few months):** Free. No ads, no fees. Only goal: fill Guwahati with real listings and active seekers.
- **First revenue — Featured / promoted listings:** owners pay a small fee to top-place or highlight a listing. Direct incentive (rent faster), no commitment. In-app: a "Promote" button on the owner's listing-management screen → Razorpay → "Featured" badge + top placement.
- **Next — Subscriptions for professional suppliers:** PG operators, then agents/builders pay monthly for unlimited/featured listings + basic analytics (views, inquiries). Recurring revenue once professional supply exists.
- **Then — Paid verification badge:** once verification is built, owners/agents pay to appear verified. Fits because trust *is* the product.
- **Long-term — Services marketplace:** home loans, digital rental agreements, packers/movers, interiors, via referral/commission. **This is where "ads" belong** — as native *promoted local services*, not banner ads.

**Ads — interstitial before each contact action (current product decision).** An ad shows before every Chat/Call tap, with frequency held in `app_config` (§14.6). Honest caveat to keep on record: this taxes your core conversion event and runs against the trust-first positioning, and interstitial revenue at launch scale (low Indian eCPMs) is small — so treat it as a tunable experiment, not a fixed pillar. Watch contact-rate and reduce frequency if it suppresses the funnel. The higher-value, on-brand ad form remains *native promoted local services* (movers, agreements, interiors) layered in later, plus the supply-side levers above which don't touch the seeker experience.

**Brokers are future suppliers, not just the enemy.** A broker sitting on 15–20 rooms is a power-lister who'll pay for featured placement/subscriptions. Disrupt the *seeker-pays-broker* relationship; monetize brokers as suppliers.

---

## 9. Costs

> **Post-pivot note:** this section described a near-$0/month MVP, which was true for Supabase-direct. It's no longer accurate — `apps/api` needs a real, always-on Node host. Figures below are updated; treat the old "essentially free validation" framing as retired along with the architecture it described.

- **To launch on Android: ~₹2,000 one-time** (Google Play developer account, $25). 
- **Monthly at launch:** no longer ₹0. Rough estimate: Postgres (still Supabase-hosted for now, likely free tier or Pro at $25/mo depending on usage) + a Node host for `apps/api` running Socket.io (Railway/Render/Fly.io — roughly $5–20/mo on a starter tier, more once always-on + real traffic) + Cloudinary free tier + EAS free builds + Expo push free + AdMob account free. (Interstitial ad revenue at launch scale is small — don't bank on it.)
- **Arrive with success:** Supabase Pro ($25/mo) when Postgres outgrows free limits; scale up the Node host tier as traffic grows; iOS = Apple Developer Program ($99/yr).
- **Phone OTP (if/when):** ~₹6,000 one-time DLT + ~₹0.15 per login — unchanged, this cost was always about the SMS provider, not Supabase.
- The self-managed-backend comparison this section used to make ("a self-managed equivalent runs $80–120/mo") no longer applies as a contrast — `apps/api` *is* that self-managed backend now, by choice.

---

## 10. Suggested build order (pre-pivot estimate, now substantially out of date — see note)

> **Post-pivot note:** the original "≈4 weeks" was built around Supabase-direct (no custom backend to write, no web product). Two things have added real time since: (1) building `apps/api`'s auth, listings, chat-gateway, and admin modules from scratch, and (2) the 2026-07-23 decision (§3) that `apps/web` is now a full parallel product, not just landing+admin — meaning the client-side work below effectively happens **twice**, once per surface, for every core-loop feature. Treat the weeks below as a rough shape, not a real schedule; re-estimate once the auth module's actual effort is known. **See [`LAUNCH.md`](LAUNCH.md) for the honest timeline discussion** — the previous ~mid-September 2026 estimate no longer holds now that web parity is in scope before launch, and that's an accepted tradeoff, not an oversight.

Back-planned around the Play Store gate. Treat as guidance, not rigid — the numbered weeks below are really "phases," expect them to run longer than a literal week each.

- **Phase 1 — Foundation + auth (both surfaces).** Expo + Cloudinary + Next.js project setup, following the folder structure and service-layer pattern in §14 (both `apps/mobile`'s and `apps/web`'s). Configure **Sentry** and **EAS Update channels** for mobile (§14.8, §15.1-2) early. **`apps/api`'s auth module**: Google OAuth + phone OTP (JWT issuance, OTP send/verify — stub OTP sending with a fixed code until SMS credentials arrive). Data model via Prisma (incl. `push_tokens`, `app_config`, `reports`, `events`, `refresh_tokens`, `phone_otps`, `institutions`, the trust fields from §2). Then **both** `apps/mobile`'s auth `api.ts` + onboarding screen **and** `apps/web`'s equivalent auth routes/`api.ts` (httpOnly-cookie session, §3) get wired to it. Owner: create-listing form + Cloudinary upload on **both** surfaces.
- **Phase 2 — The core loop (both surfaces).** `apps/api`'s listings module (CRUD, cursor-paginated feed, institution-tag filter, min-photo validation) and chat module (Socket.io gateway). Then build the seeker browse feed, search/filter (incl. institution tags), listing detail, and chat thread **twice** — once in `apps/mobile` (infinite-scroll list, single column per `DESIGN.md`), once in `apps/web` (likely a multi-column grid on desktop — an open layout question `DESIGN.md` doesn't resolve yet, see its Known Gaps). Share listing, report/flag, the interstitial ad gate (mobile only — no ad-gate equivalent decided for web yet, another open question), push+email notifications, event tracking. Owner: manage listings (edit, mark rented) on both surfaces. Produce a testable mobile build → **start Google Play closed testing with 12 Guwahati testers (14-day clock starts).**
- **Phase 3 — Admin + trust features + primary seeding push.** `apps/api`'s admin + reports modules (bulk approve/reject, report-category breakdown, `role = 'admin'` guard) → `apps/web/admin`. Trust/quality signals from §2 (phone-verified/response-rate/last-active on both surfaces; ID + property verification's admin review queue). Legal pages (`/privacy`, `/terms`, required before Play Store submission). Account deletion on both surfaces. **This is the primary supply-seeding window, not an afterthought** — target 60–100 real, approved Guwahati listings *before* the closed test ends (`LAUNCH.md` §2: PG operators, brokers-as-suppliers, existing Facebook rental groups, owner-testers among the 12). This also requires the founder to actually seed the `institutions` table (§2) — nothing to filter by until that's done. Closed test continues; collect tester feedback.
- **Phase 4 — Launch.** Fix tester-reported bugs on both surfaces, final polish, cross-check `apps/web`'s product routes actually match `apps/mobile` feature-for-feature (the parity promise, §3). Once the 14-day test completes and supply seeding has hit its target, apply for production and **launch on Android + web in Guwahati** — with press/ambassador/budget activities from `LAUNCH.md` §5–7 sequenced against this date.

---

## 11. Product principles

1. **Trust first** — every feature should increase trust (the `pending` moderation gate is principle #1 in action).
2. **Simplicity** — listing a property takes under 3 minutes.
3. **Mobile-primary, web at parity** — most users are still expected to come from mobile in this market, and the native app remains the primary design target, but per the 2026-07-23 decision (§3) the website is a full second surface, not an afterthought — a feature isn't "done" until it works on both.
4. **Local focus** — nail Guwahati before expanding.
5. **Owner-friendly** — listing must be easier than posting in a Facebook group.

---

## 12. Open decisions still to make

- **SMS API credentials** — founder to provide the bulk SMS API endpoint + credentials for the phone OTP Edge Function (§5). Confirm it is DLT-registered before going to production.
- **Business entity** — registering one unlocks (a) org Play account (no 14-day gate), (b) Razorpay for payments. Not blocking MVP.
- **Final amenity list** — keep short (target: 6–8 amenities on the listing form).
- **Exact "featured listing" price point** — decide only when monetizing (post-launch).
- ~~Static rating values~~ — resolved 2026-07-23: real reviews are now in scope (§2 "Reviews & ratings"), not a placeholder. This decision is closed, not open.

---

## 13. Success metrics

- **6 months:** 1,000+ listings, 5,000+ users, 500+ monthly active, 100+ tenant–owner connections (Guwahati-focused).
- **12 months:** 10,000+ listings, presence across Assam, first revenue from featured listings.

---

## 14. Application architecture & scaling plan

**Guiding principle:** build fast, but structure the code so that scaling to thousands of users is a *config or service-layer* change, not a rewrite. Every rule below exists to avoid a specific class of rework, not to add ceremony. (Pre-pivot, this principle was about outgrowing Supabase; post-pivot, `apps/api` already is the custom backend — the principle now is about not needing a second rewrite of *that*.)

### 14.1 Folder structure (feature-based, not type-based)

**Monorepo layout** (npm workspaces — see the "Four surfaces, one monorepo" table above):

```
apps/
  mobile/                    # Expo app — see below for its internal src/ structure
  web/                       # Next.js — landing page (public) + /admin dashboard (§14.10)
  api/                       # NestJS — the only thing that talks to Postgres (see apps/api/CLAUDE.md)
    prisma/schema.prisma     # single source of truth for the DB schema
    src/
      <feature>/             # one Nest module per feature, mirroring apps/mobile's features/*
```

`apps/mobile` internal structure:

```
src/
  app/                       # Expo Router routes — thin, just screen composition & layout
    (auth)/
      sign-in.tsx
      sign-up.tsx
    (tabs)/
      index.tsx              # browse feed
      my-listings.tsx
      chats.tsx
      profile.tsx
    listing/[id].tsx          # listing detail
    listing/new.tsx           # create/edit listing
    chat/[conversationId].tsx
  features/
    auth/
      api.ts                 # signIn(), signUp(), signOut(), getSession()
      hooks.ts               # useSession(), useSignIn(), useSignUp()
      types.ts
    listings/
      api.ts                 # getApprovedListings(), getListing(id), createListing(), updateListing()
      hooks.ts               # useListingsFeed(), useListing(), useCreateListing(), useMyListings()
      components/            # ListingCard, ListingForm, FilterBar, AmenityToggle
      types.ts
    chat/
      api.ts                 # getOrCreateConversation(), getMessages(), sendMessage()
      hooks.ts               # useConversation(), useMessages(), useSendMessage()
      components/            # MessageBubble, ChatInput
    notifications/
      api.ts                 # registerPushToken()
      hooks.ts
    reports/
      api.ts                 # createReport()
      hooks.ts               # useCreateReport()
      components/            # ReportButton, ReportDialog
  lib/
    apiClient.ts             # single HTTP client instance (base URL + JWT attach), calls apps/api
    cloudinary.ts            # uploadImage() — compress + upload, returns URL
    config.ts                # reads app_config table: ad frequency, page size, feature flags
    analytics.ts              # trackEvent() — inserts into events table (§14.13)
    queryClient.ts            # TanStack Query client + defaults
```

Note: the admin moderation queue (§14.10) lives in `apps/web`, not `apps/mobile/src/features/` — it's a separate surface with its own auth gate and, eventually, its own `features/admin/` inside the web app.

`apps/web` internal structure (added 2026-07-23 alongside the full-parity decision, §3) — same `features/*` convention as `apps/mobile`, adapted to Next.js:

```
app/                          # Next.js App Router routes — thin, just page composition
  page.tsx                    # marketing landing (public)
  privacy/, terms/            # legal pages (public)
  (auth)/
    sign-in/                  # mirrors apps/mobile's (auth)/sign-in.tsx
    verify-otp/
    onboarding/
  browse/                     # seeker product: browse feed
  listing/[id]/                # listing detail
  listing/new/                  # owner: create/edit listing
  my-listings/                 # owner: manage listings
  chat/[conversationId]/        # chat thread
  admin/                        # founder-only, §14.10
features/
  auth/
    api.ts                     # same shape as apps/mobile's — same apps/api endpoints, different HTTP client
    hooks.ts
  listings/
    api.ts
    hooks.ts
    components/                 # ListingCard, ListingForm, FilterBar — web-specific components, NOT shared React Native components (RN components can't render on web without react-native-web, which this project doesn't use for apps/web; the two apps re-implement the same UI in each's native toolkit, sharing tokens via DESIGN.md/design-tokens.js, not component code)
  chat/
    api.ts
    hooks.ts
    components/
  admin/                        # §14.10
sections/                       # existing marketing page sections (hero, features, waitlist, ...) — unchanged, unrelated to the product features/ above
components/                     # existing marketing/shared presentational primitives — unchanged
lib/
  apiClient.ts                  # HTTP client (base URL + session cookie), calls apps/api — same role as apps/mobile's lib/apiClient.ts
  cloudinary.ts
  queryClient.ts
```

**Explicitly not shared between `apps/mobile` and `apps/web`:** UI components. React Native components don't render in a browser and vice versa — each app reimplements the same screen twice, in its own toolkit (RN views vs. HTML/Tailwind), coordinated only through `DESIGN.md`'s tokens (colors, spacing, type, component *specs*) and the identical `apps/api` DTOs feeding both. This is the real cost of the full-parity decision — see §3's scope-expansion note.

Why feature-based: when a feature (e.g. `chat`) needs to move to a different data source or gain a custom backend endpoint, everything related lives in one place. Type-based folders (`components/`, `hooks/`, `screens/` as top-level siblings) scatter a single feature across the whole tree and get painful past ~10 screens.

### 14.2 Data access layer — never call `apps/api` outside a feature's `api.ts`

Every request to `apps/api` goes through a function in a feature's `api.ts`, returning typed results. Components and `hooks.ts` never call `fetch`/the HTTP client directly — `hooks.ts` wraps `api.ts` calls in TanStack Query.

```
Component → hooks.ts (useQuery/useMutation) → api.ts (HTTP/WebSocket calls) → apps/api
```

**This rule already paid for itself once:** this is exactly the boundary that let GHOR move from Supabase-direct to a custom NestJS backend (the 2026-07-23 architecture pivot, §3) without rewriting a single screen — only `api.ts` files changed, from `supabase-js` calls to `fetch()` calls against `apps/api`. Keep respecting it; the next backend change (whatever it is) should cost the same, near-zero UI impact.

### 14.3 Server state — TanStack Query everywhere, paginate from day one

- Every `api.ts` function gets a `useQuery`/`useMutation` wrapper in `hooks.ts`.
- **Browse feed uses `useInfiniteQuery` with cursor pagination** (`(created_at, id)` keyset) from the very first version — even with 20 listings at launch. Retrofitting pagination after the feed query is embedded in 5 places is the kind of rework this doc exists to prevent.
- Chat sends use optimistic updates (append message locally, reconcile on the WebSocket echo from `apps/api`) so the UI feels instant even on slow mobile networks.
- Centralize query keys in one place per feature (e.g. `listings/queryKeys.ts`) so cache invalidation after mutations (e.g. after creating a listing, invalidate the feed) is consistent.

### 14.4 Database scaling-readiness (Postgres via Prisma)

- Composite index `listings (status, city, created_at desc)` — this is the browse feed query and will be hit hardest. Add `property_type` to it if filter usage is high (`listings (status, city, property_type, created_at desc)`).
- Index `listings (owner_id)`, `conversations (seeker_id)`, `conversations (owner_id)`, `messages (conversation_id, created_at)`, `push_tokens (user_id)`.
- **Cursor pagination, never `OFFSET`**, beyond the first page — `OFFSET` scans get linearly slower as the table grows.
- **Soft state, not deletes** — `listings.status` includes `rented`/`inactive` rather than row deletion, preserving `conversations`/`messages` referential integrity and letting a seeker still see "this room was rented" context in an old chat.
- All schema changes as edits to `apps/api/prisma/schema.prisma`, applied via `prisma migrate dev`/`deploy` (run from `apps/api/`) — never hand-edit schema directly in the database except `app_config` value tweaks via the admin dashboard, once it exists.

### 14.5 Realtime chat — scoped WebSocket rooms + server-side notification

- One Socket.io **room per conversation** (`conversation:<id>`), not a single global messages channel — keeps each client's subscriptions proportional to *their* active chats, not the whole platform. This used to be a per-conversation Supabase Realtime subscription; the scoping principle is identical, just implemented as a Socket.io room in `apps/api` now.
- Always disconnect/leave the room in the `useEffect` cleanup when leaving a chat screen.
- New-message notifications are **server-side**: the message-creation service in `apps/api` sends the Expo push (via tokens in `push_tokens`) and/or email directly to the recipient, in the same request that persists the message — no trigger/Edge-Function indirection needed anymore, since it's already server-side code. This works even if the recipient's app is fully closed — critical per §7.7. Client-side "send notification on send" is not reliable enough for this product's core promise.

### 14.6 Config-driven values — `app_config` table + `lib/config.ts`

Ad frequency, feed page size, and feature flags (`PHONE_OTP_ENABLED`, `FAVORITES_ENABLED`) live in the `app_config` table (§6), read once at app start and cached via TanStack Query with a long stale time. `lib/config.ts` exposes typed getters (`getAdFrequency()`, `isFeatureEnabled('phone_otp')`). Changing ad frequency or flipping on phone OTP later becomes a database row edit, not an app store release — directly serves §7.8's "monitor and dial down" requirement.

### 14.7 Image pipeline

- Compress and resize client-side with `expo-image-manipulator` *before* upload — caps both Cloudinary usage and upload time on slow mobile connections.
- `lib/cloudinary.ts` exposes one `uploadImage(uri): Promise<string>` function, called only from `features/listings/api.ts`. Listing form components never talk to Cloudinary directly.

### 14.8 Environment separation

- Two databases/environments from day one: `ghor-dev` and `ghor-prod` (currently the two existing Supabase Postgres instances, connected to via `DATABASE_URL` — see `apps/api/.env.example`). `apps/api` reads its config via `@nestjs/config`; `apps/mobile`'s `app.config.ts` reads which API base URL to hit from env files (`.env.development`, `.env.production`), selected by EAS build profile.
- This means testing, seeding, and breaking things during development never touches real user data or the moderation queue — important once closed testers are real Guwahati users.

### 14.9 Type safety

- `apps/api/prisma/schema.prisma` is the single source of truth for the DB schema; `prisma generate` produces a fully-typed Prisma Client used inside `apps/api` only — no other app touches Prisma-generated types directly.
- `apps/mobile` and `apps/web` are typed against **DTOs/response shapes from `apps/api`**, not raw DB rows — since neither talks to the database directly anymore, there's no `database.ts`-style generated file to share between them. If request/response types start drifting between the client apps and `apps/api`, that's the trigger to introduce a shared `packages/api-types` (or an OpenAPI/tRPC-generated client) — not needed yet with a single client app actively integrated.

### 14.10 Admin dashboard (`ghor.co.in/admin`)

The admin dashboard is a **protected web app** at `ghor.co.in/admin`, built in `apps/web` (Next.js). It is not inside the mobile app. Access is gated by `apps/api`'s own auth (Google-login JWT, checked against `role = 'admin'`) — not Supabase auth/middleware anymore.

**Sections:**

| Section | Functionality |
|---|---|
| **Listings queue** | Table of `pending` listings with preview (photos, details, owner info). One-click Approve / Reject. Rejected listings get a reason stored for owner visibility. |
| **Reports** | Table of open reports with listing details + reporter reason. Actions: Dismiss (keep listing live) or Confirm (revert listing to `pending` for re-review). |
| **Users** | List all accounts (name, phone, role, signup date, listing count). Ban a user (sets a `banned` flag on `profiles`, blocks auth). |
| **Analytics** | Key funnel metrics from the `events` table: signups over time, listing_view counts, contact_tap rate, chat_started rate. Simple charts — no new vendor, just `recharts` or a lightweight chart library, fed by an `apps/api` analytics endpoint (not a direct DB query from the web app). |
| **App config** | Edit `app_config` table rows (ad frequency, report threshold, feature flags) via a key-value form. Changes take effect immediately in the app without a new build. |

**Why web and not in-app:** The admin dashboard involves complex table views, multi-column filtering, and bulk actions — much better suited to a desktop browser than a mobile screen. Also keeps admin tooling cleanly separated from the user-facing app.

### 14.11 What NOT to do (avoid premature complexity)

- **No microservices** — `apps/api` is one NestJS service, organized into modules internally. The pivot away from Supabase-direct was about owning business logic/authorization, not about decomposing into separate deployable services. Don't split auth/listings/chat into separate services unless there's an actual operational reason to.
- No Redux — TanStack Query covers server state; local UI state is `useState`/`useReducer`, or Zustand only if cross-screen UI state genuinely needs it.
- No multi-region/sharded database — a single Postgres instance is sufficient for Northeast India even at the 12-month success metrics in §13.
- No premature search infrastructure (Elasticsearch/Algolia) — Postgres `ILIKE`/trigram indexes on `locality`/`title` are plenty until search becomes a differentiator, which is a "good problem" far beyond MVP.

### 14.12 Deep linking & sharing

- Configure an Expo Router `scheme` (e.g. `ghor://`) so the `listing/[id]` and `chat/[conversationId]` routes are reachable via deep link.
- **Push → chat:** the Expo push payload includes `conversationId`; on notification tap, a root-level notification response listener (`app/_layout.tsx`) navigates directly to `/chat/[conversationId]` via `expo-router`.
- **Share listing:** uses `Share.share()` to share a text summary (title, rent, locality) plus the `ghor://listing/[id]` deep link. If GHOR is installed, tapping the link opens the listing directly; if not, the link silently fails but the text still carries value. A proper web-based fallback (universal link → Play Store if not installed) is a fast-follow once a landing page exists — don't build link-shortener/Branch-style infra for MVP.

### 14.13 Analytics & event tracking

- `lib/analytics.ts` exposes a single `trackEvent(name, properties?)` function that inserts into the `events` table (§6) — fire-and-forget, never blocks UI or throws into the caller.
- Called from key points: after signup, on listing detail view, on Chat/Call tap (alongside the ad gate), on first message sent in a new conversation, on listing creation.
- Query this table via the database directly, or a simple admin chart in `apps/web`'s dashboard (§14.10) to watch the funnel — this is the mechanism behind §7.8's "monitor and adjust ad frequency" requirement.

---

## 15. Production readiness checklist (mandatory before real users)

These are not "nice to haves" — they are standard practice for any app handling real accounts, and most cost under an hour to set up. Treat this as a launch gate alongside the Play Store 14-day closed-testing requirement (§7.1/§7.9).

1. **Crash/error monitoring — Sentry.** Install `@sentry/react-native` in Week 1, wired into both dev and prod environments (§14.8). Without this, bugs hit by closed testers are invisible until they bother to report them.
2. **OTA updates — EAS Update.** Configure `expo-updates` with separate channels per environment from Week 1. Lets you ship JS-level fixes to testers/users within minutes, without an app-store review cycle — essential during the closed-testing window and the first weeks post-launch.
3. **Privacy Policy + Terms of Service.** Required by the Play Store for any app collecting phone numbers, chat messages, or accounts. A simple static page (GitHub Pages or a page in `apps/web`) is sufficient at MVP — content must cover what's collected (profile info, listings, chat messages, push tokens) and how it's used/moderated.
4. **Account deletion flow.** In-app Settings → "Delete account" → confirm → calls an `apps/api` endpoint that removes/anonymizes the user's `profiles`, `listings`, `messages`, `push_tokens`, and `refresh_tokens` rows. (Simpler than before, in one sense: there's no separate `auth.users` record to delete anymore — `profiles` *is* the user record.) Required by Play Store policy for apps with login.
5. **Basic analytics — `events` table (§6, §14.13).** Track the core funnel (`signup` → `listing_view` → `contact_tap` → `chat_started` → `listing_created`) from Week 2 onward. This is what makes §7.8 ("monitor contact-rate, dial down ad frequency if it suppresses the funnel") actually actionable — without data, that's a guess.

---

## 16. UI & design system

> **This section is now formalized and superseded by [`DESIGN.md`](DESIGN.md)** (repo root) — the full production token system (colors, typography, spacing, shape, elevation, and per-component specs) for both `apps/mobile` and `apps/web`. §16.1–16.3 below are kept as the original brief this section's tables trace back to; if they ever conflict with `DESIGN.md`, **`DESIGN.md` wins** — update this section to match, don't treat this as an alternate spec. §16.4 (screen inventory) and §16.6 (chat quick replies) still apply as-is and are cross-referenced from `apps/mobile/design.md`.

Derived from the approved UI mockups in `assets/`. All screens must match this design — do not deviate without explicit approval.

### 16.1 Color palette

| Token | Value | Usage |
|---|---|---|
| `primary` | `#2563EB` (Tailwind `blue-600`) | CTAs, active states, icons, highlights |
| `primary-dark` | `#1D4ED8` (Tailwind `blue-700`) | Button pressed state |
| `primary-light` | `#EFF6FF` (Tailwind `blue-50`) | Chip backgrounds, card accents |
| `background` | `#FFFFFF` | Screen background |
| `surface` | `#F8FAFC` | Card / input background |
| `text-primary` | `#0F172A` (Tailwind `slate-900`) | Headings, body |
| `text-secondary` | `#64748B` (Tailwind `slate-500`) | Subtext, placeholders |
| `success` | `#22C55E` | Verified badge, checkmarks |
| `destructive` | `#EF4444` | Error states |

### 16.2 Typography

- Font: system default (SF Pro on iOS, Roboto on Android) — no custom font at MVP.
- Heading 1 (screen title): 28–32px, bold, `text-primary`.
- Heading 2 (section title): 20–22px, semibold.
- Body: 15–16px, regular.
- Caption: 12–13px, `text-secondary`.

### 16.3 Component conventions

- **Buttons:** rounded-full, `primary` background, white text, arrow icon on primary CTAs (e.g., "Login →"). Secondary buttons: white background, `primary` border + text.
- **Input fields:** white background, 1px `slate-200` border, `slate-100` on focus ring, left icon for type hint (envelope for email, lock for password, phone for mobile).
- **Cards (listing):** white, `rounded-2xl`, subtle shadow (`shadow-sm`). Amenity tags as small chips with icon + label.
- **Chips (popular areas, amenity filters):** `primary-light` background, `primary` text, `rounded-full`, small padding.
- **Verified badge:** green checkmark circle (`success` color) — shown on owner name and listing card.
- **Bottom nav:** 3 tabs only — Home, Chat, Profile. Active tab icon fills `primary` blue; inactive is `text-secondary` grey.

### 16.4 Screens inventory

| Screen | Route | Status |
|---|---|---|
| Sign Up / Sign In | `(auth)/sign-in.tsx` | Build — redesign to phone number + Google (remove email/password fields) |
| OTP Verification | `(auth)/verify-otp.tsx` | Build — 4-digit box UI as designed |
| Post-auth Onboarding | `(auth)/onboarding.tsx` | Build — name + role selector (new, not in original mockups) |
| Browse Feed (Home) | `(tabs)/index.tsx` | Build — matches mockup exactly |
| Listing Detail | `listing/[id].tsx` | Build — rename "Book Now" → "Chat with Owner" |
| Chat Thread | `chat/[conversationId].tsx` | Build — matches mockup (include quick-reply chips) |
| My Listings (Owner) | `(tabs)/my-listings.tsx` | Build — not in mockups, design to match system |
| Chats List | `(tabs)/chats.tsx` | Build — not in mockups, list of conversations |
| Profile / Settings | `(tabs)/profile.tsx` | Build — not in mockups; include account deletion |
| Create / Edit Listing | `listing/new.tsx` | Build — not in mockups |
| 404 / Not Found | `+not-found.tsx` | Build — matches mockup exactly |
| Forgot Password | *(removed)* | **DO NOT BUILD** — no password auth |
| Reset Password | *(removed)* | **DO NOT BUILD** — no password auth |
| Write a Review | `listing/[id]/review.tsx` (or a sheet) | **Reversed 2026-07-23 — build this.** Gated to seekers who've messaged that listing's owner (§2 "Reviews & ratings"). See `apps/mobile/design.md` for the current, authoritative screen inventory — this table predates it and is kept only for historical mockup mapping. |

### 16.5 Ratings display at MVP

**Resolved 2026-07-23 — real reviews are in scope, this is no longer an open decision.** See §2 "Reviews & ratings" for the actual design (gating, moderation posture, denormalized aggregates, restrained display). The options below were the pre-decision framing; kept for context only.
- ~~Show no rating UI until reviews are live~~ — superseded, reviews are now being built.
- ~~Show a placeholder "New listing" badge instead of stars~~ — this remains the interim treatment only until reviews actually ship; `DESIGN.md`'s `new-listing-badge` component still exists for that gap.

### 16.6 Chat quick-reply chips

The chat screen shows pre-filled suggestion chips: "Is parking available?", "Is WiFi included?", "Can I visit today?", "Security deposit?". These are hardcoded suggestion strings (not dynamic), just insert the text into the message input on tap. Keep this list in a constant array in `features/chat/components/QuickReplies.tsx`.
