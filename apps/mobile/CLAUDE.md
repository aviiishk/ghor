@AGENTS.md

# GHOR App — Repo Context (Expo / React Native)

> This is `apps/mobile` in the GHOR monorepo. The full product spec — what GHOR is, MVP scope, data model, auth design, monetization, build order — lives in **`../../CLAUDE.md`** (root of the monorepo). Read that first. This file only covers things specific to working in *this* workspace.
>
> **Before assuming any feature, screen, or table exists, check [STATUS.md](STATUS.md).** It tracks what's actually built vs. stubbed vs. missing, and is more current than memory or the presence of a file name.

---

## Non-negotiable conventions (see root `CLAUDE.md` §14 for full rationale)

1. **Never call `supabase.from(...)` outside a feature's `api.ts`.** Data flow is always `Component → hooks.ts (TanStack Query) → api.ts (supabase-js) → Supabase`. This is the single rule that lets GHOR swap Supabase for a custom backend later without touching UI.
2. **Every `api.ts` function gets a `useQuery`/`useMutation` wrapper in that feature's `hooks.ts`.** Components never import `supabase-js` or call `api.ts` directly.
3. **Feature-based folders under `src/features/<feature>/`** (`api.ts`, `hooks.ts`, `types.ts`, `components/`), not type-based (`components/`, `hooks/` as top-level siblings).
4. **Cursor pagination from day one** for the browse feed (`useInfiniteQuery`, keyset on `(created_at, id)`) — never `OFFSET`.
5. **Config-driven values** (ad frequency, page size, feature flags) come from the `app_config` table via `src/lib/config.ts`, never hardcoded.
6. **Two Supabase projects** (`ghor-dev` / `ghor-prod`), selected via `.env.development` / `.env.production` and the EAS build profile. Never point a dev build at the prod project.
7. **This app talks to `apps/api` (NestJS), not Postgres/Supabase directly** — root `CLAUDE.md`'s "Architecture pivot" note (§3). There is no shared `@ghor/backend` types package anymore; `features/*/api.ts` are typed against `apps/api`'s DTOs/response shapes, not raw DB rows. **`features/auth/` was rewritten 2026-08-18** and is the reference implementation of this pattern — `lib/apiClient.ts` is the HTTP client (Bearer token attach, refresh-and-retry on 401), `features/auth/api.ts` calls `apps/api`'s `/auth/*` endpoints. `features/listings/`, `features/chat/`, etc. don't exist yet and should follow the same shape once built. `lib/analytics.ts` and `lib/config.ts` are the two files still calling Supabase directly (lower-stakes, not yet rewritten) — see STATUS.md before assuming otherwise for any given file.

## Repo layout

```
apps/mobile/
  app/            # Expo Router routes — thin screen composition only
  src/features/   # api.ts + hooks.ts + components/ per feature
  src/lib/        # supabase client, cloudinary, config, analytics, queryClient
```

The Supabase schema and generated `database.ts` types used to live inside this app, then briefly in a shared `packages/backend` workspace package — both are gone now. The database schema lives in **`apps/api/prisma/schema.prisma`**; this app will eventually call `apps/api` over HTTP/WebSocket instead of touching the database at all. Don't recreate a local `supabase/` folder, `src/types/database.ts`, or a `@ghor/backend`-style shared package here.

Full rationale for the feature-folder structure: root `CLAUDE.md` §14.1.

## Design system

UI colors, typography, and component conventions for this app are in [design.md](design.md) (derived from root `CLAUDE.md` §16 and the mockups in `../../assets/`). Match it — don't invent new colors or spacing ad hoc.

**The tokens are wired into code, not just documented:** `tailwind.config.js` imports colors/spacing/fontFamily from `../../design-tokens.js` (shared with `apps/web`) — use the resulting NativeWind classes (`bg-primary`, `text-ink`, `text-muted`, `border-hairline`, etc.) rather than raw hex. For icon `color` props / `ActivityIndicator` / React Navigation options that don't accept a className, import `colors` from `@/lib/tokens` instead of hardcoding a hex literal — see `app/(tabs)/_layout.tsx` for the pattern. Border-radius is the one exception: Tailwind's default `rounded-xl`/`rounded-2xl`/`rounded-3xl` (12/16/24px) already equal `../../DESIGN.md`'s sm/md/lg, so use those directly rather than a token name that doesn't exist in this config.

## Monorepo mechanics

- This app is an npm workspace (`@ghor/mobile`) — dependencies are installed once from the monorepo root (`npm install` in `../../`), not from inside this folder.
- `metro.config.js` is configured for monorepo resolution (`watchFolders` includes the workspace root, `nodeModulesPaths` includes both local and root `node_modules`). If you add another shared workspace package later, this config shouldn't need to change.
- Run Expo commands via `npm run mobile` from the monorepo root, or `cd apps/mobile && npx expo start` directly — both work.
- EAS builds need their "root directory" / working directory set to `apps/mobile` in `eas.json` / the EAS project settings — not yet configured, see STATUS.md.

## Environment

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` — per-environment Supabase project.
- `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`, `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET` — image uploads.
- `EXPO_PUBLIC_SENTRY_DSN` — crash reporting.
- `EAS_PROJECT_ID` — EAS builds.

All of the above are already populated in `.env.development` and `.env.production` — see STATUS.md for what's actually wired up on the Supabase project side (schema, RLS, Edge Functions) vs. just the client pointing at a project.
