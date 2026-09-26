# GHOR — Launch & Growth Plan

> Companion to root `CLAUDE.md` (product/build spec) and `STATUS.md` (current build state). This file is about **getting real user attention on launch day**, not what to build — it assumes the MVP scope in `CLAUDE.md` §2 is correct and asks: given that, how do we make launch actually land? Update this whenever a launch-relevant decision changes, same as the other docs.
>
> Last updated: 2026-07-23. Answers baked in from this planning session: **some budget for targeted spend** (not zero, not large), **launch timed to a real move-in window** (not "whenever the build is ready"), **supply seeded before public launch** (not after).

---

## 1. Reality check on timing first

Before picking a launch date, an honest look at what's actually left to build (`STATUS.md`, `apps/api/STATUS.md`): no live database, no auth module, no listings module, no chat gateway, mobile app still calling Supabase directly pending rewrite. This is genuinely more than "a few weeks" of work — the original 4-week estimate was for the pre-pivot Supabase-direct architecture and no longer applies (root `CLAUDE.md`'s build-order note already flags this).

**Updated 2026-07-23, second revision: the September estimate below no longer holds.** A separate decision the same day made `apps/web` a full parallel product (browse, detail, auth, chat, owner tools — not just landing+admin, see `CLAUDE.md` §3). That's a second full client build against the same backend, done by the same solo developer — the backend work doesn't change, but every core-loop feature now gets built twice (once per surface) before launch, since both surfaces are launching together (an explicit choice, not a default).

**Revised realistic build-complete date: late October–November 2026** (~13–16 weeks from now) — roughly the original 8-week estimate for backend + mobile, plus 4–6 more weeks for a genuinely second client (web tends to move faster per-feature than native mobile — no app-store review cycle, faster iteration — but "faster per feature" times "the whole core loop again" is still real weeks, not days). Treat this as the new planning anchor; it will move again once auth-module effort (mobile + web) is actually known.

**Silver lining on timing:** this pushes the realistic public launch into **December 2026**, which lands closer to the *second* Guwahati demand window below (winter transfers/spring intake) than the first — not the tail of the June–August wave the original September target was chasing. Worth treating January 2027 as the primary target now, not just the backup, given this.

### The Guwahati demand calendar

Assam's college admission cycle (post-HS results, most universities) runs roughly **June–August**, with a smaller secondary wave around **December–January** (winter transfers, mid-year job postings, some spring intakes). Two things matter here:

- **We've already missed the front of the June–August wave** — that's just true, and no amount of planning changes it.
- **The room search itself lags semester start by weeks**, because a large share of new students/movers start in a hostel or temporary stay and only start hunting for a permanent room off-campus once classes have already begun. This "still searching" tail typically runs into September.

**Recommendation, revised:** given the build-complete date above moved to late October–November, target a **December 2026–January 2027 launch**, landing on the winter-transfer/spring-intake demand window instead of chasing the already-passed June–August wave. This is no longer "the backup window" — it's the realistic primary target now that web parity is in scope.

---

## 2. Pre-launch supply seeding (do this *during* closed testing, not after)

Root `CLAUDE.md` §7.1 requires 12 testers for 14 continuous days before Play Store production approval — **that 14-day window is free seeding time, not dead time.** The build order (§10, Phase 3) already reflects this — seeding is the primary activity during closed testing, not an afterthought.

**Target before public launch: 60–100 real, photographed, approved Guwahati listings.** A visitor's very first impression is the browse feed — an empty or 8-listing feed reads as a dead product no matter how good the pitch was.

**How, concretely** (founder is Guwahati-based — this is the actual unfair advantage, use it):
1. **PG operators and small landlords first** — they have the most rooms per contact (highest listings-per-outreach-hour). Visit/call PG operators near the big colleges (Gauhati University, Cotton University, Assam Engineering College areas, NIT/IIT-adjacent housing clusters) directly.
2. **Brokers as first suppliers, not just future ones** (root `CLAUDE.md` §8 already frames brokers as future paying suppliers — pull that forward). A broker sitting on 15–20 rooms who lists them on GHOR for free visibility costs them nothing and gets GHOR instant inventory. Approach 3–5 brokers before launch specifically for this.
3. **Facebook/local rental groups** — screenshot-scrape (with permission/outreach, not scraping without consent) or directly message posters in the existing Guwahati room-rental Facebook groups GHOR is meant to replace; invite them to list for free.
4. **The 12 closed-test testers themselves** — recruit a mix of both seekers *and* owners among the 12, not all seekers. Every owner-tester is a real listing.

**Seeding cadence:** don't wait until day 14 to have all 100 — front-load it in the first 7 days of closed testing so there's time to fix moderation/upload friction from real usage before public launch.

---

## 3. Growth loop — what to add to the product (new, not yet in `CLAUDE.md` §2)

The current MVP scope has no built-in virality mechanic beyond the waitlist page's scarcity counter. Two small additions, cheap to build, meaningfully change launch-day spread:

