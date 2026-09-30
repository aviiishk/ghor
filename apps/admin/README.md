# GHOR Admin Console (`apps/admin`)

The separate admin application (D-46, D-47). Production `admin.ghor.co.in`, staging
`admin-staging.ghor.co.in`. It replaces the legacy `apps/web/app/admin` once it reaches
parity; until then both exist.

## Architecture

```
Browser ──► apps/admin (Next.js)
              ├─ pages (client components; UX only)
              └─ BFF route handlers  /api/auth/*  /api/admin/*
                     │  admin tokens live in httpOnly, SameSite=Strict, Secure, __Host- cookies
                     ▼
              apps/api  /admin/*   (aud=admin token + live MFA session + permission + step-up)
                     ▼
              PostgreSQL           (never reached from this app)
```

- **No token ever reaches browser JavaScript.** Sign-in handlers put the pre-MFA,
  break-glass, access and refresh tokens into cookies and return only what the UI needs
  (next MFA step, the enrollment QR, recovery codes shown once).
- **The API is the security boundary.** Navigation and buttons mirror the permission map
  from `GET /admin/auth/me` for convenience; every request is authorized by `apps/api`.
- **CSRF:** cookies are `SameSite=Strict` on a separate origin, and every state-changing BFF
  call must come from this origin (`Origin` / `Sec-Fetch-Site` check).
- **Step-up:** when the API answers `STEP_UP_REQUIRED`, the console asks for a fresh
  authenticator code (`/api/auth/step-up`) and retries once.
- **Headers:** per-request CSP with a script nonce (`middleware.ts`), no framing, no referrer,
  `noindex`.

## Running locally

1. Start `apps/api` with the admin variables set (see `apps/api/.env.example`, section
   "Admin console"): `JWT_ADMIN_ACCESS_SECRET`, `ADMIN_TOTP_ENCRYPTION_KEY`,
   `ADMIN_RECOVERY_CODE_PEPPER`, and `ADMIN_ALLOWED_ORIGINS=http://localhost:3001`.
2. `cp .env.example .env.local` and set `ADMIN_API_URL` (default `http://localhost:3000`).
3. `npm run dev -w apps/admin` → http://localhost:3001

The first super admin comes from `ADMIN_PHONES` on the API (break-glass: explicit, audited,
forces authenticator enrollment). Existing `role=admin` accounts were migrated to the
least-privileged `admin` role; promote them from **Admin users**.

## Scope (Phase 0)

Sign-in (OTP → TOTP, recovery codes, break-glass), overview, moderation queue and review
workspace (decide, hold, pause/restore, post-review, claim, notes — all version-checked),
reports, users (masked; ban/unban with step-up), verification **status** (read-only), audit
log (+ export), system health, admin users, configuration, own sessions and recovery codes.

Not yet: verification documents/evidence, GHOR Verified grant/revoke, appeals, payments,
subscriptions (Phase 1–2).
