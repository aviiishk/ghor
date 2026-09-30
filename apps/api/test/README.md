# API tests

| Command | What | Needs |
|---|---|---|
| `npm test` | Unit tests (`src/**/*.spec.ts`) | nothing |
| `npm run test:e2e` | End-to-end tests (`test/*.e2e-spec.ts`) against the real AppModule and a real Postgres | a **disposable** Postgres |

## Disposable Postgres for e2e

```bash
docker run -d --name ghor-test-pg -e POSTGRES_USER=ghor -e POSTGRES_PASSWORD=ghor_test \
  -e POSTGRES_DB=ghor_test -p 55432:5432 postgres:16-alpine
npm run test:e2e
```

- Default URL: `postgresql://ghor:ghor_test@localhost:55432/ghor_test`; override with
  `TEST_DATABASE_URL`. The harness **refuses any non-local host** (tests truncate every table).
- Global setup runs `prisma migrate deploy` (the same migrations production applies).
  For a from-scratch schema, recreate the container. CI uses a fresh Postgres service
  container on every run.
- Tests never read `apps/api/.env` (`NODE_ENV=test` → `ignoreEnvFile`); the whole
  environment is set in `test/setup/env.js` with throwaway secrets.
- Time is controlled with `TestClock` (session expiry, step-up windows, TOTP steps,
  auto-approval) and SMS is captured by `FakeSms` (`test/helpers/harness.ts`).

## Why ts-jest pins its compiler

ts-jest is hoisted to the monorepo root, where another workspace installs TypeScript 6.
Resolved from there it compiled this project with TS 6, which rejected the tsconfig
(TS5011 implicit `rootDir`, TS5101 deprecated `baseUrl`) — the reason the old e2e suite
never compiled. Both jest configs pin `compiler` to this package's TypeScript, and the
tsconfig now sets `rootDir` explicitly and no longer uses `baseUrl`.
