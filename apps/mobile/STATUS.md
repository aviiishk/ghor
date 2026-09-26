# GHOR App — Build Status

> Ground truth for what's actually built vs. stubbed vs. missing. Update this whenever you finish a chunk of work — don't let it drift, since this file exists specifically so Claude Code doesn't assume something is done (or missing) based on a file merely existing.
>
> Last updated: 2026-09-27 — **Redesign carried into key mobile pieces:** `ListingCard` rebuilt (4:3 photo, type/Verified/photo-count/rent overlays, icon amenities, trust footer — solid chips instead of blur for Android performance), browse header as a navy band ("Where do you want to live?"), **server-side debounced search** (`q`) replacing the client-side filter, designed `EmptyState` (`src/components/EmptyState.tsx`), cream canvas, amenity icons, chat types synced (cover image, unreadCount). Verified: `tsc` + `npx expo export --platform android` (bundle compiles, 6.3 MB Hermes). **Not run on a device/emulator.** Not yet ported from web: detail mosaic/lightbox and sticky bar redesign, 6-step create wizard, My Listings dashboard, chats/thread/notifications/profile visual redesign — these still use the pre-redesign layouts (functional).
>
> Previously: 2026-09-26 (latest) — code-review fixes: sign-out unregisters this device's push token first (`unregisterPushToken`); **Resubmit for Review** on rejected listings; edit screen warns about re-review. `tsc` passes.
>
> Previously: 2026-09-26 (later) — **Owner insights** on the owner's own listing detail (`src/features/listings/components/ListingInsights.tsx`) — same tiles/chart as web; tap a bar to read that day (touch has no hover), 'Show as list' as the table view. `tsc` passes; not run on a device.
>
> Previously: 2026-09-26 — **FiltersSheet** on browse (same as web), amenity labels centralized, `contact_tap` on Call/Chat. **Last Supabase-direct code removed:** `lib/analytics.ts` and `lib/config.ts` now call apps/api (`POST /events`, `GET /config`), `lib/supabase.ts` deleted, `@supabase/supabase-js` uninstalled; onboarding no longer sends its own `signup` (server-side now). `EXPO_PUBLIC_SUPABASE_*` env vars are now unused. `tsc` passes. Insights UI not built yet.
>
> Previously: 2026-09-25 (map) — **Map view on browse**: List/Map toggle, `ListingsMapView` = Leaflet in a `react-native-webview` (added, 13.16.1 via `expo install`; works in Expo Go) — chosen over react-native-maps (Google Maps on Android, contradicts the OSM decision) and MapLibre RN (no Expo Go). Pins pushed via `injectJavaScript`, taps come back via `postMessage`, the preview card is native. The WebView's HTML was exercised in a real browser with a stubbed bridge (pins render, taps post `select`, highlight works, re-filter replaces markers). **Unverified on device:** whether the WebView sends a Referer from `baseUrl` — OSM tiles 403 without one (reproduced from `file://`; loads fine from an http origin). **Production blocker:** OSM's public tile servers forbid heavy production use (and 403 any request without a Referer — confirmed in testing), so a keyed tile provider (MapTiler/Stadia free tier) must be configured via `NEXT_PUBLIC_MAP_TILE_URL` / `EXPO_PUBLIC_MAP_TILE_URL` before launch. Also fixed: the browse chip row (3 type + 3 sort chips) overflowed a 360px screen — now a horizontal ScrollView; sort chips hide in Map mode. `tsc` passes.
>
> Previously: 2026-09-25 (latest) — **owner profile screen (`app/owner/[id].tsx`), similar listings row, and sort chips on browse** — mirrors apps/web. Expo typed routes regenerated (`.expo/types/router.d.ts`) for the new route. `tsc` passes; not run on a device.
>
> Previously: 2026-09-25 (later) — **reviews & ratings on listing cards and listing detail** (`src/features/reviews/`): `RatingDisplay`/`New` badge, a `ReviewsSection` inside the detail ScrollView (plain mapped list + "Show more", no nested FlatList), and a `WriteReviewSheet` with the `star-selector` shown only when `viewer.canReview`. No admin UI (moderation is web-only). `tsc` passes; API calls verified live; screens not run on a device.
>
> Previously: 2026-09-25 — **account deletion + name edit on Profile, and working Terms/Privacy links**. `DeleteAccountSheet` (typed DELETE confirmation) calls `DELETE /auth/me` then clears local tokens. Legal links (Profile, sign-in, onboarding) open `apps/web`'s `/privacy`/`/terms` in an in-app browser via `src/lib/legal.ts` (`EXPO_PUBLIC_WEB_URL`, default `https://ghor.co.in` — those pages aren't deployed there yet). `tsc` passes; not run on a device, and the endpoints it calls were verified live 2026-09-25 (see `../api/STATUS.md`); the screens themselves haven't been run on a device.
>
> Previously: 2026-08-19 (yet later the same day) — **push notification registration is built** (`src/features/notifications/pushRegistration.ts`, wired into `(tabs)/_layout.tsx`). Requests permission, gets an Expo push token, registers it with `apps/api`'s new `POST /push-tokens`. The server side is verified live against real Expo infrastructure (see `../api/STATUS.md`) — this client half is code-complete but **cannot be tested end-to-end in this environment**, for two independent reasons, both checked and handled gracefully: Expo Go removed remote push on Android SDK 53+ (same limitation the launch-crash fix already handles, reused via a new shared `src/lib/isExpoGo.ts`), and `EAS_PROJECT_ID` is still the placeholder value in `app.config.ts`/`.env.development`, which Expo requires to mint a real push token. The notification-tap deep-link handler in `app/_layout.tsx` was also extended to route on `listingId` (not just `conversationId`), since listing-approval pushes needed somewhere to go.
>
> Earlier the same day: **Report Listing is built**: `src/features/reports/` (was an empty scaffold dir), a `ReportDialog` bottom-sheet (category chips + free text) reachable via a small "Report" link on listing detail (non-owner view). This is the first client to call `apps/api`'s reports endpoint, and doing so surfaced a real backend gap — nothing stopped an owner from reporting their own listing — fixed server-side, see `../api/STATUS.md`.
>
> Earlier the same day: **the homepage/device-testing session surfaced a real Android networking gotcha** (not a bug in this repo): `EXPO_PUBLIC_API_URL=http://localhost:3000` doesn't resolve inside an Android Emulator, which needs `10.0.2.2` as its host-machine alias — fixed in `.env.development`. Also shipped: a real **Edit Listing** screen (`app/listing/[id]/edit.tsx`, content fields only — `apps/api`'s update endpoint already supported this) and a real **Profile screen** (`(tabs)/profile.tsx`, previously a "coming soon" stub) with a **Notifications** entry point (`app/notifications.tsx`, unread badge shown on the Profile row).
>
> Previously: chat crashed on launch in Expo Go on Android (`expo-notifications` loading remote-push code Expo Go SDK 53+ removed) — fixed via a conditional `require()` that skips the module entirely in Expo Go, see git history for the two-attempt fix writeup. Core loop (auth, browse feed, listing detail, create-listing, My Listings, chat) is complete end-to-end. This app has **no admin UI, by design** — root `CLAUDE.md` §14.10 puts the admin dashboard on `apps/web` only.

