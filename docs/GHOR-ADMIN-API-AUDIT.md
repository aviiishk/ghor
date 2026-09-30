# GHOR — Admin Console API Audit (Phase 0, before building `apps/admin`)

| | |
|---|---|
| **Document** | `docs/GHOR-ADMIN-API-AUDIT.md` |
| **Date** | 2026-09-29 |
| **Scope** | `apps/api` (NestJS + Prisma), the legacy admin in `apps/web/app/admin` and the way it reaches the API (the `/api/gateway` BFF), plus the one mobile file relevant to media (`apps/mobile/src/lib/cloudinary.ts`) |
| **Code baseline** | Branch `feature/web-redesign-v2` @ `25b6e38` (same tree as `origin/dev` `a5cde89`). The only untracked path is `docs/` |
| **Decisions baseline** | `docs/GHOR-DECISION-REGISTER.md` D-01…D-47 (settled, **not reopened here**); `docs/GHOR-MASTER-PRODUCT-BLUEPRINT.md` (MPB) §13 and §26 |
| **Method** | Read-only inspection of the source, `schema.prisma` and the single migration, the legacy admin pages and hooks, the BFF, the middleware and CI. The existing Jest suites were run read-only (results in §27). Dev-database counts come from a read-only query run earlier today. **No code, schema, configuration or package was changed.** |
| **Line numbers** | Every `file:line` below was read in this pass. Where only a start line was confirmed, the end is marked **NOT VERIFIED**. Where a behavior was inferred but not executed, it says so |

**Status legend:**

| Icon | Meaning |
|---|---|
| 🟢 READY | Usable as-is |
| 🟡 PARTIAL | Some of it exists |
| 🔴 MISSING | Nothing exists |
| 🟠 NEEDS CHANGE | Exists but conflicts with the decided design |
| ⚠️ SECURITY RISK | Exploitable or unsafe |
| ❓ UNKNOWN | Not verifiable from the repo |

Security checklist items use EXISTS / PARTIAL / MISSING / INSECURE / UNKNOWN.

---

## 1. Executive Summary

`apps/api` is a solid **marketplace** backend, but it isn't yet an **admin** backend.

**What's sound:**
- Authentication primitives: OTP brute-force protection, refresh-token rotation, and the ban check on every request.
- Ownership checks on user endpoints.
- The upload-signature design.
- The Prisma schema matches its single migration.

**What isn't:** every admin capability the decided console needs (D-46, D-47, MPB §26) is either absent or built on a model that has to change:

