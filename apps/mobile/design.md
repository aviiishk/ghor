# GHOR App — Design Notes

> **Canonical design system:** [`../../DESIGN.md`](../../DESIGN.md) — all colors, typography, spacing, shape, elevation, and component tokens live there now and apply to both `apps/mobile` and `apps/web`. This file only holds what's specific to the mobile app: brand framing, the mockup-to-screen mapping, and a couple of mobile-only conventions. **Do not redefine a token here** — if something needs to change, change it in `../../DESIGN.md` first.

Source mockups live in `../../assets/` (see Screen Inventory below for the mapping).

## Brand Direction

GHOR is a trust-first, no-broker room/flat finder for Guwahati. The app should feel clean, fast, and credible — closer to a banking or booking app than a classifieds app. Every screen should reinforce "we verified this listing," not "here's a pile of ads."

Primary goal of the app: get a seeker from install → browse → Chat with Owner in as few taps as possible, and get an owner from install → live listing in under 3 minutes.

## Mobile-only conventions

These aren't tokens (see `DESIGN.md` for those) — they're layout/interaction rules specific to this app:

- Mobile-first, single-column layouts. Don't design anything that assumes a wide viewport (see `DESIGN.md`'s Responsive Behavior — GHOR has no tablet/desktop mobile-app layout).
- **Bottom nav — role-conditional tab count (decided 2026-07-23).** Seekers get 3 tabs — Home, Chat, Profile — matching what's already implemented in `app/(tabs)/_layout.tsx` (`lucide-react-native` icons: `Home`, `MessageCircle`, `User`), unchanged. Owners get a **4th tab, "Listings"**, inserted between Home and Chat — their own listings with `status-pill-*` tokens (same grammar as the admin moderation queue) plus a "+ New Listing" CTA. Suggested icon: `ClipboardList` (`lucide-react-native`), distinct from Home's `Home` icon. **Home stays "Browse feed" for both roles** — owners can browse too (2026-07-23 decision), so Home's content does *not* change by role, only the tab count does. This is a real code change still to make (`app/(tabs)/_layout.tsx` currently renders a static 3-tab array) — see `STATUS.md`, blocked on the current user's role being reliably available client-side (pending the auth rewrite to `apps/api`).
- **Icons:** `lucide-react-native` only, matching the web app's `lucide-react` choice — keep icon sets visually consistent across app and web.
- Motion is minimal: press states only (opacity/color swap per `DESIGN.md`'s Elevation & Depth section), no elaborate page-transition animation.

## Screen Inventory (complete, as of 2026-07-23)

Every route this app needs, grouped by how it's reached. Cross-reference `STATUS.md` for what's actually implemented vs. stubbed — this table is about *intended design*, not completion. Routes marked **NEW** were added in this pass alongside the Airbnb-level feature set (root `CLAUDE.md` §2) and don't exist in the codebase yet at all.

### Auth (pre-tab-bar stack)

| Screen | Route | Mockup source | Notes |
|---|---|---|---|
| Sign in | `app/(auth)/sign-in.tsx` | `LOGIN SCREEN.png`, `signup page.png` | Phone number + Google only, no email/password |
| OTP verification | `app/(auth)/verify-otp.tsx` | `VERIFICATION CODE.png` | 4-digit box UI — `DESIGN.md`'s `otp-box` |
| Post-auth onboarding | `app/(auth)/onboarding.tsx` | *(no mockup)* | Name + role selector |

### Bottom tabs (role-conditional — see Mobile-only conventions above)

| Screen | Route | Seeker | Owner | Notes |
|---|---|---|---|---|
| Home (Browse feed) | `app/(tabs)/index.tsx` | ✅ | ✅ | Search bar, filter chips (incl. institution tags, **NEW** sort options, **NEW** Map/List toggle), listing cards |
| Listings (My Listings) | `app/(tabs)/listings.tsx` | — (tab not shown) | ✅ | **NEW.** Status pills, "+ New Listing" CTA, includes `draft` listings (owner-only visibility) |
| Chat | `app/(tabs)/chats.tsx` | ✅ | ✅ | Conversation list, identical for both roles |
| Profile | `app/(tabs)/profile.tsx` | ✅ | ✅ | Settings, account deletion, recently-viewed list, **NEW** verification status summary |

### Stack screens — shared

| Screen | Route | Notes |
|---|---|---|
| Listing detail | `app/listing/[id].tsx` | Role-conditional CTA (Edit/stats for the owner, Chat/Call for everyone else). **NEW:** `rating-display` + review list + "Write a review" entry point (gated), "Similar listings" row, full-screen photo lightbox, map snippet if geocoded. |
| Chat thread | `app/chat/[conversationId].tsx` | Quick-reply chips, `chat-bubble-*` |
| Owner profile | `app/owner/[id].tsx` | **NEW.** `owner-profile-header` — badges, response rate, member-since, their other approved listings. Reached by tapping an owner's name from a listing card/detail. |
| Write a review | `app/listing/[id]/review.tsx` (or a sheet) | **NEW, reverses the old "do not build" call** — see "Reviews" below. Only reachable if the current user has a qualifying conversation with that listing's owner (root `CLAUDE.md` §2). |
| Notifications | `app/notifications/index.tsx` | **NEW.** In-app activity feed — `notification-item`/`notification-item-unread`. Reached from Profile or a bell icon on the top app bar. |
| Account settings | within `(tabs)/profile.tsx` or a pushed sub-screen | Account deletion entry point |
| 404 | `app/+not-found.tsx` | Match mockup exactly |

### Stack screens — owner only

| Screen | Route | Notes |
|---|---|---|
| Create/Edit listing | `app/listing/new.tsx` | Under 3 minutes. Institution multi-select (type-ahead, not free text). **NEW:** "Save as draft" vs. "Publish," min-3-photos enforced on publish, not on draft save. |
| Listing insights | `app/listing/[id]/insights.tsx` | **NEW.** View count over time, inquiry count, response rate — reuses `admin-stat-tile` styling. Reached from a listing's row in the Listings tab. |

### Sheets/modals (not full-screen routes)

| Sheet | Notes |
|---|---|
| Search/filter | `bottom-sheet`, includes the **NEW** Map/List toggle when Map is active it renders `map-pin`s over a map instead of the sheet content |
| Report/flag | `bottom-sheet`, reason picker |
| Share | native share sheet (OS-level, not a GHOR-designed screen) |

### Removed from scope — do not build

| Screen | Why |
|---|---|
| ~~Forgot Password~~ / ~~Reset Password~~ | No password auth (root `CLAUDE.md` §5) |

## Reviews & Ratings (resolved 2026-07-23 — see `DESIGN.md`'s "Reviews & Ratings" components)

Real reviews are now in scope — the placeholder-vs-omit decision from §12/§16.5 is closed. `rating-display` (a quiet inline star+number, not a second hero number) replaces `new-listing-badge` once a listing has any reviews. The "Write a review" screen is real and gated: only a seeker who's actually messaged that listing's owner can access it. See root `CLAUDE.md` §2 "Reviews & ratings" for the full data model and moderation posture.

## Chat Quick-Reply Chips

Hardcoded suggestion chips on the chat screen: "Is parking available?", "Is WiFi included?", "Can I visit today?", "Security deposit?" — tapping inserts the text into the message input, nothing dynamic. Uses `DESIGN.md`'s `quick-reply-chip` component. Keep this list as a constant array in `src/features/chat/components/QuickReplies.tsx` (not yet created — see STATUS.md).

## Implementation Notes

- Styling via NativeWind (Tailwind classes in RN) — keep class names consistent with `DESIGN.md`'s tokens rather than raw hex values scattered through components.
- Keep feature-specific components in `src/features/<feature>/components/`, not a global `components/` folder (root `CLAUDE.md` §14.1).
- Ad interstitial screens (AdMob) are not part of this design system yet — no mockup exists for the ad gate moment. When built, keep it minimal (native AdMob interstitial, not a custom UI) so it doesn't need its own design pass. `DESIGN.md`'s Known Gaps section tracks this.