## Git state

- This app is now `apps/mobile` inside the GHOR monorepo (restructured 2026-07-23 from a standalone repo called `ghor-app`). The old repo's single `Initial commit` (raw `create-expo-app` scaffold) was dropped rather than preserved — it had no meaningful history worth keeping. See root `STATUS.md`/`CLAUDE.md` for the monorepo-wide git state (as of the restructure, the root repo exists but nothing has been committed yet — check before assuming otherwise).

## Environment & infra

| Item | Status |
|---|---|
| `.env.development` / `.env.production` | ✅ Present, both populated (Supabase URL+anon key, Cloudinary cloud name+preset, Sentry DSN, EAS project ID) |
| Supabase project(s) created (`ghor-dev`/`ghor-prod`) | ✅ `ghor-dev` confirmed **live and migrated** (15 tables, see `../api/STATUS.md`) — used purely as Postgres hosting for `apps/api` now, not accessed via `supabase-js`/RLS from this app (post-pivot). `ghor-prod` untouched so far. |
| `EXPO_PUBLIC_API_URL` | ✅ Added to both env files (2026-08-18) — `http://localhost:3000` for dev (see the in-file comment on Android-emulator/physical-device addressing), a placeholder for prod pending `apps/api` hosting |
| Design tokens | ✅ Wired into code — `tailwind.config.js` imports colors/spacing/fontFamily from `../../design-tokens.js` (shared with `apps/web`). See `../../DESIGN.md`. |
| Cloudinary account | ⚠️ Env vars present; upload flow (`lib/cloudinary.ts`) implemented but untested end-to-end |
| Sentry | ⚠️ DSN present, `@sentry/react-native` installed; init call not yet confirmed wired in `app/_layout.tsx` |
| EAS project | ⚠️ Project ID present; no `eas.json` build profile confirmed yet; will need "root directory" set to `apps/mobile` once configured (monorepo) |
| AdMob | ❌ Not started — no `react-native-google-mobile-ads` dependency, no AdMob account referenced |
| Bulk SMS API (phone OTP DLT route) | ❌ Not started — blocked on founder providing credentials (root `CLAUDE.md` §5, §12) |

