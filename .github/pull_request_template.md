## What & why

<!-- One or two sentences: what this PR changes and the reason. Link the issue if there is one. -->

## Surfaces touched

- [ ] `apps/api`
- [ ] `apps/web`
- [ ] `apps/mobile`
- [ ] Docs only

## How it was tested

<!-- Be specific. "Typechecked" is not "tested". -->

- [ ] Typecheck / build (CI green)
- [ ] API tested against a real database
- [ ] Web checked in a browser (desktop + phone width)
- [ ] Mobile run on an emulator or device

## Checklist

- [ ] Web and mobile stay at parity, or the gap is noted in the relevant `STATUS.md`
- [ ] No secrets, `.env` files or real user data committed
- [ ] No fake data presented as real (listings, ratings, counts, testimonials)
- [ ] Schema changes come with a Prisma migration
- [ ] `STATUS.md` updated if behaviour changed
