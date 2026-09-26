# Contributing to GHOR

How code moves from an idea to production. Short on purpose — read it once.

## Branches

| Branch | Purpose | Who writes to it |
|---|---|---|
| `main` | **Production.** Always deployable; what's live (or about to be). | Only via a release PR from `dev`. Never commit directly. |
| `dev` | **Integration.** The next release, tested together. | Only via PRs from feature/fix branches. Never commit directly. |
| `feature/<short-name>` | New work, e.g. `feature/mobile-create-wizard` | You. Branch off `dev`. |
| `fix/<short-name>` | Bug fixes, e.g. `fix/chat-unread-badge` | You. Branch off `dev`. |
| `hotfix/<short-name>` | Urgent production fix | Branch off `main`, PR into `main`, then merge `main` back into `dev`. |

```
feature/* ──PR──▶ dev ──release PR──▶ main
fix/*     ──PR──▶ dev
hotfix/*  ──PR──▶ main ──merge back──▶ dev
```

## Day-to-day flow

```bash
git switch dev && git pull
git switch -c feature/my-change
# ...work, commit...
git push -u origin feature/my-change
# open a PR into dev on GitHub; CI must be green; review; squash-merge
```

Keep branches short-lived (days, not weeks). Delete them after merging.

## Commit messages — Conventional Commits

`<type>(<scope>): <summary>` — e.g. `fix(api): cap OTP sends per number`.

- **types:** `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `ci`, `style`
- **scopes:** `api`, `web`, `mobile`, `design`, `docs`, `ci` (omit if it spans everything)
- Summary in the imperative ("add", not "added"), no trailing full stop.

## Pull requests

- Fill in the template — especially **how it was tested**. "Typechecked" is not "tested".
- One concern per PR. A redesign and a security fix are two PRs.
- CI (`.github/workflows/ci.yml`) must pass: typecheck + build for api/web, typecheck for mobile.
- Squash-merge into `dev`; merge-commit `dev` → `main` for releases so the release is one visible point in history.

## Releases

1. Open a PR `dev` → `main` titled `release: <date or version>` listing what's included.
2. Verify on staging (`ghor-dev`) first. Prisma migrations: `npm run prisma:deploy` against production **before** deploying code that needs them.
3. Merge, then tag: `git tag v0.x.y && git push --tags`.

## Rules that are never negotiable

- **No secrets in git.** `.env*` files are ignored; only `*.example` templates are committed. If a secret is ever committed, rotate it — deleting the commit is not enough.
- **No fake data presented as real** — listings, ratings, reviews, counts, testimonials (root `CLAUDE.md`, `DESIGN.md` redesign amendments).
- **Web and mobile at parity** (root `CLAUDE.md` §3) — or the gap is written down in `STATUS.md`.
- **Never call `apps/api` outside a feature's `api.ts`**, never talk to Postgres outside `apps/api` (root `CLAUDE.md` §14.2).

## GitHub settings to switch on (repo owner, one-time)

Settings → Branches → **Add branch ruleset** for `main` and for `dev`:

- Require a pull request before merging (1 approval — CODEOWNERS)
- Require status checks to pass: `API — typecheck & build`, `Web — typecheck & build`, `Mobile — typecheck`
- Require branches to be up to date before merging
- Block force pushes; restrict deletions

Settings → General: allow **squash merging**, enable **automatically delete head branches**.