## Backend (post-pivot: apps/api, not Supabase-direct)

- The custom backend lives in **`apps/api`** (NestJS + Prisma) — see `../api/STATUS.md`. `ghor-dev` is live and migrated; the auth module is built and verified end-to-end.
- **Auth is rewritten to call it (2026-08-18).** `src/lib/apiClient.ts` (new) is the HTTP client — base URL from `EXPO_PUBLIC_API_URL`, Bearer token attach, single refresh-and-retry on 401, tokens in `expo-secure-store`. `src/features/auth/api.ts` now calls `apps/api`'s `/auth/*` endpoints instead of Supabase Auth.
- **Two files still call Supabase directly and are not part of this rewrite**: `src/lib/analytics.ts` (`trackEvent`) and `src/lib/config.ts` (`getAppConfig`). Both are lower-stakes than auth (analytics silently degrades to `user_id: null`, config falls back to hardcoded defaults) but still need their own rewrite eventually — not blocking, not touched here. `src/lib/supabase.ts` itself is kept only for these two.
- There is no more shared `@ghor/backend` types package — `apps/mobile` is typed against `apps/api`'s response shapes directly (a hand-maintained `Profile` type in `features/auth/api.ts` for now, root `CLAUDE.md` §14.9).

## Auth (`src/features/auth/`) — rewritten, not yet runtime-tested on device