- **Referral code on signup.** Each user gets a short code/link; sharing it and having a friend sign up surfaces on both users' profile ("2 friends joined"). No reward needed at launch (avoid the cost/fraud-surface of cashback) — visible social proof is enough to start. **This needs a decision from you before it's built** — it's a scope addition to §2, not something to silently add.
- **Post-signup share prompt**, not just a share button on listings. Right after onboarding, prompt: "Know someone room-hunting in Guwahati? Share GHOR." Low-friction, high-conversion moment (immediately after they got value from signing up).

If you don't want to expand scope right now, skip both — the waitlist's existing scarcity mechanic and word-of-mouth from a genuinely good first experience can carry launch without them. Flagging as the highest-leverage *cheap* addition, not a requirement.

---

## 4. Budget allocation (small, targeted spend)

Given some budget but not a large one, in priority order:

1. **1–2 local micro-influencers/content creators** (Guwahati-based, student or young-professional audience, a few thousand to low tens-of-thousands of followers — not big names) to post the "no ₹400 viewing fee, no ₹3,500 brokerage" story as a reel. This is the single highest-leverage spend — local trust matters more than reach here.
2. **Boosted posts in the exact Facebook/community groups being disrupted** — the irony of the ad appearing inside the group it's replacing is itself part of the pitch.
3. **Printed flyers/posters at PG buildings and college notice boards** near the outreach targets from §2 — cheap, hyper-local, and doubles as supply-side outreach collateral.
4. Keep money out of broad Instagram/Google ads at this stage — Guwahati-specific targeting on generic platforms burns budget fast for a hyper-local product; the above three are more efficient per rupee.

---

## 5. PR & content angle

The core story writes itself: **"Local founder builds free alternative to Guwahati's ₹400-viewing-fee brokers."** This is a real local-news hook, not manufactured — pitch it as such, not as generic startup-launch PR.

- **Target list:** Guwahati-focused local news sites/blogs, Assam startup/tech community pages, NE India-focused Instagram/YouTube local-news accounts. (Don't guess specific outlet names here without verifying they're current and still active — worth a short research pass closer to launch.)
- **Content to prepare in advance:** one clear before/after graphic (₹3,900 broker cost vs. ₹0 on GHOR), a 30–60 second reel of the actual app flow (search → chat with owner), and a founder quote about *why* — the personal "I watched someone get charged ₹400 to see a room" story is the actual hook, more than the product screenshots.
- **Timing:** brief press contacts ~1 week before public launch under a loose embargo so coverage lands launch week, not scattered before or after.

---

## 6. Campus ambassador angle (low-cost, high-fit)

Students are simultaneously the easiest seekers to reach and free distribution. A lightweight (not formal-program-heavy) version:
- 3–5 students at the colleges named in §2, each given early access + a referral code, asked only to post about it once in their own hostel/department group chats around launch week.
- No cash incentive needed at this scale — "used it before anyone else" + the referral visibility from §3 is enough motivation for a handful of students.

---

## 7. Launch day playbook (sequence)

1. **T–7 days:** press embargo briefing sent (§5); ambassadors (§6) given early access.
2. **T–3 days:** confirm 60–100 listings are live and approved (§2) — do a final pass for photo quality and moderation consistency, since this is what every first-time visitor judges the product on.
3. **T–1 day:** waitlist gets the "we're live tomorrow" email/notification — this is the audience that already opted in, they go first.
4. **Launch day:** app goes live on Play Store → waitlist notified with the install link → press embargo lifts → ambassador posts go out → founder's own social posts.
5. **T+1 to T+7:** monitor the funnel (§8) daily, not weekly — early signal here is more valuable than at any later point, and it's the window where a stuck signup flow or a moderation bottleneck does the most damage if unnoticed.

---

## 8. What to actually watch (launch-week success criteria)

Uses the `events` funnel already in scope (root `CLAUDE.md` §14.13): `signup` → `listing_view` → `contact_tap` → `chat_started`.

- **Listings live at launch:** 60–100 (from §2) — the leading indicator that determines whether the rest of this plan can even work.
- **Day-1 installs and Day-7 retention** — retention matters more than raw installs for a product where the whole point is repeated use until someone finds a room.
- **`contact_tap` rate** (visitors who tap Chat/Call) — this is *the* core metric per root `CLAUDE.md` §7.8, and the one most sensitive to the interstitial ad frequency. Watch it daily in launch week specifically to catch an over-aggressive ad frequency before it quietly kills the funnel.
- **Owner response rate/time** — a fast owner reply in week one becomes word-of-mouth ("I messaged and got a reply in 10 minutes"); a slow one becomes the opposite. Worth manually nudging slow-to-respond owners via chat during launch week specifically (root `CLAUDE.md` §7.7 already flags this risk).

---

## Open decisions this plan surfaces (need your call, not silently assumed)

1. **Referral code feature (§3)** — build it or skip it for launch v1?
2. **December 2026 vs. January 2027 launch target** — confirm once the auth module (both surfaces) is actually underway and its real effort is known; the current December–January window is still a planning estimate, not a committed date.
3. **Press outlet list (§5)** — needs a real, verified list closer to launch date, not guessed now.