| Area | Current state |
|---|---|
| Admin identity | One flat `role = 'admin'` string check. No permissions, no `senior_reviewer` / `super_admin`, no admin-audience token, no admin session, no TOTP, no recovery codes, no step-up |
| Audit | **No audit log at all.** Every admin mutation today (approve, reject, ban, role change, config change, hard delete, report resolution, review hiding) leaves no record of who did it |
| Moderation integrity | No listing version, so no optimistic concurrency. Bulk approve/reject has **no state precondition** (it can approve drafts, rented listings or photo-less listings). Admins can edit an owner's content and hard-delete any listing through the owner endpoints |
| Auto-approval | Nothing exists: no scheduler, no job runner, no `auto_approve_at`, no hold, no `approval_source` |
| Trust | Verification, GHOR Verified, appeals, restrictions, subscriptions, payments and API email: none implemented. `idVerificationStatus`, `idDocumentUrl` and `propertyVerified` exist in the schema but no code path writes them |
| Transport and config | `app.enableCors()` allows **any origin**; the Socket.io gateway uses `origin: '*'`; no security headers in the API or in `next.config.ts`; no rate limiting beyond OTP and upload signatures; `/health` returns HTTP 200 when the database is down |
| Production login | **Phone OTP is not implemented in production** (it throws when `SMS_API_URL` is set, and returns 503 when it isn't), and the web Google button isn't wired. **No admin can sign in to a production deployment today**, and the D-47 break-glass path (`ADMIN_PHONES`) depends on the same phone OTP |
| Tests | Zero unit tests. The only e2e suite **fails to compile** (TS5011/TS5101) and targets a `GET /` route that doesn't exist. CI runs typecheck and build only |

**Verdict:** **do not start `apps/admin` yet.** A Phase 0 backend track comes first (§34), in this order:
1. The test harness.
2. A permission guard and the audit log.
3. Closing the unsafe legacy mutations.
4. Listing versioning and the moderation action endpoints.
5. The admin role model and admin authentication (admin-audience tokens, sessions, TOTP, recovery codes, step-up).
6. CORS, headers and rate limits.
7. The auto-approval job.

`apps/admin` can begin once steps 1–5 are merged and tested. The production-SMS dependency must be resolved in parallel (§36, F-02).

---

## 2. Current Architecture

```
Browser (ghor.co.in) ──► Next.js apps/web ──► /api/gateway/[...path] (BFF; reads httpOnly ghor_at/ghor_rt,
                                                 attaches Bearer, refresh-and-retry on 401)
                                                     │
Expo app (apps/mobile) ──── Bearer JWT ─────────────►│
                                                     ▼
                                    apps/api (NestJS, single process)
                                    ├── REST controllers (JwtAuthGuard [+ AdminGuard])
                                    ├── Socket.io gateway (chat)
                                    ├── in-memory state: upload rate limit, geocode cache
                                    └── Prisma ──► Postgres (Supabase-hosted, ap-south-1)
                                    Outbound: Expo push API, Nominatim, Google token verification
                                    Cloudinary: signatures only (the browser uploads directly)
```

| Component | Evidence | Status |
|---|---|---|
| Module list | `apps/api/src/app.module.ts:20-41`: Config, Prisma, Auth, Listings, Institutions, Chat, Reports, Admin, Notifications, Push, PushTokens, Reviews, Owners, Events, AppConfig, Uploads; `HealthController` registered directly (`:39`) | 🟢 |
| Bootstrap | `apps/api/src/main.ts:23-29`: `assertProductionSecrets()` (`:8-21`), `app.enableCors()` with no options (`:26`), global `ValidationPipe({ whitelist: true, transform: true })` (`:27`) | 🟡 (CORS ⚠️) |
| Global guards, filters, interceptors | None registered: no `APP_GUARD`, no `APP_FILTER`, no `APP_INTERCEPTOR` in `app.module.ts`. The only exception filter is `BaseWsExceptionFilter` on the chat gateway (`chat.gateway.ts:38`) | 🔴 |
| Dependencies | `apps/api/package.json`: no `helmet`, no `@nestjs/throttler`, no `@nestjs/schedule`, no queue library, no email SDK, no TOTP library, no payment SDK | 🔴 for admin needs |
| Hosting | Not chosen (CLAUDE.md §3 names Railway as the default). Single versus multiple instances is **UNKNOWN**, and it matters for rate-limit stores, the scheduler and the Socket.io adapter | ❓ |
| Data access | Only `apps/api` talks to Postgres (Prisma). Neither `apps/web` nor `apps/mobile` contains a direct DB client (consistent with CLAUDE.md §3) | 🟢 |

---

## 3. Future Architecture

These are decided in D-46 and D-47 and restated from MPB §26 — not re-decided here:

```
admin.ghor.co.in (staging: admin-staging.ghor.co.in)
  apps/admin (Next.js) ── admin BFF route handlers ── httpOnly, Secure, SameSite=Strict cookies (admin origin only)
        │  (never Postgres; never the user BFF)
        ▼
apps/api  /admin/*  ── AdminAudienceGuard (aud=admin) ── AdminSessionGuard (idle 30 min / absolute 12 h, TOTP done)
                    ── PermissionGuard(permission) ── StepUpGuard (TOTP re-entry within 10 min, sensitive only)
                    ── service: state precondition + version check + audit row IN ONE TRANSACTION
                    ── post-commit side effects (notification/push/email) via an outbox
Jobs: auto-approval tick, claim expiry, session cleanup (DB-driven, idempotent, monitored)
```

**Invariants the API must enforce, regardless of UI:**
- Permissions checked server-side on every call (MPB §26.5: "The UI mirrors it; it doesn't enforce it").
- Admin tokens are rejected on user endpoints, and user tokens on admin endpoints (MPB §26.4).
- No private chat access for any role (MPB §26.5).
- Evidence is never inlined; only short-lived signed URLs, with an access audit row (MPB §26.6).
- `super_admin` doesn't inherit GHOR Verified authority (D-47).
- Claiming never stops the 5-minute timer; only a decision or a Hold does (D-47, MPB §13.3).

---

## 4. Current Admin Implementation

| Capability | Route | Guard | Service | Status |
|---|---|---|---|---|
| Pending queue | `GET /listings/admin/queue` (`listings.controller.ts:83-87`) | `JwtAuthGuard` (class, `:26`) + `AdminGuard` | `ListingsService.findPendingQueue` (`listings.service.ts:478-484`): all pending, `updatedAt asc`, **no pagination** | 🟠 |
| Bulk approve / reject | `POST /listings/admin/bulk-status` (`:89-93`) | same | `bulkSetStatus` (`:486-501`): unconditional `updateMany`, fire-and-forget notifications | ⚠️ |
| Geocode backfill | `POST /listings/admin/geocode-backfill` (`:74-78`) | same | `backfillGeocoding` (`:307`, limit 100) | 🟡 |
| Admin edit or status on any listing | `PATCH /listings/:id` (`:111-118`) | `JwtAuthGuard` only; the admin branch sits in the service (`:520`) | `update` (`:507-599`): admins bypass ownership, content-change re-moderation (`:553-559`) and the transition rules (`:697-699`) | ⚠️ |
| Admin hard delete of any listing | `DELETE /listings/:id` (`:120-124`) | `JwtAuthGuard` only | `remove` (`:739-746`): `prisma.listing.delete`, cascades conversations, messages, reports, reviews | ⚠️ |
| Reports queue | `GET /reports` (`reports.controller.ts:30-31`) | class `JwtAuthGuard` (`:19`) + `AdminGuard` | `findOpen` (`reports.service.ts:100-111`), includes the **reporter's phone** (`:108`) | 🟠 |
| Resolve report | `PATCH /reports/:id` (`:36-37`) | same | `resolve` (`:113-134`): no status precondition; `confirm` forces the listing to `pending` whatever its state | 🟠 |
| Reviews admin | `GET /admin/reviews`, `PATCH /admin/reviews/:id` (`reviews.controller.ts:57-67`) | `JwtAuthGuard, AdminGuard` | `adminList` (`reviews.service.ts:187-198`, take 100); `setHidden` (`:200-215`, transactional aggregate recompute) | 🟡 |
| Users list | `GET /admin/users` (`admin.controller.ts:20-23`) | `JwtAuthGuard, AdminGuard` (`:15-16`) | `listUsers` (`admin.service.ts:13-27`): **every profile, unpaginated**, with `phone` and `googleId` | 🟠 |
| Ban / unban | `PATCH /admin/users/:id/ban` (`:25-28`) | same | `setBanned` (`:46-65`): transaction; revokes refresh tokens when banning. No self-ban guard, no target-role guard, no reason | ⚠️ |
| Role change | `PATCH /admin/users/:id/role` (`:30-37`) | same | `setRole` (`:35-44`): only blocks self-demotion; **any admin can create or demote admins** | ⚠️ |
| Config | `GET /admin/config`, `PATCH /admin/config/:key` (`:39-47`) | same | `setConfig` (`:75-81`): upserts **any key with any JSON value** (`set-config.dto.ts:9-10`) | ⚠️ |
| Analytics | `GET /admin/analytics` (`:49-52`) | same | `analytics` (`:87-109`): nine `count()` queries | 🟡 |

**Namespaces are inconsistent:** `/listings/admin/*`, `/reports`, `/admin/reviews`, `/admin/*`. MPB §26.6 requires `/admin/*` for everything.

---

## 5. Legacy Admin Audit

`apps/web/app/admin/*` (872 lines including `features/admin`) is the legacy admin. **It stays in place until `apps/admin` reaches parity (D-46).**

| Existing Admin Feature | Frontend Route | API Endpoint | API Service | Authorization | Status | Migration Requirement |
|---|---|---|---|---|---|---|
| Pending listings queue + select-all | `/admin` (`app/admin/page.tsx`) | `GET /listings/admin/queue` (`features/admin/api.ts:51`) | `ListingsService.findPendingQueue` | API: `JwtAuthGuard` + `AdminGuard`. UI: client-side role check (`layout.tsx:39`) | 🟠 | Replace with `GET /admin/moderation/queue` (paginated, SLA timers, claim state). Legacy keeps working until cut-over |
| Bulk approve (one click) / reject (confirm dialog) | `/admin` (`page.tsx:102-113, 145-146, 172`) | `POST /listings/admin/bulk-status` (`api.ts:55`) | `bulkSetStatus` | same | ⚠️ | New `POST /admin/moderation/bulk-decision`: pending-only precondition, per-item version, max 50, reason code on reject, per-item audit. **Harden the old endpoint in place** (precondition, cap, audit) while legacy lives |
| Reports: dismiss / confirm | `/admin/reports` (`reports/page.tsx:43, 49`) | `GET /reports`, `PATCH /reports/:id` (`api.ts:62, 66`) | `ReportsService.findOpen/resolve` | same | 🟠 | New `/admin/reports/*` with assignment, resolution reason, resolver id, audit; drop reporter phone from the list projection |
| Reviews hide / unhide | `/admin/reviews` (`reviews/page.tsx:70`) | `GET/PATCH /admin/reviews` (`features/reviews/api.ts:40, 44`) | `ReviewsService.adminList/setHidden` | same | 🟡 | Keep the path; add a permission, reason, audit and pagination |
| Users: ban toggle, role dropdown (no confirmation) | `/admin/users` (`users/page.tsx:49, 83`) | `GET /admin/users`, `PATCH …/ban`, `PATCH …/role` (`api.ts:73, 77, 84`) | `AdminService.listUsers/setBanned/setRole` | same | ⚠️ | Split: marketplace-user restriction (`users.restrict`) versus admin-role management (`roles.manage`, step-up, super_admin only). Remove the ability of the `admin` role to grant `admin` |
| Config key/value editor (creates arbitrary keys) | `/admin/config` (`config/page.tsx:14, 38`) | `GET /admin/config`, `PATCH /admin/config/:key` (`api.ts:91, 95`) | `AdminService.listConfig/setConfig` | same | ⚠️ | Key allowlist + per-key schema + `configuration.manage` (super_admin) + step-up + audit |
| Funnel analytics | `/admin/analytics` | `GET /admin/analytics` (`api.ts:102`) | `AdminService.analytics` | same | 🟡 | Keep; move under the admin audience; add date ranges |
| Access gate | `/admin/*` layout | none (uses `useProfile()` → `GET /auth/me`) | none | `middleware.ts:33-42` checks only that the `ghor_rt` cookie **exists**; `layout.tsx:1, 24, 39-40` is a `'use client'` role check | 🟡 | Fine *as a UX gate* because the API enforces `AdminGuard`. `apps/admin` must not repeat the pattern of relying on a client check |
| Session | shared user session | `/api/gateway/[...path]` | none | **the same `ghor_at` / `ghor_rt` cookies as the marketplace**, `SameSite=Lax` (`app/api/gateway/[...path]/route.ts:16-24`); the gateway forwards **any path** (`:27-40`) | ⚠️ | Replaced by admin-origin sessions (D-47). While legacy lives, an XSS anywhere on `ghor.co.in` yields admin API access (see T-06) |

**Findings across the legacy admin:**

| Class | Finding | Evidence |
|---|---|---|
| Frontend-only authorization | The `/admin` UI gate is client-side only. **Not exploitable**: every legacy admin API route is also `AdminGuard`-protected. The page shell renders for any signed-in user (it contains no data) | `layout.tsx:39`, `middleware.ts:33` |
| Missing API authorization | None found for admin routes. **But** admin power also flows through the *owner* endpoints `PATCH/DELETE /listings/:id` via an `isAdmin` branch in the service, not a guard, so it is invisible in the controller | `listings.service.ts:520-523, 594, 697-699, 742` |
| Duplicated logic | Two moderation paths (`bulkSetStatus` versus admin `update`) with **different rules**: `update` sends notifications and validates institutions; `bulkSetStatus` has no preconditions. Also two report paths set `pending` (threshold `:90-94`, confirm `:127-131`) | `listings.service.ts:486-501` versus `:507-599`; `reports.service.ts` |
| Hard-coded roles | `'admin'` string literals: `admin.guard.ts:20`; `listings.service.ts:126, 333, 520, 742`; `auth.service.ts:251, 396`; `set-role.dto.ts:4`; `UserRole` enum (`schema.prisma:24-30`) | as listed |
| Missing audit logging | **Every** admin mutation. Only `logger.warn` on the `ADMIN_PHONES` promotion (`auth.service.ts:261-263`) and `logger.log` on account deletion (`:457`), both unstructured and non-persistent | none |
| Unsafe mutations | Bulk status without a precondition; admin status change skips the photo check (`assertPublishReady` only runs for `pending`, `:543-546`); admin content edits; admin hard delete; config upsert of any key; role grant by any admin; ban of any user including other admins or oneself; report confirm without a status precondition | §11, §18 |

---

## 6. Authentication Audit

| Item | Evidence | Status |
|---|---|---|
| Phone OTP send | `AuthService.sendOtp` (`auth.service.ts:122` onward): 60 s cooldown (`:22, :129`), 6-digit code via `randomInt` (`:158-160`), bcrypt hash (`:161`), 5-minute TTL (`:21, :163`). A per-number daily cap exists in `:122-146` (exact lines NOT VERIFIED) | 🟢 dev / 🔴 prod |
| **Production SMS** | `SMS_API_URL` unset in production → `ServiceUnavailableException` (`:148-155`). **Set → `throw new Error('SMS_API_URL is set but sending is not implemented yet')` (`:170`).** In development the code is logged with `logger.warn` (`:173-174`) | 🔴 **not implemented** |
| OTP verify | `verifyOtp` (`:180-236`): atomic attempt claim (`updateMany … attempts < 5`, `:195-203`), bcrypt compare (`:205`), atomic consume (`:210-217`), marks `phoneVerified` (`:219-229`), bootstrap promotion (`:230`), banned check (`:231-233`) | 🟢 |
| Google login | `googleLogin` (`:75` onward): fails closed with 503 when `GOOGLE_CLIENT_ID` is unset (`:80-85`), audience-checked verification (`:92`). **Web:** the Google button only shows an error (`handleGoogle` in `apps/web/app/(auth)/sign-in/page.tsx`, from the earlier pass; line NOT VERIFIED) | 🟡 |
| Access token | `issueTokens` (`:283-315`): payload `{ sub, role }` (`:285`), `JWT_ACCESS_SECRET`, 15 min default (`:289`). **No `aud`, no `iss`, no session id, no MFA claim** | 🟠 |
| Refresh token | 30 days (`:298`), `jti` random (`:294`), stored as SHA-256 (`:274-281, 304-312`), rotated with an atomic revoke (`:340-346`), banned re-check (`:348-353`). **Reuse of a rotated token is rejected but does not revoke the token family**: a stolen token redeemed first wins | 🟡 |
| Validation per request | `JwtStrategy.validate` (`jwt.strategy.ts:30-55`) re-reads `role` and `banned` from the database on every request (`:41-45`), so a ban or demotion is effective on the next HTTP call. Bearer header only (`:24`) | 🟢 |
| Logout | Revokes **only the presented refresh token** (`:358-365`); the access token stays valid ≤ 15 min; no "log out all devices" | 🟡 |
| Bootstrap admin | `promoteIfBootstrapAdmin` (`:250-268`) promotes any `ADMIN_PHONES` number to `admin` on **every** phone-OTP login. A demoted bootstrap admin is re-promoted on the next login. Grants flat `admin`, not `super_admin` | 🟠 |
| Onboarding role guard | `OnboardingDto` restricts the role to seeker/owner; an existing admin keeps `admin` (`:382-420`, `:396`); tokens are reissued on a role change (`:416`) | 🟢 |
| Account deletion | `deleteAccount` (`:445-459`): blocked for banned users (`:451-455`); **hard `profile.delete`** (`:456`), cascading to listings, messages, conversations, reports and reviews (`schema.prisma` `onDelete: Cascade` throughout) | 🟠 (evidence loss, see §23) |
| Admin-specific authentication | None | 🔴 |

**Blocking fact for the console:** in production, phone OTP can't send and web Google sign-in isn't wired, so **no admin (or user) can sign in to production today**, and the D-47 break-glass is phone-OTP-based. **This is a hard prerequisite, not a console feature** (F-02).

---

## 7. TOTP / MFA Audit

| Requirement (D-47, MPB §26.4) | Current | Status |
|---|---|---|
| TOTP mandatory for admin, senior_reviewer, super_admin at every sign-in | No TOTP code or library; no schema | 🔴 |
| Enrollment: QR code (RFC 6238, 30 s, 6 digits), confirm with a valid code | none | 🔴 |
| Secret encrypted at rest, never displayed again | No encryption key management exists (no KMS; `ConfigService` environment only) | 🔴 |
| Replay protection (the same code can't be used twice in its step) | none; needs `last_used_step` | 🔴 |
| TOTP attempt rate limit or lockout | none; `@nestjs/throttler` absent | 🔴 |
| Step-up (TOTP re-entry within 10 min) for sensitive actions | none | 🔴 |

**Recovery-code policy (as proposed by the founder; the API has none of it: 🔴):**

| Rule | API requirement |
|---|---|
| **10 single-use codes**, shown **once** | Generated server-side (CSPRNG, ≥ 50 bits each), returned in the enrollment or regeneration response only, never retrievable |
| Stored **hashed** | Slow or peppered hash per code (bcrypt or HMAC-SHA-256 with a server pepper); a batch id |
| Invalidated **on use** | A conditional update `used_at IS NULL → now()` (atomic, so parallel reuse fails) |
| Invalidated **on regeneration** | A regeneration marks the whole previous batch revoked in the same transaction; requires TOTP step-up |
| Use is **logged** | Audit event `admin.recovery_code.used` (actor, session, IP hash, remaining count) |
| A **security notification** is sent | To the account holder and all super_admins (in-app now; email or SMS when channels exist, see §22) |
| **TOTP re-enrollment required** | A session created by a recovery code has the `mfa_reenroll_required` state; only the enrollment endpoints are allowed until it's done |
| **Resets** | `admin`/`senior_reviewer` TOTP reset by a `super_admin`; a `super_admin` reset by a **second** `super_admin`; the **bootstrap super_admin through `ADMIN_PHONES` break-glass, which is infrastructure (a deploy-time environment change + phone OTP), never a UI flow** |
| Recovery operations **audited** | `admin.totp.reset`, `admin.recovery_codes.regenerated`, `admin.breakglass.used` |
| ≤ 2 codes remaining → prompt regeneration (MPB §26.4) | `GET /admin/auth/me` returns `recoveryCodesRemaining` |

**Break-glass caveat:** today `ADMIN_PHONES` grants plain `admin` (`auth.service.ts:266`) and runs silently on every login. For D-47 it must:
- grant `super_admin` (MPB §26.4 "Bootstrap");
- still require TOTP enrollment afterwards;
- write an audit event (`admin.breakglass.used`) and notify the other super_admins.

It depends on production phone OTP working (§6).

---

## 8. RBAC Audit

| Item | Current | Required | Status |
|---|---|---|---|
| Role model | `profiles.role` enum `seeker \| owner \| admin` (`schema.prisma:24-30`): one role per account; the marketplace role and the admin role share one column | `admin`, `senior_reviewer`, `super_admin`; **`super_admin` may additionally hold the `senior_reviewer` capability** (D-47), so it's a **set** of admin roles, separate from the marketplace role | 🟠 NEEDS REDESIGN |
| Guard | `AdminGuard` (`admin.guard.ts:14-25`) compares `req.user.role === 'admin'` (`:20`) | `PermissionGuard` + `@RequirePermission('x.y')` on every admin route | 🔴 |
| Permission catalogue | none | §9 | 🔴 |
| Role assignment | `PATCH /admin/users/:id/role`: any admin can grant `admin` (`admin.service.ts:35-44`) | `roles.manage` (super_admin only) + step-up + audit + second-super-admin approval for `senior_reviewer`/`super_admin` once ≥ 2 exist (MPB §26.5, proposed) | ⚠️ |
| Separation of duties | none | A reviewer can't decide an appeal against their own decision; GHOR Verified only with senior_reviewer | 🔴 |
| Stale comment | `admin.guard.ts:12-13` says an admin only exists via a direct database update. **False**: `ADMIN_PHONES` (`auth.service.ts:250-268`) and `PATCH /admin/users/:id/role` both create admins | 🟠 (doc/code contradiction, §37 DC-5) |
| Existing admin accounts | **Dev: 7 profiles with `role = admin` out of 31** (read-only query, 2026-09-29). Production count ❓ | A mapping to the new roles is a founder decision (F-01) | ❓ |

---

## 9. Permission Matrix

Model: a permission is a string checked by `PermissionGuard`. Roles map to permission sets **in code** (a static, reviewed map versioned with the API). `roles.manage` means *assigning roles to people*, not editing the role→permission map (editing permissions from the UI is not recommended for Phase 0). **`super_admin` is explicitly not "everything"**, per D-47 and MPB §26.5.

| Permission | admin | senior_reviewer | super_admin | super_admin + senior capability | Step-up | Current enforcement |
|---|---|---|---|---|---|---|
| `listings.review` (view queue, detail, history) | ✓ | ✓ | ✓ | ✓ | — | `AdminGuard` only |
| `listings.approve` | ✓ | ✓ | ✓ | ✓ | — | `AdminGuard`, no precondition |
| `listings.reject` (incl. request changes) | ✓ | ✓ | ✓ | ✓ | — | `AdminGuard`, no reason stored |
| `listings.hold` | ✓ | ✓ | ✓ | ✓ | — | 🔴 no hold concept |
| `reports.review` (assign, resolve) | ✓ (non-verified owners) | ✓ | ✓ | ✓ | — | `AdminGuard` |
| `users.restrict` (levels ≤ 4) | ✓ | ✓ | ✓ | ✓ | — | 🔴 only binary `banned` |
| `users.suspend` / `users.terminate` *(proposed split of restrict)* | — | ✓ | ✓ | ✓ | ✓ | `setBanned` by any admin ⚠️ |
| `appeals.review` (not own decisions) | ✓ | ✓ | ✓ | ✓ | — | 🔴 |
| `verification.view` (evidence) | — | ✓ | ✓ break-glass, audited | ✓ | ✓ | 🔴 |
| `verification.approve` | — | ✓ | — | ✓ | ✓ | 🔴 |
| `verification.reject` | — | ✓ | — | ✓ | ✓ | 🔴 |
| `badge.grant` | — (recommend only) | ✓ | — | ✓ | ✓ | 🔴 |
| `badge.revoke` | — | ✓ | — | ✓ | ✓ | 🔴 |
| `badge.suspend` | — | ✓ | — | ✓ | ✓ | 🔴 |
| `admin.manage` (create/disable admin accounts, reset TOTP, end sessions) | — | — | ✓ | ✓ | ✓ | ⚠️ any admin via `setRole` |
| `roles.manage` (assign or remove admin roles and the senior capability) | — | — | ✓ | ✓ | ✓ | ⚠️ any admin |
| `configuration.manage` | — | — | ✓ | ✓ | ✓ | ⚠️ any admin, any key |
| `audit.export` | — | — | ✓ | ✓ | ✓ | 🔴 no audit log |
| *(proposed)* `audit.view` scope | own | own + trust | all | all | — | 🔴 |
| *(proposed)* `reviews.moderate` | ✓ | ✓ | ✓ | ✓ | — | `AdminGuard` |
| *(proposed)* `places.manage` | ✓ | ✓ | ✓ | ✓ | — | 🔴 no admin institution endpoints |
| *(proposed)* `system.health.view` / `.ack` | view | view | view + ack | view + ack | — | 🔴 |
| Private chat read | ✗ | ✗ | ✗ | ✗ | — | 🟢 no admin chat endpoint exists; keep it that way |

The "super_admin" column deliberately **lacks** the verification and badge permissions (D-47). `verification.view` is break-glass for super_admin (MPB §26.5); whether that needs a second approver is open (F-12).

---

## 10. Session Security

| Item | Current (user and legacy admin) | Required (admin, D-47) | Status |
|---|---|---|---|
| Storage (web) | httpOnly cookies `ghor_at` (15 min) and `ghor_rt` (30 days), `Secure` in production, **`SameSite=Lax`**, `path=/` (`gateway route.ts:16-24, 67-69`) | Admin origin only, `Secure`, `SameSite=Strict`, host-only (no `Domain=`) | 🟠 |
| Token exposed to JS | `GET /api/chat/socket-token` returns the access token as JSON (`apps/web/app/api/chat/socket-token/route.ts:28-54`, `:49`) | Admin tokens never exposed to JS | 🟠 (acceptable for chat; not for admin) |
| BFF scope | The gateway forwards **any path and method** (`route.ts:27-40, 81-90`); no allowlist, no `Origin` check | Admin BFF: explicit route allowlist + `Origin`/`Sec-Fetch-Site` check | ⚠️ |
| Idle timeout | none (refresh valid 30 days) | 30 min | 🔴 |
| Absolute timeout | none (refresh rotation extends forever) | 12 h | 🔴 |
| Server-side session record | none (refresh-token rows only; no `session_id` claim) | `admin_sessions` row per sign-in; the access token carries `sid`; revocable | 🔴 |
| Revocation on role removal or ban | Effective per HTTP request via DB lookup (`jwt.strategy.ts:41-45`); refresh tokens revoked on ban (`admin.service.ts:57-62`). The socket re-checks ban status (`chat.gateway.ts:54-70`) | Also end admin sessions | 🟡 |
| Session list / "sign out everywhere" | none | `GET/DELETE /admin/auth/sessions` | 🔴 |
| CSRF | Lax cookies block cross-site POST, but **`admin.ghor.co.in` and `ghor.co.in` are the same site**, so SameSite doesn't separate them | Strict + `Origin` check + a separate cookie namespace | 🟠 |
| Cookie presence middleware | `middleware.ts:33` (presence only) | Admin middleware may do the same; the API remains the authority | 🟢 pattern |

---

## 11. Listing Moderation Audit

| Item | Evidence | Status |
|---|---|---|
| Lifecycle | `ListingStatus` = draft / pending / approved / rejected / rented (`schema.prisma:39-50`). MPB §26.9 vocabulary (Needs changes, Paused, Archived, Suspended, Automatically approved, Restored) is absent | 🟠 NEEDS MIGRATION |
| Create | Always `draft` (`listings.service.ts:84`); the schema default is `pending` (`schema.prisma:180`) | 🟢 (doc/schema drift, §37 DC-2) |
| Owner transitions | draft→pending, rejected→pending, approved↔rented (`:700-706`); ≥ 3 photos to publish (`:713-723`); a content edit on a live listing returns it to `pending` (`:553-559`) | 🟢 |
| **Admin transitions** | `resolveStatusTransition` returns any requested status for admins (`:697-699`); **draft→approved skips the photo check** (it only runs for `pending`, `:543-546`) | ⚠️ |
| **Admin content editing** | The admin passes the ownership check (`:520-523`) and may change the title, description, rent, images and institutions of an owner's listing; not re-moderated (`!isAdmin`, `:554`); the owner isn't told what changed | ⚠️ (no audit, no policy basis in MPB §26.10: the action list has no "edit owner content") |
| **Bulk** | `bulkSetStatus` (`:486-501`): no current-status filter (it can approve drafts, rented, rejected or photo-less listings), no size cap (`bulk-update-listings.dto.ts:3-11` has `ArrayMinSize(1)` but **no `ArrayMaxSize`**), no reason, no version, not atomic with notifications | ⚠️ |
| Rejection reason | none: no field, no DTO input. CLAUDE.md §14.10 says "Rejected listings get a reason stored for owner visibility" → **NOT IMPLEMENTED** | 🔴 |
| Structured Listing Review Report (D-20, MPB §13.5) | none | 🔴 |
| Hold / request changes / pause / restore / mark suspicious / escalate / notes (MPB §26.10) | none | 🔴 |
| Approval source (manual / automatic-5min / automatic-verified) | none | 🔴 |
| Moderation history | none (`updatedAt` only) | 🔴 |
| Owner notification on decision | `notifyOwner` (`:601-628`): notification row + push, fire-and-forget, `.catch(() => {})` swallows failures silently | 🟡 |
| Admin delete | hard delete (`:739-746`) | ⚠️ replace with pause/archive; deletion only via a retention policy |

---

## 12. 5-Minute Auto-Approval Audit

**Current: 🔴 MISSING.** Nothing exists:
- no `@nestjs/schedule`;
- no job runner;
- no `auto_approve_at`, `approval_source`, `held_at` or `version` fields;
- the only timers in `apps/api` are a geocoder throttle (`geocoding.service.ts:95`) and a DB connect retry (`prisma.service.ts:66`).

**Decided behavior** (D-17/D-18 via MPB §13; D-47): a non-verified owner's pending submission auto-approves after 5 min unless an admin **decides** or **Holds**; claiming doesn't stop it. A verified owner's submission is approved immediately, with post-review.

**Design requirements** (PROPOSED; implementation is Phase 0 step 9):

| Aspect | Requirement |
|---|---|
| **Mechanism** | **No `setTimeout` in a request handler** (lost on restart and duplicated across instances). A **database-driven due time**: on `pending` entry, set `auto_approve_at = submitted_at + interval '5 min'` (from `app_config`, allowlisted key). A **poller** runs every 15–30 s and selects due rows. Phase 0 recommendation: an in-process interval (`@nestjs/schedule`, one new package, **not installed now**) guarded by a Postgres advisory lock (`pg_try_advisory_lock`), so only one instance runs a tick. A Postgres-backed queue (e.g. pg-boss) is the upgrade path; **Redis/BullMQ isn't needed** at this scale (§35) |
| **Selection** | `status='pending' AND approval_track='free' AND held_at IS NULL AND auto_approve_at <= now() AND risk_flag_count = 0` (risk-flag handling pending founder Q-10) `AND owner not restricted`, `ORDER BY auto_approve_at LIMIT 100 FOR UPDATE SKIP LOCKED` |
| **Transition** | Per row, in one transaction: conditional `UPDATE … SET status='approved', approval_source='automatic_5min', approved_at=now(), version=version+1 WHERE id=$1 AND version=$v AND status='pending' AND held_at IS NULL`, then an insert into `audit_log` (actor = `system:auto_approval`) and an **outbox** row for the owner notification. Zero rows updated → skip (an admin acted first) |
| **Duplicate prevention** | The advisory lock (one runner) + `SKIP LOCKED` (no double pick) + the conditional update on `status`/`version` (no double approve) |
| **Idempotency** | Re-running a tick is harmless: an approved row no longer matches. Outbox rows keyed by `(listing_id, version, event)` with a unique constraint, so a notification is sent at most once |
| **Admin race** | An admin decision uses the same `version` precondition. Whoever commits first wins; the loser gets `409 CONFLICT` (admin) or a skip (job). A Hold sets `held_at` and bumps the version, so the job's predicate fails |
| **Timezone** | Store `timestamptz` (UTC); compare with DB `now()`, **never the app clock**. Display in IST in the console only. The current schema uses Prisma `DateTime` (timestamptz) |
| **Failure handling** | The job crashing or the API being down → listings approve **late, never early**. Catch-up after an outage approves everything overdue at once. **Whether to do that, or to require a human after an outage longer than N minutes, is a founder decision (F-04)** |
| **Retries** | A failed row stays due and is retried on the next tick; after N failures (e.g. 5) it's flagged `auto_approval_error` and surfaced on the dashboard as a system alert; a bounded batch per tick |
| **Deployment** | Works with one or many instances (advisory lock). **Staging and production must use separate databases** (they do, CLAUDE.md §14.8) so a staging job can't touch production. A kill switch: `app_config.auto_approval_enabled` (allowlisted) |
| **Monitoring** | A `job_runs` row per tick (started, finished, picked, approved, skipped, errors) + a heartbeat. The dashboard alerts when the last successful tick is older than 2 min, or when the oldest overdue `auto_approve_at` is older than 2 min (MPB §26.8 "System alerts") |
| **Audit events** | `listing.auto_approval.scheduled` (on submit), `listing.hold`, `listing.hold_released`, `listing.auto_approved`, `listing.auto_approval.skipped_conflict`, `listing.auto_approval.failed`, `listing.approved.verified_owner`, `listing.post_review.completed` |
| **Verified-owner path** | No timer: approved in the submit transaction (`approval_source='automatic_verified'`) + post-review queue entry. Depends on GHOR Verified state (§17) |

---

## 13. Queue / Assignment Audit

| Item | Current | Required | Status |
|---|---|---|---|
| Listing queue | All pending, oldest by `updatedAt`, no pagination, no filters (`listings.service.ts:478-484`) | Keyset-paginated; tracks (free / verified post-review / high-risk / needs-changes / stale); sort by time remaining; counts | 🟠 |
| Report queue | All `pending`, oldest first, no pagination (`reports.service.ts:100-111`) | Tiered, assignable, SLA | 🟠 |
| Claim / assignment | none | `POST /admin/queues/items/:id/claim` soft lock (10 min, MPB §26.6); **"Claimed" is assignment metadata, never a listing status, never shown to users, never stops the timer** (D-47) | 🔴 |
| Claim storage | none | `queue_claims(item_type, item_id)` unique + `expires_at`; take-over with audit; expiry job or lazy expiry on read | 🔴 |
| SLA timers | none | Countdown to `auto_approve_at`; oldest-unassigned report age | 🔴 |

---

## 14. Concurrency Audit

| Scenario | Current behavior | Status |
|---|---|---|
| **Listing version 17 → admin A approves → 18; admin B rejects based on 17** | No `version` column (`schema.prisma:166-208`). `bulkSetStatus`: unconditional `updateMany` (`:493-496`); `update`: read then write (`:508` then `:583`). **B's reject silently overwrites A's approve (last write wins); the owner gets "approved" then "rejected".** Required: B's request carries `expectedVersion: 17`; `UPDATE … WHERE id=? AND version=17` affects 0 rows → **409 `LISTING_VERSION_CONFLICT`** returning the current version and state | ⚠️ |
| Admin reviews at T0, owner edits a **pending** listing at T1, admin approves at T2 | A content change on `pending` doesn't bump anything (the re-moderation rule only covers approved/rented, `:553-559`), so **the admin approves content they never saw** | ⚠️ |
| Report threshold revert versus admin approve | `maybeRevertToPending` reads the status, then updates (`reports.service.ts:68-96`), not conditional; it can revert right after an approval or be overwritten by one | 🟠 |
| Report confirm | Forces `pending` on *any* status (`:127-131`), e.g. **rented→pending, rejected→pending, draft→pending** | 🟠 |
| Auto-approval versus admin decision | N/A today; handled by the §12 design | 🔴 |
| Parallel refresh / OTP | Correct atomic patterns already exist (`auth.service.ts:195-203, 340-346`), **proof that the team has a conditional-update idiom to reuse** | 🟢 |
| Duplicate reports | `findFirst` then `create` (`reports.service.ts:42-59`), not atomic; mitigated by distinct-reporter counting (`:77-82`) | 🟡 |

**Required rule:** every moderation mutation is a conditional update on `(id, version, expected status)` that increments `version`, inside a transaction together with the audit insert. Owner edits increment `version` too. Bulk actions carry a version per item and return per-item results (`ok` / `conflict` / `invalid_state`).

---

## 15. Audit Logging Audit

**Current: 🔴 MISSING.** No table, no service, no interceptor. The `events` table (`schema.prisma:324-334`) is **product analytics**: client-writable (`events/dto/create-event.dto.ts:6-10`), `userId SetNull` on deletion, no actor role, no target, no before/after. **It must not be reused as the audit log.**

**Required (MPB §26.12):** actor + the role at the time; action; target; reason codes + note; redacted before/after; session id, IP hash, user agent, step-up time; request id; append-only; retention ≥ 1 year (3 proposed, F-09); export by super_admin only.

**Transaction boundary (the rule):**

1. **State-changing admin actions:** the audit row is inserted **inside the same `prisma.$transaction`** as the mutation, **after** the conditional update succeeds. If the audit insert fails, the whole transaction rolls back and the mutation doesn't happen. No mutation without an audit row, and no audit row for a mutation that didn't happen.
2. **Side effects** (notification rows, push, email): written as **outbox rows in the same transaction**, delivered **after commit** by a worker. Today's `notifyOwner` fire-and-forget (`listings.service.ts:601-628`) is outside any transaction and can send an "approved" push for an update that later failed, or be lost silently.
3. **Sensitive reads** (evidence view, audit export, PII reveal): the audit row is written **before** the signed URL or data is returned. If the audit write fails, the endpoint fails closed with a 500 and no URL.
4. **Authentication and security events** (login success or failure, TOTP failure, recovery-code use, break-glass): written in their own transaction (there may be no mutation); failures must still be persisted (a failed-login audit can't depend on a successful login).
5. **System actors:** jobs write with `actor_type='system'`, `actor_id='auto_approval'`.
6. **Append-only enforcement:** no update or delete endpoint; the Prisma service exposes only `create`. **Database-level enforcement needs infrastructure**: either a separate DB role for the API with `INSERT, SELECT` only on `audit_log`, or a trigger that raises on `UPDATE`/`DELETE`. Today the API connects with a single Supabase connection string (❓ which role; likely the owner role), so neither exists (§32).
7. **Integrity:** per-row `hash = sha256(prev_hash || canonical(row))` or a daily checksum (MPB §26.12, proposed). A chain requires serialized inserts; a daily checksum is cheaper (F-09).
8. **Cascades:** `audit_log` must hold **no foreign keys with `onDelete: Cascade`** to profiles or listings (store ids and a snapshot); today every relation cascades (§23), which would delete evidence.

---

## 16. Verification Audit

| Item | Evidence | Status |
|---|---|---|
| Schema fields | `Profile.idVerificationStatus` enum none/pending/verified/rejected (`schema.prisma:62-69, 118`); `Profile.idDocumentUrl` (`:122`); `Listing.propertyVerified` (`:184`) | 🟡 fields only |
| Write paths | **No endpoint or service writes any of the three.** `propertyVerified` is documented as admin-settable (CLAUDE.md §6) but no API sets it → **NOT IMPLEMENTED** | 🔴 |
| Read paths | `owners.service.ts:23-31, 85` returns `idVerificationStatus` publicly (a badge only); `getProfile` omits `idDocumentUrl` (`auth.service.ts:371`) | 🟢 projection |
| Document storage | none. **`idDocumentUrl` as a URL column is the wrong model** for evidence: it implies a fetchable URL. It must hold a private object key in an access-controlled store, served only through ≤ 5-min signed URLs (MPB §26.6). A public Cloudinary `image/upload` URL is unacceptable for ID documents | 🟠 NEEDS REDESIGN |
| Verification cases, reviewer, decision, reasons, expiry | none | 🔴 |
| Evidence access log | none | 🔴 |
| **Document requirements** | Which documents (ID, ownership or authority proof, utility bill…), retention, redaction, DPDP basis: **OPEN, not decided anywhere in D-01…D-47. This audit does not invent them.** | ❓ OPEN (F-06) |

---

## 17. GHOR Verified Audit

| Item | Current | Status |
|---|---|---|
| Badge state (active / suspended / revoked / expired), granted_by, granted_at, expiry, re-verification triggers | none; the only related fields are the three in §16 | 🔴 |
| Paid plans (Free 3 listings/month, no badge; ₹299: 5/month; ₹599: 12/month; first 50 eligible get 5 months free — decided) | No plan, subscription, entitlement, quota or promotion counter | 🔴 |
| Listing quota enforcement | none (owners can create unlimited listings) | 🔴 |
| Authority separation | N/A; must be `badge.*` under senior_reviewer only (D-47) | 🔴 |
| Verified-owner immediate approval + post-review | N/A (§12) | 🔴 |
| Public projection | `idVerificationStatus` exposed by `owners.service.ts:85`; no "GHOR Verified" field | 🟠 |

Dependency: GHOR Verified needs §16 (cases), a payment decision (§21) and badge-state tables. **None of it is Phase 0** (§35).

---

## 18. Reports / Trust & Safety Audit

| Item | Evidence | Status |
|---|---|---|
| Create report | `ReportsService.create` (`reports.service.ts:18-63`): only approved or rented listings (404 otherwise, `:25-30`); no self-report (`:35-37`); one open report per reporter (`:42-50`); categories (`reports/dto/create-report.dto.ts:14-15`); reason ≤ 1000 characters | 🟢 |
| Threshold auto-revert | Distinct open reporters ≥ `report_threshold` (default 3) → `pending` (`:68-96`). Config read `typeof value === 'number'` (`:85-88`); **a value of 0 or less makes any single report revert** a live listing, and nothing validates the key (§4, T-21) | 🟠 |
| Resolve | `dismiss` → `dismissed`; `confirm` → listing `pending` + report `reviewed` in a transaction (`:113-134`). No resolver id, no resolution note, no status precondition (a dismissed report can be confirmed later), sibling open reports stay open | 🟠 |
| Tiers, SLA, assignment, investigation, evidence snapshots of chat excerpts (MPB §15) | none | 🔴 |
| Restrictions (levels 1–5, MPB §14.2) | Only a binary `banned` (`schema.prisma:109`) | 🔴 |
| Review moderation | `hidden` flag + transactional aggregate recompute (`reviews.service.ts:200-237`) | 🟢 logic, 🔴 audit |
| PII in the admin list | `findOpen` includes the reporter's `phone` (`:108`) | 🟠 (minimize) |
| Report index | `@@index([listingId])` only (`schema.prisma:320`); no `(status, createdAt)` for the queue | 🟠 |

---

## 19. Appeals Audit

**🔴 MISSING.** No model, endpoint or eligibility flag. D-20 (MPB §13.5) requires "Appeal (if eligible)" in the Listing Review Report, and MPB §26.5 requires that **the decider can't decide an appeal against their own decision**. This needs `appeals` (target type/id, the decision being appealed, `decided_by` of the original, the appellant, text, status, the reviewer, the outcome) and a check `appeal.reviewer_id != original_decision.actor_id` in the service, not only in the UI. It depends on moderation decisions being recorded (§11/§15). **Phase 1, not Phase 0.**

---

## 20. Media / Cloudinary Audit

| Item | Evidence | Status |
|---|---|---|
| Signed-upload endpoint | `POST /uploads/signature` (`uploads/uploads.controller.ts:7-14`, `JwtAuthGuard`) → `UploadsService.sign` (`uploads.service.ts:63` onward): signs `allowed_formats`, `overwrite=false`, `public_id=ghor/listings/<uuid>` (`:74`), `timestamp`, `transformation` (`:78-80`, SHA-1 as Cloudinary requires) | 🟢 |
| Signature rate limit | 120 per user per hour (`:40`), **in memory per instance** (`:49`) | 🟡 |
| Not configured | 503 "Photo uploads are not configured on this server" (`:64-69`) | 🟢 |
| Own-cloud URL validator | `isOwnCloudinaryImage` (`listings/dto/create-listing.dto.ts:30-39`), regex `^https://res.cloudinary.com/<cloud>/image/upload/(v\d+/)?ghor/[\w./-]+$` (`:35`); ≤ 20 images (`:125`) | 🟢 |
| **Mobile uploads** | `apps/mobile/src/lib/cloudinary.ts:4` reads `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`; `:20` `formData.append('upload_preset', UPLOAD_PRESET)`: **the Expo app still uses the unsigned preset. Confirmed.** | 🟠 |
| **Does the API reject mobile URLs?** | The API accepts only URLs under `…/image/upload/(v…/)?ghor/…`. A preset **without** a `ghor/` folder produces URLs the API **rejects** (a 400 at listing create/update). **Which folder the unsigned preset writes to is configured in the Cloudinary console: NOT VERIFIED.** If the preset writes into `ghor/…`, mobile URLs pass **and** the unsigned preset is an unauthenticated upload path into GHOR's namespace | ⚠️ / ❓ |
| Fix | **Out of scope; not fixed here** (standing rule: don't touch `apps/mobile`). Recommended future work: move mobile to `POST /uploads/signature`, then disable the unsigned preset | — |
| Deletion | No Cloudinary destroy anywhere; account deletion leaves images (`auth.service.ts:443-444` comment) | 🟠 |
| Admin media review needs (full-size, duplicate hash, video, EXIF hint; MPB §26.10) | none; no perceptual hash, no video pipeline | 🔴 (Phase 1) |
| Verification evidence media | must **not** use this public pipeline (§16) | 🔴 |

---

## 21. Payment / Subscription Audit

**🔴 MISSING.**
- No provider SDK in `apps/api/package.json`.
- No plans, subscriptions, entitlements, invoices, webhooks or refunds.
- No promotion counter (first 50).

**The provider is NOT chosen and this audit doesn't choose one** (CLAUDE.md §3 mentions Razorpay "later"; that isn't a decision recorded in D-01…D-47 for this scope).

Admin-side requirements for when it's built:
- read-only subscription views for all admin roles;
- changes and refunds for super_admin only (MPB §26.5, Phase 2);
- webhook signature verification;
- idempotency keys;
- an audit row for every manual entitlement change.

**Not Phase 0.**

---

## 22. Email / SMS Audit

| Channel | Evidence | Status |
|---|---|---|
| **Production SMS (OTP)** | `auth.service.ts:148-155` (503 when unset), `:170` (**throws "not implemented" when set**), `:173-174` (the development-only code log) | 🔴 **confirmed not implemented** |
| DLT registration | provider responsibility (CLAUDE.md §5); provider not chosen | ❓ |
| API email | none. No SDK, no `email` column on `Profile` (`schema.prisma:103-136`) | 🔴 |
| Web email | `apps/web/lib/email.ts:1, 55-65`: Resend, **waitlist welcome only**; not usable by `apps/api` | 🟡 (unrelated) |
| Push | `push.service.ts`: Expo push API (`:16`), optional `EXPO_ACCESS_TOKEN` (`:39`), `fetch` (`:48`) | 🟢 |
| Admin security notifications (recovery-code use, break-glass, TOTP reset) | none; in-app only is possible today via the `notifications` table, but its `NotificationType` enum has 4 marketplace types (`schema.prisma:94-101`) | 🔴 |
| Delivery logs (MPB §26.7 "Notifications: templates, delivery logs, failures") | none; push errors are swallowed (`listings.service.ts:627`) | 🔴 |
| Owner email fallback (CLAUDE.md §7.7) | documented, **NOT IMPLEMENTED** | 🔴 |


---

## 23. Database Audit

**Schema:** `apps/api/prisma/schema.prisma` (372 lines). **Migrations:** only `20260818062250_init`. A keyword spot-check of the migration SQL found `'draft'`, `reason_category`, `latitude`, `avg_rating`, `id_document_url`, `last_active_at`, `property_verified`, `phone_verified` and `notification_type`, so **no drift was detected** for the fields checked. (This isn't a full `prisma migrate diff`, which would need a database connection and wasn't run.)

**Dev data** (read-only, 2026-09-29):
- 0 listings, 0 listing images, 0 institutions;
- 31 profiles (11 owners, 7 admins);
- 1 push token;
- `app_config` holds only `report_threshold = 3`.

Key: EXISTS · PARTIAL · MISSING · NEEDS MIGRATION (add columns or values to an existing model) · NEEDS REDESIGN (the current shape is wrong for the target).

| Required model / field | Current evidence | Verdict |
|---|---|---|
| Admin roles (`admin`, `senior_reviewer`, `super_admin` + senior capability on super_admin) | `UserRole` seeker/owner/admin (`:24-30`), one per profile (`:108`) | **NEEDS REDESIGN**: a separate `admin_role_assignments(profile_id, role, granted_by, granted_at, revoked_at, revoked_by)`; keep `profiles.role` for the marketplace side |
| Admin TOTP secret | none | **MISSING**: `admin_mfa(profile_id PK, secret_ciphertext, key_version, enrolled_at, last_used_step)` |
| Recovery codes | none | **MISSING**: `admin_recovery_codes(id, profile_id, batch_id, code_hash, used_at, revoked_at, created_at)` |
| Admin sessions | `RefreshToken` has no audience, session or MFA fields (`:139-150`) | **MISSING**: `admin_sessions(id, profile_id, created_at, last_seen_at, idle_expires_at, absolute_expires_at, mfa_verified_at, step_up_at, ip_hash, user_agent, revoked_at, revoked_reason)`; admin refresh tokens linked by `session_id` (or a separate `admin_refresh_tokens`) |
| Audit log | none; `Event` is analytics (`:324-334`) | **MISSING**: `audit_log` (§15), **no cascading FKs**, append-only |
| Security events (login failures and similar) | none | **MISSING** (may share `audit_log` with `category`) |
| Listing `version` | none (`:166-208`) | **NEEDS MIGRATION**: `version Int @default(1)` |
| Listing approval metadata | none | **NEEDS MIGRATION**: `submitted_at`, `auto_approve_at`, `approval_source` enum (manual / automatic_5min / automatic_verified), `approved_at`, `approved_by`, `held_at`, `held_by`, `post_review_status` |
| Listing statuses | draft/pending/approved/rejected/rented (`:39-50`) | **NEEDS MIGRATION**: add `needs_changes`, `paused`, `archived` (+ `suspended` if kept distinct), per MPB §26.9. **The exact vocabulary is a product decision** (it touches web and mobile rendering) |
| Schema default status | `@default(pending)` (`:180`) versus code `draft` (`listings.service.ts:84`) | **NEEDS MIGRATION** (low risk): align to `draft` |
| Listing snapshots (diff since the last approval) | none | **MISSING**: `listing_snapshots(listing_id, version, content jsonb, media jsonb, created_at)` |
| Moderation decisions / review reports | none | **MISSING**: `moderation_decisions(id, listing_id, listing_version, decision, reason_codes[], owner_message, internal_note, actor_type, actor_id, created_at)` |
| Queue claims | none | **MISSING**: `queue_claims(item_type, item_id, claimed_by, claimed_at, expires_at)`, unique `(item_type, item_id)` |
| Reports: resolver, resolution, tier, assignment | `Report` (`:307-322`): status + reason only | **NEEDS MIGRATION**: `resolved_by`, `resolved_at`, `resolution_note`, `tier`, `assigned_to`; index `(status, created_at)` |
| Restrictions | `banned` bool (`:109`) | **NEEDS REDESIGN**: `user_restrictions(user_id, level, reason_code, note, imposed_by, starts_at, ends_at, lifted_by, lifted_at)`; keep `banned` as a derived or legacy flag during migration |
| Appeals | none | **MISSING** (Phase 1) |
| Verification cases / evidence / access log | fields only (`:118, :122, :184`) | **NEEDS REDESIGN**: `verification_cases`, `verification_evidence(case_id, storage_key, mime, sha256, uploaded_at, purge_after)`, `evidence_access_log`; deprecate `idDocumentUrl` |
| GHOR Verified badge state | none | **MISSING** (Phase 1): `owner_verification_badges(owner_id, state, granted_by, granted_at, expires_at, suspended_*, revoked_*)` |
| Plans / subscriptions / entitlements / payments / promotion counter | none | **MISSING** (Phase 2; the first-50 promotion counter may be earlier, per the roadmap) |
| Places (aliases, adjacency; MPB §26.7) | `Institution` + `ListingInstitution` only (`:225-248`) | **PARTIAL** |
| Job runs / system alerts | none | **MISSING**: `job_runs`, `system_alerts` |
| Outbox for notifications and email | none | **MISSING**: `outbox(id, topic, dedupe_key UNIQUE, payload, attempts, next_attempt_at, sent_at, last_error)` |
| Notification types for admin or security events | 4 values (`:94-101`) | **NEEDS MIGRATION** |
| `app_config` audit fields | `updatedAt @default(now())`, **not `@updatedAt`** (`:302`), so it never changes on update; no `updated_by` | **NEEDS MIGRATION** |
| Profile email | none (`:103-136`) | **MISSING**; whether and when to collect it is open (F-08) |
| Event name index for analytics | `Event` indexes only `userId` (`:332`); `analytics()` counts by `eventName` → sequential scans | **NEEDS MIGRATION**: `(event_name, created_at)` |
| Cascades | Nearly every relation is `onDelete: Cascade` (`:142, :169, :213, :241, :243, :254, :256, :258, :273, :275, :287, :310, :312, :344, :346, :364`); `Event` uses `SetNull` (`:327`) | **NEEDS REDESIGN** for trust data: deleting a profile or listing destroys reports, reviews and messages (evidence). New admin tables must use `Restrict` or no FK + snapshot |

---

## 24. API Endpoint Inventory

Every controller route in `apps/api/src` (verified with a grep over the `@Controller`, `@Get`, `@Post`, `@Patch` and `@Delete` decorators). Auth: **J** = `JwtAuthGuard`; **A** = `AdminGuard`; **—** = public.

| Method + path | Controller:line | Auth | Admin-relevant note |
|---|---|---|---|
| `GET /health` | `health/health.controller.ts:8` | — | Returns **200** with `status: 'degraded'` when the DB is down (`:13-15`); monitors can't key on status |
| `POST /auth/google` | `auth/auth.controller.ts:25` | — | |
| `POST /auth/otp/send` | `:30` | — | Production: 503 or throws (§6) |
| `POST /auth/otp/verify` | `:35` | — | Runs `ADMIN_PHONES` promotion |
| `POST /auth/refresh` | `:40` | — | |
| `POST /auth/logout` | `:45-46` | J | |
| `GET /auth/me`, `PATCH /auth/me`, `DELETE /auth/me` | `:51, :57, :67` | J | The legacy admin gate reads `GET /auth/me` |
| `PATCH /auth/onboarding` | `:73` | J | |
| `POST /listings` | `listings/listings.controller.ts:30` | J | |
| `GET /listings/mine` | `:37` | J | |
| `GET /listings` | `:43` | J | Only approved (`listings.service.ts:172`) |
| `GET /listings/localities` | `:49` | J | |
| `GET /listings/geocode-preview` | `:58` | J | Outbound to Nominatim (SSRF surface is the fixed host only) |
| `GET /listings/map` | `:69` | J | |
| `POST /listings/admin/geocode-backfill` | `:74-78` | J+A | |
| `GET /listings/admin/queue` | `:83-87` | J+A | |
| `POST /listings/admin/bulk-status` | `:89-93` | J+A | ⚠️ |
| `GET /listings/:id` | `:95` | J | Admin sees any status (`service :126`) |
| `GET /listings/:id/insights` | `:101` | J | |
| `GET /listings/:id/similar` | `:106` | J | |
| `PATCH /listings/:id` | `:111` | J | ⚠️ admin branch |
| `DELETE /listings/:id` | `:120` | J | ⚠️ admin hard delete |
| `POST /reports` | `reports/reports.controller.ts:25` | J | |
| `GET /reports` | `:30-31` | J+A | |
| `PATCH /reports/:id` | `:36-37` | J+A | |
| `GET /listings/:listingId/reviews`, `POST …` | `reviews/reviews.controller.ts:25, 32, 47` | J | |
| `GET /admin/reviews`, `PATCH /admin/reviews/:id` | `:57-58, 62, 67` | J+A | |
| `GET /admin/users` | `admin/admin.controller.ts:20` | J+A | |
| `PATCH /admin/users/:id/ban` | `:25` | J+A | ⚠️ |
| `PATCH /admin/users/:id/role` | `:30` | J+A | ⚠️ |
| `GET /admin/config` | `:39` | J+A | |
| `PATCH /admin/config/:key` | `:44` | J+A | ⚠️ |
| `GET /admin/analytics` | `:49` | J+A | |
| `GET /config` | `app-config/app-config.controller.ts:8-15` | J | **Returns every `app_config` row to every signed-in user** (`:15`), so any key an admin adds becomes public (T-21) |
| `POST /events` | `events/events.controller.ts:8-14` | J | client events restricted (`dto :6-10`) |
| `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` | `notifications/notifications.controller.ts:10-27` | J | |
| `GET /owners/:id` | `owners/owners.controller.ts:12-18` | J | `ParseUUIDPipe`: the **only** route that validates its id param |
| `POST /uploads/signature` | `uploads/uploads.controller.ts:7-14` | J | |
| Chat REST routes | `chat/chat.controller.ts` | J | Routes not enumerated line by line in this pass (**NOT VERIFIED**); no admin routes found by grep |
| Institutions | `institutions/institutions.controller.ts` | J (**NOT VERIFIED**) | No admin create/update found by grep, so `places.manage` is 🔴 |
| Push tokens | `push-tokens/push-tokens.controller.ts` | J (**NOT VERIFIED**) | |
| WS `conversation:join` / `:leave` / `message:send` | `chat/chat.gateway.ts:108, 122, 132` | token at connect (`:74-100`) | `cors: { origin: '*' }` (`:39`) |

**Unvalidated `:id` params:** every admin `:id` except `/owners/:id` lacks `ParseUUIDPipe`. A missing id on `prisma.update` throws `P2025`, and with no global exception filter this is **expected to surface as HTTP 500** (inferred from NestJS defaults; **not executed in this pass**).

---

## 25. Proposed Admin API Contract

**Conventions** (apply to every row unless stated):

| Field | Value |
|---|---|
| AUTH | **ADM** = admin-audience access token (`aud=admin`) + a live `admin_session` (idle ≤ 30 min, absolute ≤ 12 h) + MFA completed · **ADM+SU** = ADM + step-up (TOTP within 10 min) · **PRE** = partial token after the first factor, before TOTP (enrollment and verification only) · **—** = none |
| ERRORS (common) | `400 VALIDATION` · `401 UNAUTHENTICATED` · `401 MFA_REQUIRED` · `401 STEP_UP_REQUIRED` · `403 FORBIDDEN_PERMISSION` · `404 NOT_FOUND` · `409 CONFLICT` · `409 LISTING_VERSION_CONFLICT` · `409 INVALID_STATE` · `429 RATE_LIMITED` |
| RATE LIMIT | **std** = 300 requests/min per session · **mut** = 60 mutations/min per session · **auth** = 5 per 15 min per account + 20 per 15 min per IP · **ev** = 60 evidence views/hour (MPB §26.6) · **exp** = 5/hour |
| AUDIT | Every mutation writes its event in the same transaction (§15). Reads marked "read-audit" write before responding |
| Mutations | Carry `expectedVersion` where an entity has a version, and an `Idempotency-Key` header for bulk and money-adjacent actions |
| Classification | **KEEP** (unchanged) · **MODIFY** (existing, must change) · **DEPRECATE** (replaced; kept until legacy retirement) · **NEW** |

Everything lives under `/admin/*` and is **rejected for user-audience tokens**; user endpoints reject admin tokens.

### 25.1 AUTH

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | ERRORS | AUDIT EVENT | RATE | NOTES |
|---|---|---|---|---|---|---|---|---|---|
| NEW | `POST /admin/auth/otp/send` | — | — | `{phone}` | `{sent}` | 503 SMS unavailable | `admin.auth.otp_sent` | auth | Same OTP engine; **only for profiles holding an admin role** (respond identically otherwise, to prevent enumeration) |
| NEW | `POST /admin/auth/otp/verify` | — | — | `{phone, code}` | PRE token + `{mfaState: enroll\|verify}` | 401 | `admin.auth.first_factor_ok/failed` | auth | Runs break-glass promotion (→ super_admin) only here, audited |
| NEW | `POST /admin/auth/totp/enroll` | PRE | — | — | `{otpauthUri, qr}` | 409 already enrolled | `admin.totp.enroll_started` | auth | Secret encrypted at rest |
| NEW | `POST /admin/auth/totp/enroll/confirm` | PRE | — | `{code}` | `{recoveryCodes[10]}` + session cookies via BFF | 401 | `admin.totp.enrolled`, `admin.recovery_codes.issued` | auth | Codes shown once |
| NEW | `POST /admin/auth/totp/verify` | PRE | — | `{code}` | session (access + refresh, `aud=admin`, `sid`) | 401, 423 locked | `admin.auth.mfa_ok/failed`, `admin.session.created` | auth | Replay check on `last_used_step` |
| NEW | `POST /admin/auth/recovery/verify` | PRE | — | `{recoveryCode}` | a session limited to re-enrollment | 401 | `admin.recovery_code.used` + security notification | auth | Forces TOTP re-enrollment |
| NEW | `POST /admin/auth/recovery/regenerate` | ADM+SU | — (self) | — | `{recoveryCodes[10]}` | — | `admin.recovery_codes.regenerated` | auth | Invalidates the previous batch atomically |
| NEW | `POST /admin/auth/step-up` | ADM | — | `{code}` | `{stepUpUntil}` | 401 | `admin.step_up.ok/failed` | auth | |
| NEW | `POST /admin/auth/refresh` | refresh cookie (BFF) | — | — | a new pair | 401 idle or absolute expiry | `admin.session.refreshed` (sampled) | std | Enforces idle and absolute limits server-side |
| NEW | `POST /admin/auth/logout` | ADM | — | — | 204 | — | `admin.session.ended` | std | Revokes the session, not just one token |
| NEW | `GET /admin/auth/me` | ADM | — | — | `{id, name, roles[], permissions[], seniorCapability, sessionExpiresAt, stepUpUntil, recoveryCodesRemaining}` | — | — | std | The UI mirrors, never enforces |
| NEW | `GET /admin/auth/sessions` · `DELETE /admin/auth/sessions/:id` | ADM | — (own) | — | list / 204 | 404 | `admin.session.revoked` | std | |
| MODIFY | `POST /auth/otp/verify` (user) | — | — | unchanged | unchanged | — | — | auth | **Stop `ADMIN_PHONES` promotion on the user path**; user tokens never carry admin power |
| MODIFY | `JwtStrategy` (all user routes) | — | — | — | — | 401 for `aud=admin` | — | — | Rejects admin-audience tokens on user endpoints |

### 25.2 ADMIN USERS

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | ERRORS | AUDIT EVENT | RATE | NOTES |
|---|---|---|---|---|---|---|---|---|---|
| NEW | `GET /admin/admin-users` | ADM | `admin.manage` | cursor | admins, roles, MFA state, last sign-in | — | — | std | |
| NEW | `POST /admin/admin-users` | ADM+SU | `admin.manage` + `roles.manage` | `{profileId, roles[]}` | admin | 409 already admin | `admin.user.created`, `role.granted` | mut | Second super_admin approval for senior/super once ≥ 2 exist (F-12) |
| NEW | `PUT /admin/admin-users/:id/roles` | ADM+SU | `roles.manage` | `{roles[], seniorCapability, reason}` | admin | 409 last super_admin; 403 self-escalation | `role.changed` (before/after) | mut | Can't remove the last super_admin; can't grant oneself |
| NEW | `POST /admin/admin-users/:id/disable` | ADM+SU | `admin.manage` | `{reason}` | 204 | 409 self; 409 last super_admin | `admin.user.disabled` | mut | Revokes all admin sessions |
| NEW | `POST /admin/admin-users/:id/totp-reset` | ADM+SU | `admin.manage` | `{reason}` | 204 | 403 super_admin target unless a second super_admin; 409 self | `admin.totp.reset` + security notification | mut | Bootstrap super_admin reset = infrastructure only |
| NEW | `POST /admin/admin-users/:id/sessions/revoke-all` | ADM+SU | `admin.manage` | `{reason}` | 204 | — | `admin.session.revoked_all` | mut | |
| MODIFY | `PATCH /admin/users/:id/role` | → split | — | — | — | — | — | — | Marketplace role changes (seeker↔owner) only, `users.restrict`-level; **granting `admin` is removed** from this path. DEPRECATED for admin roles |

### 25.3 DASHBOARD

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | ERRORS | AUDIT | RATE | NOTES |
|---|---|---|---|---|---|---|---|---|---|
| NEW | `GET /admin/dashboard` | ADM | `listings.review` (tiles filtered by permission) | — | the counts and oldest items of MPB §26.8; auto-approval job heartbeat | — | — | std (30 s polling) | Aggregates only; no PII |

### 25.4 LISTINGS

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | ERRORS | AUDIT | RATE | NOTES |
|---|---|---|---|---|---|---|---|---|---|
| NEW | `GET /admin/listings` | ADM | `listings.review` | `q, status[], ownerId, locality, cursor` | a page of admin listing DTOs | — | — | std | Search any state |
| NEW | `GET /admin/listings/:id` | ADM | `listings.review` | — | full detail + `version` + approval metadata + owner summary (no evidence, **no chat content**) | 404 | — | std | `ParseUUIDPipe` |
| NEW | `GET /admin/listings/:id/history` | ADM | `listings.review` | cursor | moderation timeline | 404 | — | std | From `moderation_decisions` + audit |
| NEW | `GET /admin/listings/:id/diff?from=&to=` | ADM | `listings.review` | versions | a field and media diff | 404 | — | std | From `listing_snapshots` |
| MODIFY | `PATCH /listings/:id` | J (user) | owner only | — | — | 403 for admins | — | — | **Remove the admin branch** (`service :520, :594, :697-699`) |
| MODIFY | `DELETE /listings/:id` | J (user) | owner only | — | — | 403 for admins | — | — | Remove the admin hard delete; the owner delete becomes a soft archive when the listing has conversations or reports (F-10/F-11) |
| MODIFY | `POST /listings/admin/geocode-backfill` → `POST /admin/system/geocode-backfill` | ADM | `configuration.manage` | `{limit≤100}` | `{processed}` | — | `system.geocode_backfill` | exp | |

### 25.5 MODERATION

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | ERRORS | AUDIT EVENT | RATE | NOTES |
|---|---|---|---|---|---|---|---|---|---|
| NEW | `GET /admin/moderation/queue` | ADM | `listings.review` | `track=free\|verified_post_review\|high_risk\|needs_changes\|stale, cursor` | items + `autoApproveAt`, claim, version | — | — | std | Replaces `/listings/admin/queue` |
| NEW | `POST /admin/moderation/items/:listingId/claim` | ADM | `listings.review` | `{expectedVersion}` | `{claimedBy, expiresAt}` | 409 claimed by another (with holder) | `queue.claimed` | mut | **Doesn't stop the timer, doesn't change the status** (D-47) |
| NEW | `DELETE /admin/moderation/items/:listingId/claim` | ADM | `listings.review` | — | 204 | 403 not the holder (unless `admin.manage`) | `queue.released` / `queue.taken_over` | mut | |
| NEW | `POST /admin/listings/:id/decision` | ADM | `listings.approve` or `listings.reject` by decision | `{expectedVersion, decision: approve\|request_changes\|reject, reasonCodes[], ownerMessage?, internalNote?}` | `{status, version}` | 409 version, 409 invalid state (only pending, or post-review for confirm) | `listing.approved` / `listing.changes_requested` / `listing.rejected` | mut | Runs the §13.3 checks for approve (photo minimum etc.); outbox notification |
| NEW | `POST /admin/listings/:id/hold` · `DELETE …/hold` | ADM | `listings.hold` | `{expectedVersion, reasonCode}` | `{heldAt, version}` | 409 | `listing.hold` / `listing.hold_released` | mut | The **only** non-decision action that stops auto-approval |
| NEW | `POST /admin/listings/:id/pause` · `POST …/restore` | ADM | `listings.reject` | `{expectedVersion, reasonCode, note}` | status | 409 | `listing.paused` / `listing.restored` | mut | Replaces the admin hard delete |
| NEW | `POST /admin/listings/:id/post-review` | ADM | `listings.approve` | `{expectedVersion, outcome: confirmed\|correction_requested\|rejected\|trust_escalation}` | status | 409 | `listing.post_review.*` | mut | For auto-approved items |
| NEW | `POST /admin/listings/:id/notes` · `POST …/flags` · `POST …/escalate` | ADM | `listings.review` | `{text}` / `{flag}` / `{reason}` | note / flag | — | `listing.note_added` / `listing.flagged` / `listing.escalated` | mut | Notes are never shown to owners |
| NEW | `POST /admin/moderation/bulk-decision` | ADM | as decision | `{items:[{id, expectedVersion}] (≤ 50), decision, reasonCodes[]}` + `Idempotency-Key` | per-item `{id, result: ok\|conflict\|invalid_state}` | 400 > 50 | one audit row **per item** | mut | Bulk badge actions forbidden (MPB §26.6) |
| DEPRECATE | `POST /listings/admin/bulk-status` | J+A | — | — | — | — | — | — | **Harden now** (pending-only precondition, `ArrayMaxSize(50)`, audit) while the legacy admin still calls it (`features/admin/api.ts:55`); remove at legacy retirement |
| DEPRECATE | `GET /listings/admin/queue` | J+A | — | — | — | — | — | — | Add pagination; remove at retirement |

### 25.6 REPORTS

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | ERRORS | AUDIT EVENT | RATE | NOTES |
|---|---|---|---|---|---|---|---|---|---|
| NEW | `GET /admin/reports` | ADM | `reports.review` | `status, tier, category, assignedTo, cursor` | reports (reporter **id and name, no phone**) | — | — | std | |
| NEW | `GET /admin/reports/:id` | ADM | `reports.review` | — | report + listing summary + attached evidence snapshots | 404 | — | std | Chat excerpts only when attached as evidence (MPB §15) |
| NEW | `POST /admin/reports/:id/assign` | ADM | `reports.review` | `{assigneeId?}` | report | 409 | `report.assigned` | mut | |
| NEW | `POST /admin/reports/:id/resolve` | ADM | `reports.review` | `{action: dismiss\|confirm\|escalate, note, expectedListingVersion}` | report + listing state | 409 not pending, 409 version | `report.dismissed` / `report.confirmed` | mut | Precondition `status='pending'`; confirm pauses or returns to review **only from approved** |
| KEEP | `POST /reports` (user) | J | — | unchanged | — | — | — | per user | Make create atomic (unique partial index on open `(listing_id, reporter_id)`) |
| DEPRECATE | `GET /reports`, `PATCH /reports/:id` | J+A | — | — | — | — | — | — | Harden (status precondition, audit) until retirement |

### 25.7 TRUST (restrictions, reviews)

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | ERRORS | AUDIT EVENT | RATE | NOTES |
|---|---|---|---|---|---|---|---|---|---|
| NEW | `POST /admin/users/:id/restrictions` | ADM (+SU for level ≥ 4) | `users.restrict` (levels ≤ 3) / `users.suspend` (≥ 4) | `{level, reasonCode, note, endsAt?}` | restriction | 403 target is an admin; 409 self | `user.restricted` | mut | Can't target admin accounts (use admin.manage) |
| NEW | `DELETE /admin/users/:id/restrictions/:rid` | ADM | same as imposing | `{reason}` | 204 | — | `user.restriction_lifted` | mut | |
| MODIFY | `PATCH /admin/users/:id/ban` | ADM+SU | `users.suspend` | `{banned, reasonCode, note}` | user | 409 self; 403 target admin | `user.banned` / `user.unbanned` | mut | Keep as the level-5 shortcut during migration |
| MODIFY | `GET /admin/reviews` · `PATCH /admin/reviews/:id` | ADM | `reviews.moderate` | `{hidden, reasonCode}` | review | 404 | `review.hidden` / `review.unhidden` | mut | Add pagination; path kept |

### 25.8 VERIFICATION (Phase 1: contract reserved, not built in Phase 0)

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | ERRORS | AUDIT EVENT | RATE | NOTES |
|---|---|---|---|---|---|---|---|---|---|
| NEW | `GET /admin/verification/cases` | ADM | `verification.view` (status only for admin: list without evidence) | filters | cases (**no evidence, no URLs**) | — | — | std | MPB §26.11: no documents in lists |
| NEW | `GET /admin/verification/cases/:id` | ADM | `verification.view` | — | case metadata | 404 | — | std | |
| NEW | `POST /admin/verification/cases/:id/evidence/:eid/view` | ADM+SU | `verification.view` | — | `{signedUrl, expiresAt ≤ 5 min}` | 403 | `evidence.viewed` (**before** issuing) | ev | Super_admin = break-glass flag in the audit |
| NEW | `POST /admin/verification/cases/:id/approve` · `…/reject` · `…/request-info` | ADM+SU | `verification.approve` / `verification.reject` | `{reasonCodes, note}` | case | 409 state | `verification.approved` / `.rejected` / `.info_requested` | mut | **Document requirements OPEN** (F-06) |

### 25.9 GHOR VERIFIED (Phase 1)

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | ERRORS | AUDIT EVENT | RATE | NOTES |
|---|---|---|---|---|---|---|---|---|---|
| NEW | `GET /admin/verified-owners` | ADM | `listings.review` | filters | badge states | — | — | std | |
| NEW | `POST /admin/verified-owners/:ownerId/grant` | ADM+SU | `badge.grant` | `{caseId, reason}` | badge | 409 no approved case; 409 entitlement missing | `badge.granted` | mut | Senior_reviewer only; **never bulk** |
| NEW | `POST …/suspend` · `…/revoke` · `…/reinstate` · `…/request-reverification` | ADM+SU | `badge.suspend` / `badge.revoke` / `badge.grant` | `{reasonCode, note}` | badge | 409 | `badge.*` | mut | |

### 25.10 APPEALS (Phase 1)

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | ERRORS | AUDIT EVENT | RATE | NOTES |
|---|---|---|---|---|---|---|---|---|---|
| NEW | `GET /admin/appeals` · `GET /admin/appeals/:id` | ADM | `appeals.review` | filters | appeals | — | — | std | |
| NEW | `POST /admin/appeals/:id/decide` | ADM | `appeals.review` | `{outcome: upheld\|overturned, note}` | appeal | **403 `SELF_REVIEW_FORBIDDEN`** when the caller made the original decision | `appeal.decided` | mut | Enforced in the service |

### 25.11 USERS (marketplace)

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | ERRORS | AUDIT | RATE | NOTES |
|---|---|---|---|---|---|---|---|---|---|
| MODIFY | `GET /admin/users` | ADM | `listings.review` | `q, role, restricted, cursor` | a page; **phone masked** by default | — | — | std | Replaces the unpaginated full dump (`admin.service.ts:13-27`) |
| NEW | `GET /admin/users/:id` | ADM | `listings.review` | — | profile summary, listings, reports filed or against, restrictions | 404 | — | std | |
| NEW | `POST /admin/users/:id/reveal-phone` | ADM | `reports.review` | `{reason}` | `{phone}` | — | `user.pii_revealed` (read-audit) | ev | PII minimization |

### 25.12 PLACES

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | ERRORS | AUDIT | RATE | NOTES |
|---|---|---|---|---|---|---|---|---|---|
| NEW | `GET/POST/PATCH /admin/places[/:id]` | ADM | `places.manage` | institution or place fields | place | 409 duplicate | `place.created` / `.updated` | mut | No admin institution endpoints today; aliases and adjacency later |

### 25.13 SUBSCRIPTIONS · 25.14 PAYMENTS (Phase 2: reserved only)

| Class | METHOD PATH | AUTH | PERMISSION | NOTES |
|---|---|---|---|---|
| NEW (Phase 2) | `GET /admin/subscriptions`, `GET /admin/subscriptions/:id` | ADM | view: all roles | Provider not chosen (§21) |
| NEW (Phase 2) | `POST /admin/subscriptions/:id/adjust` | ADM+SU | super_admin (`billing.manage`, proposed) | Idempotency key; audit `subscription.adjusted` |
| NEW (Phase 2) | `GET /admin/payments`, `POST /admin/payments/:id/refund` | ADM / ADM+SU | view all / refund super_admin | Webhook-driven state; never trust the client |
| NEW (Phase 1–2) | `GET /admin/promotions/first-50` | ADM | view | The first-50 counter (decided promotion) |

### 25.15 NOTIFICATIONS

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | NOTES |
|---|---|---|---|---|---|---|
| NEW | `GET /admin/notifications/deliveries` | ADM | `system.health.view` | channel, status, cursor | the outbox / delivery log | Requires the outbox (§23) |
| NEW | `GET /admin/me/alerts` | ADM | — | — | security alerts for this admin | Recovery-code use, new session |

### 25.16 ANALYTICS

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | NOTES |
|---|---|---|---|---|---|---|
| MODIFY | `GET /admin/analytics` | ADM | `listings.review` | `from, to` | funnel + totals | Keep the shape; add a date range; index `event_name` (§28) |
| NEW | `GET /admin/analytics/moderation` | ADM | `listings.review` | `from, to` | % auto-approved, % later rejected, SLA | MPB §26.8 key metrics |

### 25.17 AUDIT

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | ERRORS | AUDIT | RATE | NOTES |
|---|---|---|---|---|---|---|---|---|---|
| NEW | `GET /admin/audit` | ADM | `audit.view` (scope: own / own + trust / all) | actor, action, target, from, to, cursor | rows (redacted) | — | — | std | No update or delete endpoint exists **by design** |
| NEW | `POST /admin/audit/export` | ADM+SU | `audit.export` | range, filters | a job id → signed download | 400 range too large | `audit.exported` | exp | Super_admin only |

### 25.18 SYSTEM HEALTH / CONFIGURATION

| Class | METHOD PATH | AUTH | PERMISSION | INPUT | OUTPUT | ERRORS | AUDIT | RATE | NOTES |
|---|---|---|---|---|---|---|---|---|---|
| MODIFY | `GET /health` | — | — | — | `{status}`, **503 when the DB is unreachable** | — | — | — | Currently 200 on degraded (`health.controller.ts:13-15`) |
| NEW | `GET /admin/system/health` | ADM | `system.health.view` | — | DB, job heartbeats, provider status (SMS, push, Cloudinary), queue lag | — | — | std | |
| NEW | `POST /admin/system/alerts/:id/ack` | ADM | `system.health.ack` | `{note}` | alert | — | `system.alert_acknowledged` | mut | |
| MODIFY | `GET /admin/config` · `PATCH /admin/config/:key` | ADM (+SU for PATCH) | `configuration.manage` | `{value, expectedUpdatedAt}` | row | **400 unknown key**, 400 schema, 409 stale | `config.updated` (before/after) | mut | **Allowlist + a per-key schema** (e.g. `report_threshold` integer 2–20) |
| MODIFY | `GET /config` (user) | J | — | — | **only keys flagged public** | — | — | — | Stops leaking every key (`app-config.controller.ts:15`) |


---

## 26. Security Threat Model

Priority: **P0** = before `apps/admin` connects to any real data · **P1** = before the console goes to production · **P2** = before Phase 1 trust features.

| # | Threat | Attack | Impact | Current protection | Gap | Mitigation | Pri |
|---|---|---|---|---|---|---|---|
| T-01 | Stolen admin credentials | SIM swap or OTP interception on an admin phone; social engineering of the OTP | Full admin power | Phone OTP only; atomic attempt limits (`auth.service.ts:195-203`) | No second factor | Mandatory TOTP (D-47); new-session security alert | P0 |
| T-02 | Stolen session | Refresh-cookie theft (malware, shared computer), 30-day refresh | Admin power for 30 days | httpOnly cookies; rotation (`:340-346`) | No idle or absolute limit; no session list; no reuse-detection family revoke | Admin sessions 30 min idle / 12 h absolute; `sid` claim; revoke the family on refresh reuse; session list and revoke | P0 |
| T-03 | TOTP compromise | Seed exfiltrated (backup, DB dump), or real-time phishing relay | MFA bypass | none | No TOTP | Encrypt the secret with a key outside the DB; replay protection (`last_used_step`); step-up on sensitive actions; anomaly alerts. Real-time relay remains a residual risk (WebAuthn would be the later upgrade) | P0 |
| T-04 | Recovery-code compromise | Printed codes found; codes stored in plaintext | MFA bypass | none | none | Hashed single-use codes; use triggers alerts to the holder and super_admins; forced re-enrollment; regeneration invalidates the old batch | P0 |
| T-05 | Malicious admin | A legitimate admin bans the other admins, demotes the founder, grants admin to an accomplice, approves scams, hard-deletes evidence | Takeover; marketplace fraud; evidence loss | Only the self-demotion guard (`admin.service.ts:36-38`) | Any admin can grant admin (`:35-44`), ban anyone including admins (`:46-65`), hard-delete (`listings.service.ts:745`); **nothing is audited** | Permissions (§9); `roles.manage`/`admin.manage` super_admin only with step-up; no admin-on-admin restriction except via `admin.manage`; soft actions only; an append-only audit log; last-super-admin guard | **P0** |
| T-06 | XSS on the marketplace origin → admin API | An XSS on `ghor.co.in` calls `/api/gateway/*` (any path, `route.ts:27-40`) or reads the token from `/api/chat/socket-token` (`:49`) while an admin is signed in | Admin actions performed as the victim admin | React escaping; no known XSS | **No CSP or security headers** (`next.config.ts` has none); the legacy admin shares the user session; API CORS `*` means a stolen token works from anywhere | The separate admin origin + admin-audience tokens (D-46/47); CSP on both apps; restrict CORS; retire the legacy admin's authority once `apps/admin` is live | P0 |
| T-07 | Privilege escalation (user → admin) | Onboarding or profile update with `role: 'admin'`; forged JWT | Full admin | `OnboardingDto` blocks admin; the role is read from the DB (`jwt.strategy.ts:41-45`); strong secrets enforced in production (`main.ts:8-21`) | `ADMIN_PHONES` promotion on the **user** login path; weak secrets allowed outside production | Move break-glass to the admin login only; audit it; separate admin token audience and secret | P0 |
| T-08 | Privilege escalation (admin → super_admin / senior) | Admin calls the role endpoint | Verification or badge powers, config | none (only one role exists) | Flat role | `roles.manage` + step-up + a second super_admin (F-12) | P0 |
| T-09 | BOLA (broken object-level authorization) on admin objects | An admin with a narrow permission accesses objects outside scope (e.g. evidence for a case they have no permission for) | Data exposure | Only the role check | No permission scoping | Per-endpoint permission + per-object checks in the service (e.g. appeal self-review, evidence permission) | P0 |
| T-10 | IDOR on user endpoints via the admin bypass | A compromised admin token uses the *owner* endpoints `PATCH/DELETE /listings/:id` to rewrite or delete any listing | Content tampering, evidence destruction | none | Admin branch in the service (`:520, :742`) | Remove admin power from user endpoints; admin actions only via `/admin/*` | P0 |
| T-11 | CSRF | A cross-site form or `fetch` to the BFF with ambient cookies | Admin mutations | `SameSite=Lax` on the user cookies | Admin and marketing subdomains are the **same site**; no `Origin` check in the BFF | `SameSite=Strict`, host-only cookies on the admin origin; BFF `Origin`/`Sec-Fetch-Site` check; no state change on GET | P0 |
| T-12 | Stored XSS in the admin UI | Owner-controlled listing text, report reasons or review comments rendered in the console | Admin session hijack from inside the console | React escaping (legacy) | No CSP; future rich rendering | Render as text only; strict CSP on `apps/admin`; no `dangerouslySetInnerHTML` | P1 |
| T-13 | SSRF | Admin- or user-supplied URLs fetched server-side | Internal network access | Image URLs are validated but **not fetched** by the API; geocoding goes to a fixed host | Future: evidence ingestion, webhook testers | Never fetch user-supplied URLs; allowlist outbound hosts | P2 |
| T-14 | Malicious upload | An unsigned preset used to upload arbitrary content into GHOR's cloud; polyglot files | Hosting abuse; malicious content in the review UI | Signed params: formats, public id, size transform (`uploads.service.ts:74-80`) | **Mobile still uses the unsigned preset** (`cloudinary.ts:4, 20`); the preset's folder is NOT VERIFIED | Move mobile to signed uploads, then disable the preset (**out of scope now**); serve evidence from private storage | P1 |
| T-15 | Verification-document exposure | Documents stored at public URLs; listed in tables; cached | DPDP breach; identity theft | Not built; `idDocumentUrl` is excluded from `getProfile` (`auth.service.ts:371`) | The URL-column design (`schema.prisma:122`) | Private storage keys; ≤ 5-min signed URLs; step-up; evidence-access audit; retention purge | P2 (design P0) |
| T-16 | Audit-log tampering | A malicious admin or DB user edits or deletes rows | Loss of accountability | no log | no log | Append-only via DB privileges or a trigger; hash chain or checksum; no FK cascades; restricted DB credentials | P0 |
| T-17 | Concurrent moderation | Two admins, or an admin and the job, act on the same listing | Contradictory decisions; approving unseen content | none | No version | Version preconditions (§14); snapshots; 409 conflicts | P0 |
| T-18 | Auto-approval abuse | Scammers submit during low-coverage hours knowing listings go live in 5 min; edit after approval; mass submissions | Scam listings live | Content edits on live listings re-queue them (`listings.service.ts:553-559`) | No job yet; no quotas; no risk flags | Submit-time checks (MPB §13.3); risk-flagged items not auto-approved (founder Q-10); quotas; kill switch; post-review queue; alerts on volume spikes | P1 |
| T-19 | Admin API enumeration | Probing `/admin/*` with user tokens; enumerating admin phones via the admin OTP | Reconnaissance | `AdminGuard` returns 403 | Distinguishable responses; no rate limit | Uniform 404 for non-admin audiences on `/admin/*`; identical OTP responses; rate limits | P1 |
| T-20 | Rate-limit bypass | Multiple IPs or instances; the in-memory upload limit resets on restart | Brute force; scraping | OTP limits in the DB; upload limit in memory (`uploads.service.ts:49`) | No global throttling; per-instance memory | `@nestjs/throttler` with a shared store (DB or Redis) once multi-instance; per-account and per-IP limits on admin auth | P0 (auth) / P1 |
| T-21 | Config poisoning / leakage | An admin sets `report_threshold = 0`, or stores a secret-like key that `GET /config` then serves to every user | Mass de-listing; data leak | none | Any key, any value (`admin.service.ts:75-81`); all rows public (`app-config.controller.ts:15`) | Key allowlist + schemas + a public flag; super_admin + step-up; audit | **P0** |
| T-22 | Compromised super_admin | A super_admin account taken over | Full control except verification (D-47) | n/a | n/a | TOTP + step-up; second super_admin approval for role changes; alerts to other super_admins; audit export restricted; break-glass recovery path | P1 |
| T-23 | Break-glass abuse | Someone with deploy access adds a phone to `ADMIN_PHONES` | Silent super_admin creation | Environment access only; `logger.warn` (`auth.service.ts:261-263`) | Silent, unaudited, re-promotes on every login | Audit + alert every break-glass use; still require TOTP enrollment; restrict who can edit production env; document the runbook | P0 |
| T-24 | CORS any-origin | Any website calls the API with a stolen bearer token (or future cookie mode) | Cross-origin abuse | Bearer tokens aren't sent automatically by browsers | `app.enableCors()` (`main.ts:26`), socket `origin: '*'` (`chat.gateway.ts:39`) | An allowlist of origins per environment | P0 |
| T-25 | Evidence destruction via cascades | Owner self-deletes an account (`auth.service.ts:456`) or an admin deletes a listing → reports, reviews and messages cascade away | Lost trust and safety evidence; unappealable decisions | Banned accounts can't self-delete (`:451-455`) | Cascade everywhere (§23) | Soft delete / anonymize; retention policy (F-10); audit and evidence tables without cascades | P1 |
| T-26 | PII over-exposure to admins | `GET /admin/users` returns every phone; reports include the reporter's phone | Insider data harvesting | Admin-only routes | No masking, no pagination, no read audit | Mask by default; reveal with a reason + read-audit; pagination | P1 |

### 26.1 Security control checklist (35 items)

| # | Control | State | Code location |
|---|---|---|---|
| 1 | Global input validation (whitelist) | EXISTS | `main.ts:27` |
| 2 | Forbid unknown properties (`forbidNonWhitelisted`) | MISSING | `main.ts:27` (strips silently) |
| 3 | UUID validation on `:id` params | PARTIAL | only `owners.controller.ts:18` |
| 4 | Strong JWT secrets enforced | PARTIAL | `main.ts:8-21` (production only) |
| 5 | Token audience separation (admin versus user) | MISSING | `auth.service.ts:285` |
| 6 | Role and ban re-checked per request | EXISTS | `jwt.strategy.ts:41-45` |
| 7 | Refresh rotation, one-time use | EXISTS | `auth.service.ts:340-346` |
| 8 | Refresh reuse → revoke the family | MISSING | `auth.service.ts:317-356` |
| 9 | OTP brute-force protection | EXISTS | `auth.service.ts:195-203` |
| 10 | Production SMS delivery | MISSING | `auth.service.ts:148-170` |
| 11 | Admin MFA (TOTP) | MISSING | none |
| 12 | Recovery codes | MISSING | none |
| 13 | Step-up authentication | MISSING | none |
| 14 | Admin session idle and absolute timeout | MISSING | none |
| 15 | Permission-based authorization | MISSING | `admin.guard.ts:20` (role string) |
| 16 | Admin powers only on admin routes | INSECURE | `listings.service.ts:520, 697-699, 742` |
| 17 | Role grant restricted | INSECURE | `admin.service.ts:35-44` |
| 18 | Admin-on-admin ban protection | INSECURE | `admin.service.ts:46-65` |
| 19 | Config key allowlist and schema | INSECURE | `admin.service.ts:75-81`, `set-config.dto.ts:9-10` |
| 20 | Public config filtered | INSECURE | `app-config.controller.ts:15` |
| 21 | Audit log (append-only, transactional) | MISSING | none |
| 22 | Optimistic concurrency on moderation | MISSING | `schema.prisma:166-208` |
| 23 | State preconditions on bulk moderation | INSECURE | `listings.service.ts:493-496` |
| 24 | Bulk size cap | MISSING | `bulk-update-listings.dto.ts:3-11` |
| 25 | CORS origin allowlist (HTTP) | INSECURE | `main.ts:26` |
| 26 | CORS origin allowlist (WebSocket) | INSECURE | `chat.gateway.ts:39` |
| 27 | Security headers API (helmet) | MISSING | `package.json` (no helmet), `main.ts` |
| 28 | Security headers and CSP web | MISSING | `apps/web/next.config.ts` (no `headers()`) |
| 29 | Global rate limiting | MISSING | no throttler; only OTP and upload limits |
| 30 | Global exception filter (no leaking Prisma errors; mapping to 404/409) | MISSING | `app.module.ts` |
| 31 | BFF path allowlist and Origin check | MISSING | `apps/web/app/api/gateway/[...path]/route.ts:27-40` |
| 32 | Admin cookie `SameSite=Strict` on a separate origin | MISSING | `route.ts:16-24` (Lax, shared) |
| 33 | Signed media uploads everywhere | PARTIAL | web signed (`uploads.service.ts`); mobile unsigned (`apps/mobile/src/lib/cloudinary.ts:4, 20`) |
| 34 | Private evidence storage and signed URLs | MISSING | `schema.prisma:122` (URL column) |
| 35 | Health endpoint signals failure (non-200) | INSECURE | `health.controller.ts:13-15` |

---

## 27. Testing Audit

**Commands run (read-only, 2026-09-29, from `apps/api`, using the hoisted `node_modules/jest`):**

| Command | Result |
|---|---|
| `jest` (unit; `testRegex .*\.spec\.ts$` from `package.json`) | **No tests found**: 74 files checked, 0 matches (Jest exits with an error when no tests are found) |
| `jest --config ./test/jest-e2e.json` | **FAIL: the suite didn't compile.** `TS5011` (rootDir must be set explicitly) and `TS5101` (`baseUrl` deprecated; `ignoreDeprecations: "6.0"` needed). 0 tests ran |

Even if it compiled, the only test (`test/app.e2e-spec.ts`) expects `GET /` → `"Hello World!"`; **no `AppController` exists** (`src/app.controller.ts` is absent), so it would fail with a 404. It also boots the full `AppModule` against the configured DB.

| Item | Status |
|---|---|
| Unit tests for guards, services, transitions | 🔴 none |
| e2e / integration tests | 🔴 broken scaffold |
| The regression, security, photo and authz scripts used in earlier review passes (16 / 6 / 13 / 27 checks) | 🟠 exist **only in the session scratchpad**, not in the repo; not runnable by CI |
| CI | `.github/workflows/ci.yml`: API `npm ci` → `prisma generate` → `tsc --noEmit` → build (`:20-34`); web typecheck + `next build` (`:38-49`); mobile typecheck (`:55-64`). **No test step, no lint step, no DB service** |
| Test database | none; needs a disposable Postgres (CI service container) with `prisma migrate deploy` |

**Required before the admin API work** (Phase 0 step 1):
1. Fix the Jest TypeScript configuration.
2. Replace the scaffold e2e test.
3. Add a Postgres service to CI.
4. Port the authz and security scripts into Jest.

Minimum admin suites:
- permission matrix (every `/admin/*` route × every role, including "super_admin lacks badge.*");
- cross-audience rejection;
- version conflicts (the 17→18 case);
- bulk preconditions;
- audit-row-per-mutation and rollback-on-audit-failure;
- auto-approval idempotency (a double tick, a race with a decision, a Hold);
- recovery-code single use under concurrency;
- step-up expiry;
- last-super-admin guard.

---

## 28. Performance / Scalability Audit

| Item | Evidence | Status |
|---|---|---|
| Unpaginated admin lists | `findPendingQueue` (`listings.service.ts:478-484`), `listUsers` (`admin.service.ts:13-27`, all profiles), `findOpen` (`reports.service.ts:100-111`) | 🟠 fine at 31 profiles; linear growth |
| Analytics counts | 9 `count()` queries (`admin.service.ts:87-100`); `event` has no `event_name` index (`schema.prisma:332`) → full scans as events grow | 🟠 |
| Queue query index | `status = pending ORDER BY updatedAt` has no matching index (the existing ones are `(status, city, createdAt)`) | 🟡 |
| Report queue index | none on `status` (`schema.prisma:320`) | 🟡 |
| Bulk notifications | `forEach` fire-and-forget push per item (`listings.service.ts:497-499`), unbounded | 🟠 → outbox |
| In-memory state | upload rate limit (`uploads.service.ts:49`), geocode cache and throttle (`geocoding.service.ts`) are per instance | 🟠 when scaling out |
| Socket.io | single instance, no adapter | 🟡 (not admin-critical) |
| Auto-approval tick | not built; the §12 design is O(due rows) with an index on `(status, auto_approve_at) WHERE held_at IS NULL` | — |
| DB connection | Prisma to a Supabase pooler; connect retry (`prisma.service.ts:53-69`) | 🟢 |
| `lastActiveAt` write on every request | `jwt.strategy.ts:47-52`: one UPDATE per authenticated request (admin polling every 30 s adds write load) | 🟡 throttle to once per N minutes |

At current scale (0 listings in dev), none of these is urgent. **Pagination and indexes should come with the new `/admin/*` endpoints**, not as retrofits.

---

## 29. Migration Requirements

1. **Legacy coexistence (D-46):** `apps/web/app/admin` stays working until `apps/admin` reaches parity. Old endpoints are **hardened in place** (preconditions, caps, audit) rather than removed, and are marked DEPRECATE (§25).
2. **Admin role migration:** the dev database has 7 `role='admin'` profiles (production ❓). Create `admin_role_assignments` from them per the founder's mapping (F-01); nobody gets `super_admin` or `senior_reviewer` implicitly. Keep `profiles.role='admin'` readable during the transition so the legacy `AdminGuard` still works, then switch the legacy routes to `PermissionGuard` with a legacy-compatible mapping.
3. **Profiles with dual use:** an admin's `profiles.role` currently replaces their marketplace role (seeker or owner). Decide whether admin accounts may also act as marketplace users (F-13); the recommendation is separate accounts.
4. **Listing columns:** add `version` (backfill 1), approval metadata (nullable; backfill `approval_source='manual'` for existing approved rows, `approved_at = updated_at` as the best available, **flagged as approximate** in the migration), and align the default status to `draft`.
5. **Status enum additions** are additive in Postgres (`ALTER TYPE … ADD VALUE`); web and mobile must tolerate unknown statuses before new ones appear. Mobile isn't touched in this track, so new statuses must not reach mobile-visible endpoints until mobile handles them (or map them to existing ones in user DTOs).
6. **`idDocumentUrl` deprecation:** unused (no writers), so it can be dropped once `verification_evidence` exists. Verify it's null in all environments first (dev: no writer exists, so expected null; **NOT VERIFIED by query**).
7. **Break-glass change:** stop promotion on the user login and move it to the admin login. **Until the admin login exists, removing it would lock out admins**, so the order matters (§34).
8. **Cookie namespaces:** the admin console uses new cookie names on its own origin; the user cookies are untouched.
9. **Mobile** is untouched (standing rule); user-facing DTO changes must stay backward compatible.

---

## 30. Required Database Changes

(Proposed only. **Nothing applied**; each would be one Prisma migration, reviewed separately.)

| # | Change | Phase |
|---|---|---|
| DB-01 | `audit_log` (+ category for security events), append-only, no cascading FKs; index `(target_type, target_id, created_at)`, `(actor_id, created_at)` | 0 |
| DB-02 | `admin_role_assignments` | 0 |
| DB-03 | `admin_mfa`, `admin_recovery_codes` | 0 |
| DB-04 | `admin_sessions` (+ admin refresh linkage) | 0 |
| DB-05 | `listings.version`, approval metadata, `held_at/by`, `submitted_at`, `auto_approve_at`; index `(status, auto_approve_at)` | 0 |
| DB-06 | `listing_snapshots`, `moderation_decisions` | 0 |
| DB-07 | `queue_claims` | 0 |
| DB-08 | `reports`: resolver, resolution, tier, assignee; index `(status, created_at)`; unique partial index on open `(listing_id, reporter_id)` | 0 |
| DB-09 | `app_config`: `@updatedAt`, `updated_by`, `is_public` | 0 |
| DB-10 | `job_runs`, `system_alerts`, `outbox` | 0 |
| DB-11 | `events (event_name, created_at)` index | 0 |
| DB-12 | ListingStatus additions (needs_changes, paused, archived) | 0/1 (vocabulary decision) |
| DB-13 | `user_restrictions` | 1 |
| DB-14 | `appeals` | 1 |
| DB-15 | `verification_cases`, `verification_evidence`, `evidence_access_log`; drop `id_document_url` | 1 |
| DB-16 | `owner_verification_badges`; the promotion counter | 1 |
| DB-17 | plans / subscriptions / entitlements / payments | 2 |
| DB-18 | Cascade policy review (Restrict or soft delete for trust data) | 1 (policy F-10) |

---

## 31. Required API Changes

| # | Change | Phase |
|---|---|---|
| API-01 | `PermissionGuard` + `@RequirePermission` + the static role→permission map; apply to every existing admin route (legacy-compatible) | 0 |
| API-02 | `AuditService.record(tx, …)` + retrofit all existing admin mutations | 0 |
| API-03 | Harden legacy mutations: bulk (pending-only, ≤ 50, audit), report resolve (pending-only), config (allowlist, schema), role and ban (no self-ban, no admin targets, `admin` grant removed from the `admin` role), `GET /config` public filter | 0 |
| API-04 | Remove the admin branches from `PATCH/DELETE /listings/:id` (after the replacement endpoints exist) | 0 |
| API-05 | Global exception filter (Prisma `P2025` → 404, `P2002` → 409); `ParseUUIDPipe` on ids; `forbidNonWhitelisted` for `/admin/*` DTOs | 0 |
| API-06 | CORS allowlist (HTTP + WebSocket), helmet, `@nestjs/throttler` (per IP / account / session) | 0 |
| API-07 | Admin auth module: admin login, PRE token, TOTP enroll/verify, recovery codes, step-up, sessions, `aud=admin` issuance + a separate secret; `JwtStrategy` rejects `aud=admin`; `AdminAudienceGuard`, `AdminSessionGuard`, `StepUpGuard` | 0 |
| API-08 | Break-glass: `ADMIN_PHONES` → super_admin on the **admin** login only, audited and alerted | 0 |
| API-09 | Listing versioning in every mutation (owner edits too) + snapshots | 0 |
| API-10 | Moderation endpoints: queue, claim, decision, hold, pause/restore, post-review, bulk-decision, notes | 0 |
| API-11 | Auto-approval job (§12) + `job_runs` + kill switch | 0 (after API-09/10) |
| API-12 | Admin reports v2, users v2 (paginated, masked), dashboard, audit viewer | 0 |
| API-13 | `/health` returns 503 when degraded; `/admin/system/health` | 0 |
| API-14 | Outbox worker for notifications | 0 |
| API-15 | Restrictions, appeals, verification, badges | 1 |
| API-16 | Subscriptions, payments | 2 |

---

## 32. Required Infrastructure Changes

| # | Item | Notes |
|---|---|---|
| INF-01 | **Production SMS provider (DLT-registered) + the implementation of the send call** | Blocks all production sign-in, including admin and break-glass (F-02) |
| INF-02 | Hosting for `apps/api` decided (single vs multi instance) | Drives the throttler store and job locking (F-03) |
| INF-03 | `apps/admin` hosting on `admin.ghor.co.in` and `admin-staging.ghor.co.in` (D-46/47) | DNS + TLS; no IP allowlist (D-47) |
| INF-04 | Secrets: `JWT_ADMIN_ACCESS_SECRET`, `JWT_ADMIN_REFRESH_SECRET`, `TOTP_ENCRYPTION_KEY` (with a key version), `RECOVERY_CODE_PEPPER`, `ADMIN_ALLOWED_ORIGINS` / `WEB_ALLOWED_ORIGINS` | Distinct per environment; never in the repo; production assertion like `main.ts:8-21` |
| INF-05 | A DB role for the API without `UPDATE`/`DELETE` on `audit_log` (or an append-only trigger) | Current connection role ❓ |
| INF-06 | A CI Postgres service + test step | §27 |
| INF-07 | Monitoring and alerting: uptime on `/health` (after the 503 fix), job-heartbeat alerts, error tracking for `apps/api` (no Sentry in the API today, **NOT VERIFIED**; the Sentry item in CLAUDE.md §15 targets mobile) | |
| INF-08 | Access control on production environment variables (who can edit `ADMIN_PHONES`) + a break-glass runbook | T-23 |
| INF-09 | Private object storage for verification evidence (provider OPEN) | Phase 1 |
| INF-10 | Email provider for the API (Resend is used by web today; not decided for the API) | F-08 |

---

## 33. Risk Register

| # | Risk | Likelihood | Impact | Owner | Mitigation |
|---|---|---|---|---|---|
| R-01 | No production login path (SMS not implemented; web Google unwired) blocks both launch and the admin console | High | Critical | Founder + backend | F-02 / INF-01 before production admin work |
| R-02 | A malicious or compromised admin with unaudited, unbounded powers | Medium | Critical | Backend | API-01..04 first |
| R-03 | Contradictory or blind moderation decisions (no version) | High once there are more than 1 moderators | High | Backend | API-09 |
| R-04 | Auto-approval ships as a request-scoped timer or without idempotency | Medium | High | Backend | The §12 design + tests |
| R-05 | Building the `apps/admin` UI ahead of the API contract → client-side authorization creeps in | Medium | High | Founder / engineering | §35; start the UI after build-order step 5 |
| R-06 | Evidence loss via hard deletes and cascades | Medium | High | Backend + policy | F-10, DB-18 |
| R-07 | Config poisoning or leakage | Medium | High | Backend | API-03 |
| R-08 | No tests → regressions in authorization code | High | High | Backend | Phase 0 step 1 |
| R-09 | The unsigned mobile preset keeps an unauthenticated upload path | ❓ (depends on the preset config) | Medium | Mobile track | Out of scope; track separately |
| R-10 | Admin identity entangled with the marketplace role | Medium | Medium | Founder | F-13 |
| R-11 | In-memory limits and caches bypassed when scaled out | Low now | Medium | Infra | INF-02 |
| R-12 | TOTP key management done ad hoc (a key in the DB) | Medium | High | Backend | INF-04; key outside the DB |
| R-13 | Scope creep into verification and payments before Phase 0 is done | Medium | Medium | Founder | §35 |
| R-14 | Outage catch-up auto-approves a backlog unseen | Low | Medium | Founder | F-04 |
| R-15 | Audit volume and retention costs | Low | Low | Founder | F-09 |

---

## 34. Exact Phase 0 Backend Build Order

Each step is a separate PR into `dev` with tests. **"Gate"** = must be merged before the next begins.

| Step | Work | Depends on | Gate |
|---|---|---|---|
| 1 | **Test foundation:** fix the Jest TypeScript configuration; delete the scaffold e2e test; a CI Postgres service + `prisma migrate deploy` + a test step; port the scratchpad authz/security checks into Jest | none | ✅ |
| 2 | **Error and validation hygiene:** global exception filter (P2025/P2002 mapping); `ParseUUIDPipe` on the admin ids; `/health` returns 503 when degraded | 1 | |
| 3 | **Audit log:** DB-01 + `AuditService` (transaction-scoped) + retrofit the existing admin mutations (bulk status, report resolve, review hide, ban, role, config, geocode backfill, admin listing update/delete) | 1 | ✅ |
| 4 | **Permission layer:** `PermissionGuard` + the static map (§9) with a legacy mapping (`role='admin'` → today's effective permissions) so nothing breaks; tests covering route × role | 3 | ✅ |
| 5 | **Close unsafe mutations:** bulk pending-only + ≤ 50 + reason; report resolve precondition; config allowlist, schema and `is_public` (DB-09) + filtered `GET /config`; role grant restricted; no self-ban or admin-target ban; `ArrayMaxSize` | 4 | ✅ |
| 6 | **Transport security:** CORS allowlists (HTTP and WebSocket), helmet, throttler on auth and admin routes; `forbidNonWhitelisted` on the admin DTOs | 1 | |
| 7 | **Listing integrity:** DB-05/06 (version, snapshots, decisions); version increments on every mutation; 409 conflicts; approval metadata | 3 | ✅ |
| 8 | **Moderation API:** queue (paginated), claim (DB-07), decision, hold, pause/restore, post-review, bulk-decision, notes; the outbox (DB-10) + worker for owner notifications; remove the admin branches from the user endpoints **after** the legacy admin is switched to the new endpoints or the hardened old ones | 7 | ✅ |
| 9 | **Admin identity:** DB-02 roles + migration per F-01; DB-03/04 MFA, recovery codes, sessions; the admin auth endpoints (§25.1); `aud=admin` + separate secrets; `JwtStrategy` rejects admin tokens; step-up guard; break-glass moved to the admin login + audited | 4, INF-04; **production use needs INF-01** | ✅ **`apps/admin` may start here** |
| 10 | **Auto-approval engine:** job + advisory lock + `job_runs` + kill switch + alerts; verified-owner immediate path stubbed behind a flag until §17 exists | 7, 8 | |
| 11 | **Admin read APIs:** dashboard, users v2 (masked, paginated), reports v2, audit viewer, system health, analytics date ranges | 3, 4 | |
| 12 | **Security review** of Phase 0 (MPB §26.11: "The admin console gets its own security review before launch") | all | ✅ before production |

---

## 35. What MUST NOT be built yet

- **`apps/admin`** (the directory, scaffold or UI), until build-order step 9 is merged. The contract in §25 comes first.
- Removal of `apps/web/app/admin` (D-46: stays until parity).
- **Payment-provider integration**, subscription billing, refunds (the provider isn't chosen; Phase 2).
- **Verification-document upload** or any evidence storage before the storage, retention and document-requirement decisions (F-06).
- GHOR Verified grant/revoke endpoints before verification cases exist.
- **Any endpoint giving any role access to private chats** (MPB §26.5).
- Bulk badge actions (MPB §26.6).
- `super_admin` implicit verification or badge powers (D-47).
- A mandatory IP allowlist (D-47: not required).
- Redis, BullMQ, microservices or a separate admin API service (MPB §26.6: same `apps/api`; CLAUDE.md §14.11). Revisit only if multi-instance hosting requires a shared store.
- Client-side-only permission logic in any admin UI.
- The mobile unsigned-preset fix (a separate mobile track; `apps/mobile` untouched).
- Admin endpoints to edit an owner's listing content (not in the MPB §26.10 action list).
- Reusing the `events` table as the audit log.

---

## 36. Open Founder Decisions

These don't reopen D-01…D-47; they are gaps those decisions leave open or that the code audit surfaced.

| # | Decision | Why it blocks | Recommended default |
|---|---|---|---|
| F-01 | Mapping of the existing admins (dev: 7; production: ❓) to `admin` / `senior_reviewer` / `super_admin` | Step 9 migration | Founder = super_admin + senior capability; everyone else = `admin` until reassigned |
| F-02 | Production SMS provider (DLT) — or a second admin first factor if SMS is delayed | No production sign-in at all | Resolve before production admin use; D-47's phone OTP + TOTP stands |
| F-03 | API hosting (single vs multiple instances) | Throttler store, job locking | Single instance + advisory lock works for both |
| F-04 | Auto-approval catch-up after an outage | Scam window after downtime | Auto-approve if overdue ≤ 30 min; otherwise hold for a human (PROPOSED) |
| F-05 | Auto-approval of risk-flagged items (existing MPB §52 Q-10) | Job predicate | Don't auto-approve flagged items |
| F-06 | Verification document requirements, storage provider, retention (OPEN) | Phase 1 verification | — (not invented here) |
| F-07 | Payment provider (OPEN) | Phase 2 | — (not chosen here) |
| F-08 | API email provider, and whether and when profiles collect email | Security notifications, rejection reports by email (D-20) | Reuse the web provider for consistency (PROPOSED) |
| F-09 | Audit retention (1 year minimum vs 3 years) and integrity mechanism (hash chain vs daily checksum) | DB-01 design | 3 years; a daily checksum |
| F-10 | Deletion policy: user self-deletion versus trust-evidence retention | Cascades destroy reports and messages | Anonymize the profile; keep trust records for the retention period |
| F-11 | Whether any admin hard delete remains | API-04 | No; pause/archive only |
| F-12 | Second-super-admin approval for senior/super role changes and super_admin evidence break-glass | Step 9 | Yes once ≥ 2 super_admins |
| F-13 | May an admin account also be a marketplace owner or seeker? | Role model | Separate accounts |
| F-14 | Rejection and needs-changes reason-code taxonomy (D-20 structure is decided; the codes aren't) | Decision endpoint input | Start from the MPB §26.10 checklist |
| F-15 | Final listing-status vocabulary in the DB (needs_changes / paused / archived / suspended) | DB-12 | Per MPB §26.9 |

---

## 37. Final Recommendation

**Don't build `apps/admin` yet.** The existing API gives the console almost nothing it can safely rely on:
- no permissions;
- no audit;
- no concurrency control;
- no admin authentication;
- several unbounded admin mutations.

Put a UI on top of it now and client-side authorization and unaudited power become permanent.

1. Execute the **Phase 0 backend build order (§34), steps 1–9**. That's where the console can safely start. Resolve **F-02 (production SMS)** in parallel, because without it no production sign-in (admin or user) works.
2. Then build `apps/admin` against the §25 contract while steps 10–12 finish.
3. Treat the legacy `apps/web/app/admin` as a **hardened, audited, deprecated** client until parity.

**Documentation contradictions discovered** (reported here first, per instructions; existing docs **not** edited):

| # | Documentation says | Code does | Verdict |
|---|---|---|---|
| DC-1 | OTP is a "4-digit box" (CLAUDE.md §5, §16.4) | 6 digits (`auth.service.ts:158-160`, `verify-otp.dto.ts:11`) | NEEDS CHANGE (doc) |
| DC-2 | Listings default to `pending` (CLAUDE.md §6; `schema.prisma:180`) | Created as `draft` (`listings.service.ts:84`) | NEEDS CHANGE (schema default / doc) |
| DC-3 | "Rejected listings get a reason stored for owner visibility" (CLAUDE.md §14.10) | No reason field or input | NOT IMPLEMENTED |
| DC-4 | `property_verified` is admin-settable (CLAUDE.md §6) | No API writes it | NOT IMPLEMENTED |
| DC-5 | "An admin account only exists via a direct database update" (`admin.guard.ts:12-13`) | `ADMIN_PHONES` + `PATCH /admin/users/:id/role` create admins | NEEDS CHANGE (comment) |
| DC-6 | Email fallback for new inquiries (CLAUDE.md §7.7, §14.5) | No email in the API | NOT IMPLEMENTED |
| DC-7 | Account deletion "removes/anonymizes" (CLAUDE.md §15.4) | Hard delete + cascades (`auth.service.ts:456`) | NEEDS CHANGE (policy F-10) |
| DC-8 | Admin access "gated by Google-login JWT" (CLAUDE.md §14.10) | Web Google sign-in not wired; phone OTP only; production SMS not implemented | NEEDS CHANGE |
| DC-9 | MPB §26.4 "Revocation … CURRENT pattern in `JwtStrategy`" | True for HTTP (`jwt.strategy.ts:41-45`); **no admin sessions exist to end** | PARTIAL |

---

## Final Summary

### A. What is already ready
- The per-request role and ban check from the DB (`jwt.strategy.ts:41-45`).
- Atomic OTP attempts and consumption.
- Refresh rotation with an atomic revoke.
- Production JWT-secret assertion.
- Ownership checks and owner status transitions.
- The ≥ 3 photo publish rule; re-moderation after an owner edits a live listing.
- The signed-upload design and own-cloud URL validation.
- Report creation rules (dedupe, no self-report, distinct-reporter threshold).
- Transactional review hiding with aggregate recompute.
- Ban revokes refresh tokens.
- The Expo push service.
- A schema consistent with its migration.
- Admin routes all carry `JwtAuthGuard + AdminGuard`.

### B. What is broken
- The test suite: 0 unit tests; the e2e suite fails to compile and targets a non-existent route.
- Production phone OTP (throws or returns 503).
- Web Google sign-in isn't wired.
- `/health` returns 200 when the DB is down.
- `app_config.updatedAt` never updates.
- An admin approve can skip the photo rule.
- Report confirm forces rented, rejected or draft listings to `pending`.
- `report_threshold ≤ 0` de-lists on one report.

### C. What is insecure
- CORS any origin (HTTP `main.ts:26`, WebSocket `chat.gateway.ts:39`); no security headers (API or web).
- Any admin can grant admin, ban other admins or themselves, and write any config key; every config key is served to all users.
- Admins can edit or hard-delete any listing through the owner endpoints.
- Bulk moderation has no precondition or cap; last-write-wins moderation.
- **No audit log.**
- The legacy admin shares the marketplace session (`SameSite=Lax`, an any-path BFF, the access token exposed through socket-token).
- The silent `ADMIN_PHONES` promotion on the user login.
- The unsigned mobile preset (impact depends on its folder config, NOT VERIFIED).
- `idDocumentUrl` as a URL column.
- Unmasked phone numbers in admin lists.

### D. What must change before apps/admin starts
§34 steps 1–9:
1. Tests + CI.
2. Error hygiene.
3. The audit log.
4. The permission guard.
5. Closing the unsafe mutations.
6. CORS, headers, rate limits.
7. Listing versioning and snapshots.
8. Moderation endpoints + outbox.
9. The admin role model + admin auth (aud=admin, sessions, TOTP, recovery codes, step-up, audited break-glass).

### E. What new API endpoints are required
- **AUTH:** `/admin/auth/*` (OTP, TOTP enroll/verify, recovery verify and regenerate, step-up, refresh, logout, me, sessions).
- **ADMIN USERS:** `/admin/admin-users/*`.
- **DASHBOARD:** `/admin/dashboard`.
- **LISTINGS:** `/admin/listings[/:id, /history, /diff]`.
- **MODERATION:** `/admin/moderation/queue`, claim, `/admin/listings/:id/{decision, hold, pause, restore, post-review, notes, flags, escalate}`, `/admin/moderation/bulk-decision`.
- **REPORTS:** `/admin/reports/*`.
- **TRUST:** `/admin/users/:id/restrictions`.
- **USERS:** users v2 + reveal-phone.
- **AUDIT:** `/admin/audit` (+ export).
- **SYSTEM HEALTH:** `/admin/system/health`, alerts ack, geocode-backfill.
- **ANALYTICS:** `/admin/analytics/moderation`.
- **Phase 1–2 (contract reserved):** VERIFICATION, GHOR VERIFIED, APPEALS, PLACES, SUBSCRIPTIONS, PAYMENTS, notification deliveries.

### F. What database changes are required
Phase 0 (DB-01…DB-12):
- `audit_log`;
- `admin_role_assignments`, `admin_mfa`, `admin_recovery_codes`, `admin_sessions`;
- listing `version` + approval metadata + `auto_approve_at` + hold;
- `listing_snapshots`, `moderation_decisions`, `queue_claims`;
- report resolution fields and indexes;
- `app_config` `@updatedAt` / `updated_by` / `is_public`;
- `job_runs`, `system_alerts`, `outbox`;
- the `events (event_name, created_at)` index;
- status additions.

Phase 1–2 (DB-13…DB-18): restrictions, appeals, verification, badges, billing, cascade policy.

### G. What infrastructure is required
- A production SMS provider (DLT) + implementation.
- A hosting decision.
- The admin domains (production and staging).
- Admin JWT secrets, a TOTP encryption key and a recovery pepper (per environment).
- An origin allowlist.
- An append-only DB privilege or trigger for `audit_log`.
- A CI Postgres service.
- Uptime, job-heartbeat and error monitoring for the API.
- Controlled access to production environment variables + a break-glass runbook.
- Later: private evidence storage, an API email provider.

### H. Top 10 Phase-0 backend tasks
1. Fix Jest and CI; add a Postgres-backed test job; port the authz/security checks.
2. `audit_log` + a transaction-scoped `AuditService`; retrofit all existing admin mutations.
3. `PermissionGuard` + the static permission map with a legacy-compatible mapping.
4. Harden legacy mutations (bulk precondition and cap, report precondition, config allowlist and public filter, role and ban guards).
5. CORS allowlists (HTTP and WebSocket) + helmet + throttler + global exception filter.
6. Listing `version` + snapshots + 409 conflicts across all mutations.
7. Moderation action endpoints + claims + outbox; remove the admin branches from the user endpoints.
8. Admin role model + migration of the existing admins (F-01).
9. Admin auth: `aud=admin`, sessions (30 min / 12 h), TOTP, recovery codes, step-up, audited break-glass.
10. Auto-approval job (DB-driven, advisory lock, idempotent, monitored, kill switch).

### I. Critical risks
- R-01: no production login path.
- R-02: an unaudited, unbounded malicious or compromised admin.
- R-03: contradictory or blind moderation without versioning.
- R-04: a naive auto-approval implementation.
- R-05: the UI built before the API contract.
- R-06: evidence loss via hard deletes and cascades.
- R-08: no tests guarding authorization code.

### J. Open decisions
- F-01 admin mapping · F-02 production SMS · F-03 hosting · F-04 outage catch-up · F-05 risk-flagged auto-approval (Q-10).
- F-06 verification documents (OPEN) · F-07 payment provider (OPEN) · F-08 API email and profile email.
- F-09 audit retention and integrity · F-10 deletion versus retention · F-11 admin hard delete · F-12 second super_admin approvals.
- F-13 admin versus marketplace accounts · F-14 reason codes · F-15 status vocabulary.

### K. Recommended implementation order
Tests/CI → error hygiene → audit log → permission guard → hardening of the legacy mutations → transport security → listing versioning → moderation API + outbox → admin identity and MFA (**start `apps/admin` here**) → auto-approval job → admin read APIs → Phase 0 security review. In parallel throughout: production SMS (F-02) and the hosting decision (F-03). Phase 1 after that: restrictions, appeals, verification, GHOR Verified. Phase 2: subscriptions and payments.