- ✅ `api.ts` rewritten: `signInWithGoogle(idToken)`, `sendPhoneOtp`, `verifyPhoneOtp`, `getProfile`, `completeOnboarding`, `signOut` — all call `apps/api` now. Signatures changed slightly from the old Supabase-direct version (e.g. `getProfile()`/`completeOnboarding()` no longer take a `userId` — it's derived server-side from the JWT).
- ✅ All three auth screens updated to match: `sign-in.tsx`, `verify-otp.tsx` (now checks `profile.fullName` after verify to route returning users straight to `(tabs)`, skipping onboarding — a small correctness fix over the old always-onboard behavior), `onboarding.tsx` (no longer calls Supabase for the current user — nothing to call, the JWT already identifies them).
- ✅ `app/_layout.tsx`'s auth gate rewritten: checks `hasSession()` (local token presence) → `getProfile()` → routes to `(auth)/sign-in`, `(auth)/onboarding`, or `(tabs)`. A failed `getProfile()` call (stale/invalid token) clears the session and falls back to sign-in, rather than getting stuck.
- ⚠️ **Google sign-in's UI button is present but not wired to a real flow.** `signInWithGoogle(idToken)` correctly calls `apps/api`'s contract, but nothing in `sign-in.tsx` obtains an `idToken` yet — that needs an `expo-auth-session` Google flow configured with real Google Cloud OAuth client IDs (iOS/Android/Expo), which don't exist yet (same blocker as `apps/api`'s side — `GOOGLE_CLIENT_ID` is blank in `apps/api/.env` too). The button currently shows a "coming soon, use your phone number" alert instead of failing silently or crashing.
- ⚠️ **No reactive session-expiry handling mid-app-use.** The auth gate above only runs once at launch. If a token expires while the app is open, the *next* authenticated request will throw `SessionExpiredError` (from `apiClient.ts`) — but nothing currently catches that globally to force a redirect; each screen would need to handle it individually (none do yet, since no screens making authenticated calls beyond auth itself exist yet). Worth a global handler once the listings/chat modules add more authenticated screens.
- ✅ **`hooks.ts` added 2026-08-18** — `useProfile()`, closing this gap. Needed for the role-conditional tab bar and the listing-detail "is this my listing" check, both built this pass.
- ❌ **Not yet tested on an actual device/simulator/emulator** — this environment can't run Expo interactively. Verified: `npx tsc --noEmit` passes clean across the whole app. Not verified: the actual runtime flow (network calls from a real Metro bundle, SecureStore behavior, navigation, image picker/upload). The equivalent backend endpoints *were* verified live via curl (`apps/api/STATUS.md`) — this remains the one piece missing before calling any of this fully proven end-to-end, not just this pass's auth section.

## Listings (`src/features/listings/`, `src/features/institutions/`) — built, same device-testing caveat as above

Calls `apps/api`'s listings module (`../api/STATUS.md` — built and curl-verified there). `api.ts` (typed against the real response shape, incl. `owner.phone` only present on the detail fetch, matching the backend's own field selection) + `hooks.ts` (`useBrowseListings` as a real `useInfiniteQuery` — cursor pagination from day one, root `CLAUDE.md` §14.3 — plus `useMyListings`/`useListing`/`useCreateListing`/`useUpdateListing`/`useDeleteListing`) + `components/ListingCard.tsx` + `components/StatusPill.tsx` (shared status-pill grammar, same as the not-yet-built admin queue will use). `features/institutions/` is the same shape, much smaller (type-ahead only, no mutations — the table itself is still empty, see `../api/STATUS.md`).

Two things intentionally not built into this layer yet: text search is client-side-only over already-loaded pages (the backend has no search query param), and there's no cache invalidation tied to push notifications (no push module exists yet either) — a listing's status changing server-side (e.g. admin approval) won't refresh a screen that's already open until the user pulls to refresh or navigates back to it.

## Chat (`src/features/chat/`) — built, same device-testing caveat as above

Calls `apps/api`'s new chat module (`../api/STATUS.md` — built and verified live, including a real Socket.io round trip). `api.ts` (`getOrCreateConversation`, `listConversations`, `getMessages` — cursor-paginated, newest-first — and `sendMessageRest` as the REST fallback) + `hooks.ts` (`useConversations`, `useMessages` as a real `useInfiniteQuery`, `useCreateConversation`) + `socket.ts` (a singleton Socket.io connection, token attached once at connect time from `expo-secure-store`) + `components/QuickReplies.tsx` (the four hardcoded suggestion chips from root `CLAUDE.md` §16.6).

- **Send path**: the chat thread screen sends over the socket when connected (with a per-call ack callback resolving to the persisted `Message`), falling back to `sendMessageRest()` if the socket isn't connected — not full optimistic-UI-with-temp-id reconciliation (simpler than that: the ack round trip is fast enough locally that the sender's own message appears from the ack, not from waiting on the room broadcast; the broadcast is deduped against the cache by message `id` when it arrives for everyone, sender included).
- **Known gap, documented in `socket.ts`'s header comment**: the access token is attached once at `connectSocket()` time and never refreshed — apps/api's access tokens expire after 15 minutes, so a chat screen left open past that window silently stops receiving real-time pushes until the screen unmounts/remounts (which reconnects with a fresh token). Not fixed this pass — same category of "known, bounded, not urgent" gap as the rest of this app's auth staleness handling.
- **`listing/[id].tsx`'s `handleChat()`** now calls `useCreateConversation()` and navigates to `/chat/[id]` on success, replacing the previous "coming soon" alert.

