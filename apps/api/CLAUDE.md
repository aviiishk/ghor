# GHOR API — Repo Context (NestJS)

> This is `apps/api` in the GHOR monorepo — the custom backend that `apps/mobile` and `apps/web` talk to. It replaces the earlier "Supabase direct via `supabase-js`" architecture (see the "Architecture pivot" note in root `CLAUDE.md` §3). Read root `CLAUDE.md` first for the full product spec, then this file for how the backend itself is built.
>
> **Before assuming an endpoint, module, or table exists, check [STATUS.md](STATUS.md).** This app was scaffolded 2026-07-23 — most business logic doesn't exist yet, only the Nest/Prisma skeleton.

---

## Why this exists

Root `CLAUDE.md` originally specified "no custom backend server for the MVP" — Supabase direct (behind a thin service layer), with RLS enforcing authorization. That was deliberately reversed: the founder wants full control over business logic and authorization living in code they own, not in Postgres RLS policies. This app is that code. See root `CLAUDE.md`'s architecture pivot note for the full reasoning and what it costs (real hosting, no more free-tier-only backend, more to build before launch).

## What Postgres is now

Still Postgres — currently the same Supabase-hosted Postgres instance (`ghor-dev`/`ghor-prod`), but **connected to directly via Prisma** (`DATABASE_URL`), not through `supabase-js`/PostgREST. Supabase Auth, Realtime, RLS, and Edge Functions are **not used** by this app. (Supabase Storage was never used either — Cloudinary handles images, unchanged.)

## Structure

```
apps/api/
  prisma/
    schema.prisma      # single source of truth for the DB schema — see STATUS.md for migration state
  src/
    prisma/            # PrismaService + PrismaModule (global, injectable everywhere)
    health/             # GET /health — liveness + DB connectivity check
    main.ts             # bootstrap: CORS enabled, global ValidationPipe
    app.module.ts
```

Feature modules (auth, listings, chat, reports, admin) don't exist yet — see STATUS.md for what's planned and in what order.

## Conventions to follow as modules get built

- **Nest module-per-feature**, mirroring the `features/*` convention already used in `apps/mobile`: each feature gets its own module, controller, service, and DTOs (with `class-validator` decorators — already wired into the global `ValidationPipe` in `main.ts`).
- **Authorization lives in guards/services, not the database.** There is no RLS safety net anymore — every query that should be scoped to "your own rows" or "admin only" must explicitly filter/check in the service layer. Be as deliberate here as the old RLS policies were (see root `CLAUDE.md`'s note on what the removed migrations enforced — `listings.status` admin-only changes, `profiles.role` escalation guard, participant-only chat access — all of that needs an equivalent explicit check in this app's code now).
- **Prisma is the only DB access path.** No raw `pg` client, no query builder mixing. Use `PrismaService` (injected via the global `PrismaModule`).
- **Migrations**: `npm run prisma:migrate` (dev) / `npm run prisma:deploy` (prod) from this directory — not the Supabase CLI, which is no longer used.
- **Auth tokens**: JWT access + refresh tokens issued by this API (see `.env.example` for the secrets). No Supabase session tokens anywhere in the system anymore once the auth module lands.
- **Realtime chat**: planned as a WebSocket gateway inside this app (Socket.io), not Supabase Realtime — not built yet, see STATUS.md.

## Running locally

```
cp .env.example .env   # fill in DATABASE_URL at minimum
npm run api            # from the monorepo root — runs `nest start --watch` here
```

`GET /health` should return `{ "status": "ok", "database": "connected" }` once `DATABASE_URL` points at a real, migrated database.