## Screens (`app/`)

| Route | File | Status |
|---|---|---|
| Sign in | `(auth)/sign-in.tsx` | ✅ Built (134 lines) |
| Verify OTP | `(auth)/verify-otp.tsx` | ✅ Built (142 lines) |
| Onboarding (name+role) | `(auth)/onboarding.tsx` | ✅ Built (154 lines) |
| Browse feed (Home tab) | `(tabs)/index.tsx` | ✅ **Built 2026-08-18** — search (client-side filter, see Listings section above), room/flat filter chips, infinite-scroll `FlatList` against `useBrowseListings`, pull-to-refresh, empty/error states. |
| My Listings (owner tab) | `(tabs)/listings.tsx` | ✅ **Built 2026-08-18** — new route, owner-only tab. List of the caller's own listings with `StatusPill`, a "+ New Listing" header button, and an empty state prompting first-time owners to list a property. |
| Chats list tab | `(tabs)/chats.tsx` | ✅ **Built 2026-08-18** — conversation list with the other party's initial avatar, listing title, and last-message preview, pull-to-refresh, empty state |
| Profile/Settings tab | `(tabs)/profile.tsx` | ✅ **Built for real 2026-08-19** — identity card (name/phone/role/phone-verified badge), a Notifications row with an unread-count badge, Sign Out (with a confirm alert). Deliberately minimal: editing name/phone and account deletion (a Play Store requirement, root CLAUDE.md §15.4) are still not built. |
| Tab bar layout | `(tabs)/_layout.tsx` | ✅ **Role-conditional 4th tab built 2026-08-18** — seekers get 3 tabs, owners get "Listings" inserted as a 4th (Expo Router's `href: null` pattern hides it from non-owners while keeping the route reachable). Depends on `useProfile()`, which depends on the auth rewrite — sequencing that was flagged as a blocker last pass is now resolved. |
| Listing detail | `listing/[id].tsx` | ✅ **Built 2026-08-18, updated 2026-08-19** — swipeable photo gallery with page dots, price-display, amenities, institution tags, owner card. Role-conditional action area: a non-owner gets Call (`tel:`, real), **Chat with Owner** (creates/reuses the conversation and navigates to the thread), and now a small **Report** link opening `ReportDialog`; the owner gets the actual status-transition actions their listing's current state allows plus the Edit pencil icon, wired to the real backend guard rather than any client-side reimplementation of that logic. |
| Create listing | `listing/new.tsx` | ✅ **Built 2026-08-18, create only** — full form (type, title, locality, rent/deposit, description, amenity chips, institution multi-select, multi-photo picker via `expo-image-picker` + `lib/cloudinary.ts`), "Submit for Review" (client-side warns before the 3-photo minimum would reject it server-side) vs. "Save as Draft". |
| Edit listing | `listing/[id]/edit.tsx` | ✅ **New 2026-08-19** — content fields only (title, locality, rent, deposit, description, amenities, institutions), reached via a pencil icon on listing detail (owner-only). Photos are shown read-only, not editable: `apps/api`'s update endpoint never touched `images`, only settable at create time, so offering photo edits here would silently no-op. |
| Chat thread | `chat/[conversationId].tsx` | ✅ **Built 2026-08-18** — inverted message list (cursor-paginated, "load more" on scroll-to-top), real-time via a Socket.io room join + `message:new` listener, REST-fallback send, quick-reply chips that insert text (not auto-send), header shows the other party's name from the conversations list cache |
| Notifications | `notifications.tsx` | ✅ **New 2026-08-19** — flat list, unread dot + bold label, "Mark all read" header action, tap navigates to the relevant chat thread or listing and marks that row read. Reads `apps/api`'s new notifications module. |
| Root layout / navigation | `app/_layout.tsx` | ✅ Built — auth gating, splash screen, push-tap deep link. **Fixed 2026-08-18** (two attempts, see git history): `expo-notifications` was crashing the app on launch in Expo Go on Android at import time — now loaded via a conditional `require()` that's skipped entirely in Expo Go, not just a guard around its function calls. |
| 404 | `+not-found.tsx` | ⚠️ Present, not verified against mockup |

## Feature service layers (`src/features/`)

| Feature | `api.ts` | `hooks.ts` | `components/` |
|---|---|---|---|
| `auth` | ✅ | ✅ | — |
| `listings` | ✅ | ✅ | ✅ `ListingCard`, `StatusPill` |
| `institutions` | ✅ | ✅ | — |
| `chat` | ✅ | ✅ | ✅ `QuickReplies` (+ `socket.ts`, not a `components/` file but same feature folder) |
| `notifications` | ✅ **New 2026-08-19** | ✅ | — (`app/notifications.tsx` screen lives at the route level; `pushRegistration.ts` also lives in this folder, not a `components/` file) |
| `reports` | ✅ **New 2026-08-19** | ✅ | ✅ `ReportDialog` |
| `admin` | Not created yet (planned to live in `apps/web`, not this app) | — | — |

## `src/lib/`

| File | Status |
|---|---|
| `apiClient.ts` | ✅ **New, 2026-08-18** — the real HTTP client to `apps/api`. See Auth section above. |
| `supabase.ts` | ✅ Client instantiated — now only used by `analytics.ts`/`config.ts`, not auth |
| `queryClient.ts` | ✅ TanStack Query client configured |
| `cloudinary.ts` | ✅ `uploadImage()` implemented, untested |
| `config.ts` | ⚠️ Still Supabase-direct (`getAppConfig()`), not rewritten in this pass — see Backend section above. `app_config` *does* now exist live in `ghor-dev` (via `apps/api`'s migration), but this file reads it through the old `supabase-js`/PostgREST path, not through `apps/api` — works by coincidence (RLS was never re-enabled post-migration), not by design. Rewrite when convenient, not urgent. |
| `analytics.ts` | ⚠️ Still Supabase-direct (`trackEvent()`), not rewritten in this pass — same PostgREST-coincidence caveat as `config.ts` above, plus `supabase.auth.getUser()` inside it now always returns null (no Supabase session exists anymore), so every tracked event silently gets `user_id: null` regardless of who's actually logged in. Not urgent, but worth knowing analytics attribution is currently broken, not just "not yet built." |

## Not started at all

- Rent-range/amenity filters on the browse feed (only room/flat + text search exist; the backend supports `rentMin`/`rentMax`/`amenities` query params already, see `../api/STATUS.md` — this is a client-side gap, not a backend one)
- Editing a listing's photos (content-field editing is now built, see the `listing/[id]/edit.tsx` row above — photos specifically are excluded because `apps/api`'s update endpoint doesn't touch `images`)
- Photo gallery lightbox (current gallery is swipeable full-width, not a tap-to-zoom lightbox)
- Read receipts and typing indicators in chat (`Message.readAt` exists in the schema, nothing sets it; no typing-indicator event exists on the gateway)
- Editing phone from Profile (name editing built 2026-09-25; phone needs OTP re-verification)
- Share listing flow
- ~~Account deletion flow~~ — built 2026-09-25, not yet device-tested
- Interstitial ad gate before Chat/Call
- Google Play closed testing setup

## Suggested next step

The mobile core loop — auth, browse, detail, create, my-listings, chat, edit-listing, notifications, profile, report-listing, and now push registration — is built end-to-end against real backend modules, and `apps/web` is at parity minus push (by design — web has none). **This app got its first real device run this pass** (Android Emulator via Expo Go) but only as far as the sign-in screen before the session moved to fixing what that run found — the rest of the core loop still hasn't been clicked through on a real device, which remains the single highest-value next step, and the one most likely to actually confirm or deny whether push registration silently no-ops as designed (placeholder `EAS_PROJECT_ID`) rather than throwing.
