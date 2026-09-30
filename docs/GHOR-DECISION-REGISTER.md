# GHOR — Founder Decision Register

| | |
|---|---|
| **Purpose** | The record of **settled** founder decisions. These are not reopened by product, design or engineering work. |
| **Specified in** | [`GHOR-MASTER-PRODUCT-BLUEPRINT.md`](GHOR-MASTER-PRODUCT-BLUEPRINT.md) (**MPB**) |
| **Unresolved questions** | MPB §52 (Q-01 to Q-23). Those are **not** decisions until they're moved into this register. |
| **Date recorded** | 2026-09-29 |
| **Change rule** | A decision changes only by an explicit founder instruction. Add the new decision with a new number and mark the old one "Superseded by D-xx". Never edit a decision in place. |

**Where these decisions conflict with earlier documents** (`CLAUDE.md`, the PRD, CPS, V2, P01), **this register wins.** The conflicts are listed in MPB §53.

---

## Product identity

| # | Decision | Final answer | Rationale | Product implications | Technical implications |
|---|---|---|---|---|---|
| D-01 | Who GHOR is for | **A rental-home platform for everyone.** Students and newcomers are served by features, not by the brand definition | Everyone faces the same trust and freshness problems; a student-only identity limits the market | Brand copy never says "for students"; all categories and segments are supported | Taxonomy and search support every category (MPB §6) |
| D-02 | Core promise | **"Find your next home faster, with more confidence."** | Captures speed + trust | Every feature must improve discovery, trust, freshness, transparency, media, human connection, local intelligence or speed | Performance and trust requirements become acceptance criteria |
| D-03 | Property model | **Categories: Room · PG / Co-living · Shared Room · Flat · House · Other legitimate types.** "1BHK" is **not** a category. Size, arrangement, furnishing, occupancy, suitability, costs, amenities, rules, availability, location, media, verification and freshness are attributes | Avoids overlapping filters and duplicate SEO pages | The wizard asks the category first; generated labels | The `category` enum replaces `property_type`; many new attributes (MPB §42) |
| D-04 | Positioning | Differentiate through the **combination** of trustworthy owners, genuine media, fresh availability, local discovery, fast search, transparent verification, direct communication, strong UX and performance, **not** as another generic portal | A single feature is copyable; the combination isn't | UI emphasises trust, freshness and media | none |

## GHOR Verified and plans

| # | Decision | Final answer | Rationale | Product implications | Technical implications |
|---|---|---|---|---|---|
| D-05 | GHOR Verified | **A paid subscription program** giving **trust, visibility and speed**. The badge never means "100% safe" or "fraud-proof" | A sustainable revenue model tied to real verification | Precise badge copy + disclaimer; the current "Verified" chip must be renamed | New verification, entitlement and badge systems |
| D-06 | Verification scope | GHOR Verified verifies, where applicable: government identity, phone, email, ownership or authorisation, property details, address/property consistency, utility or property documents, photos, genuine walkthrough video, basic fraud checks, basic safety checks, contact information | A real, full check, not phone-only | Evidence-collection flow; reviewer checklists | Verification cases + evidence metadata + purge jobs |
| D-07 | Payment vs trust | Payment buys **access to the program**, **not permanent trust**. GHOR can suspend or revoke the badge independently. **Billing and verification enforcement are separate systems** | Prevents "pay for trust" | Badge shown only if verified AND entitled AND not restricted | Separate state machines (subscription, badge) |
| D-08 | Owner profile completion | An owner **cannot publish** a listing below **100%** profile completion (name, verified phone, **verified email**, profile information, required identity/verification information, contact info, other mandatory fields). Show a completion indicator; the exact list is defined in the implementation spec | Accountability; enforceability | Completion meter + gate at submit | Email verification (not implemented today); a completion calculator |
| D-09 | Launch promotion | **The first 50 eligible owner profiles get the GHOR Verified program free for the first 5 months.** A promotion, not permanent pricing | Seeds trusted supply | Promo entitlement; reminders before the end | A promotions counter + entitlements without payments |
| D-10 | Plans and quotas | **Free:** complete profile, can list, **max 3 listings/month**, **no badge**. **₹299/month GHOR Verified:** badge, **5/month**, increased visibility, faster approval, verified-owner presentation. **₹599/month GHOR Verified Pro:** badge, **12/month**, stronger visibility, priority support, enhanced profile, priority placement, listing analytics, faster moderation/support | Simple tiered monetisation on the supply side | Quota UI; plan page | Quota counter per period; entitlements; (P2) billing |
| D-11 | Multi-property verification | Owner identity verification is **reusable**; property verification is **per property**; additional properties use a **streamlined** process; suspicious or high-risk properties escalate | A verified person doesn't prove ownership of every property | Per-property verification states on listings | Property-level verification cases |
| D-12 | Verification authority | **Only a designated senior reviewer** can grant GHOR Verified. They can approve, reject, suspend, revoke or request re-verification. **Regular admins cannot grant.** Every decision is auditable (reviewer, time, decision, reason, status, evidence metadata) | Consistency and accountability | Separate senior queue | A new `senior_reviewer` permission; audit log |
| D-13 | Document handling | Minimise sensitive data retention; don't store government ID documents forever; the spec defines what's checked, by whom, the metadata and evidence retained, retention/deletion, access controls and audit | Privacy (DPDP) | Consent + purpose notices | Private evidence storage, purge jobs, access logs |
| D-14 | Re-verification | **Risk-based.** Normal verification remains valid. Triggers: ownership change, important property change, major contact change, major media change, serious reports, suspicious activity, long inactivity, policy change | Avoids needless friction; catches real risk | Owner notices; badge suspension pending review | Trigger detection + cases |

## Listing media and approval

| # | Decision | Final answer | Rationale | Product implications | Technical implications |
|---|---|---|---|---|---|
| D-15 | Media requirement | Every listing requires **min 3 photos + 1 genuine walkthrough video; max 9 photos + 1 video.** **The owner provides the media; GHOR offers no photo or video service at launch.** The video must be genuine, recent, representative, relevant and clearly show the property. No stock, unrelated, fake, misleading or other-property footage | Authenticity is a differentiator | Guided capture; submit blocked until met | Video pipeline; limits set by the provider plan (MPB §18.2) |
| D-16 | Media UX | Listing detail uses a premium **bento** gallery, editorial presentation, Pinterest-inspired organisation, immersive viewer, video tile and excellent mobile presentation. **Search results stay structured and comparison-friendly.** No novelty at the cost of usability | Visual understanding before contact | Detail vs discovery separation | Gallery components; performance budgets |
| D-17 | Approval: non-verified owners | Submitted → pending review → admin approves or rejects; **if the admin does nothing for 5 minutes → automatically approved**, recorded as "**Automatically approved by GHOR**", visible in admin **and** to renters where appropriate | Speed for owners | Approval-source labels | A per-minute scheduler; `approval_source` |
| D-18 | Approval: verified owners | Submitted → **automatically approved immediately** (subject to normal system checks); shows "**Automatically approved by GHOR**"; **the admin is notified** and can review afterwards (confirm, request correction, reject, escalate trust, review verification) | Speed benefit of Verified | Post-review queue | A separate verified queue |
| D-19 | Queue separation | Separate admin notification and queue visibility for **free/non-verified** and **paid/verified-owner** listings. Automatic approval must never be presented as manual verification | Operational clarity; honesty | Distinct labels | Queue filters |
| D-20 | Rejection experience | **Never just "Rejected."** Send a structured report: what was wrong, why, which policy, what to fix, next steps, whether resubmission is allowed | Owner success; fewer repeat errors | A report template + reason catalogue | Reason codes; email + in-app |

## Trust and safety

| # | Decision | Final answer | Rationale | Product implications | Technical implications |
|---|---|---|---|---|---|
| D-21 | Reporting | Renters can report listings, using all previously agreed categories **plus "Other / Custom reason"**. High-risk reports (scam, property doesn't exist, fake documents, serious safety issue, major misrepresentation, fraud) can trigger immediate protective action (hide, investigate, notify the owner, preserve evidence, admin review). Lower-risk reports can stay visible while investigated. **Never publicly label someone a scammer from a single report** | Protect renters without false accusations | Report flow; tiers | Investigations; evidence snapshots |
| D-22 | Owner "under review" UX | Show exactly: "*Your listing is under review — GHOR is reviewing a concern reported about this listing. Your listing is temporarily hidden while we investigate. What happens next: Our team will review the information and may contact you if clarification is required.*" Don't reveal the reporter's identity, private reporter information or private evidence | Fairness + reporter safety | Fixed copy | Data-access rules |
| D-23 | Enforcement | **Graduated:** correction request, warning, temporary restriction, listing rejection, listing removal, badge suspension, account restriction, account suspension, account termination (serious or repeated). Serious fraud or safety issues can get stronger action immediately | Proportionality | An enforcement ladder | Enforcement actions + restrictions |
| D-24 | Appeals | Owners can appeal eligible enforcement decisions; outcomes: uphold, modify, restore listing, restore or suspend the badge as appropriate; every appeal is logged | Fairness | Appeal flow | Appeals table; audit |

## Freshness

| # | Decision | Final answer | Rationale | Product implications | Technical implications |
|---|---|---|---|---|---|
| D-25 | Freshness cycles | Owners periodically confirm availability. **Rooms / PG / shared: 14-day confirmation cycle.** **Flats / houses: a longer window** (exact interval defined in implementation; MPB proposes 30 days). Reminders; renters see "Confirmed 3 days ago" / "Last confirmed 18 days ago"; listings visibly age | Stale inventory destroys trust | Freshness labels; reminders | Daily job; `confirmed_at`; states |
| D-26 | Expiration | On expiry: remove from normal search; notify the owner; offer a renewal action; give a grace period; if not renewed → archive; notify relevant renters; the owner can restore by confirming (subject to required checks). **Never leave stale inventory silently active** | Accuracy | Paused → archived flow | Jobs; renter notifications |

## Discovery

| # | Decision | Final answer | Rationale | Product implications | Technical implications |
|---|---|---|---|---|---|
| D-27 | Student / newcomer features | Near college/university, workplace and transit; locality guides; nearby amenities; commute context; faster discovery. **Product features, not the brand definition** | Serves high-pain segments without narrowing the brand | Discovery entry points | Places + distances |
| D-28 | Local intelligence | Build a **curated Guwahati places database** (localities, alternate spellings, colleges, universities, hospitals, workplaces, transit, landmarks, markets). **No fake places.** It's a competitive asset | Search quality; a moat | Place pages; distance labels | `places`, aliases, distances |
| D-29 | Search capability | Search by property type, rent, size, locality, college/university, landmark, workplace, hospital, transit, amenities, furnishing, suitability, availability, etc.; support alternate spellings (Jalukbari/Jhalukbari, Zoo Tiniali/Zoo Road Tiniali, GU/Gauhati University) | Local reality | Suggestions; aliases | Dictionary + parser |
| D-30 | Query understanding | Structured natural-language queries ("1BHK near GU under ₹12,000") via **deterministic, rule-based** parsing. **No AI** just because it sounds impressive. Prioritise predictability, speed, explainability and low cost | Reliability and cost | Interpretation chips | Rule parser (browser + server) |
| D-31 | No-result experience | Never just "No results." Explain why; show nearby alternatives; relax filters intelligently; suggest nearby localities, different price ranges and compatible types. Saved-search alerts later | Retention; usefulness | A recovery UI | Relaxation counts; adjacency |
| D-32 | Ranking | Multi-factor (relevance, location, proximity, type, rent, freshness, confirmation, completeness, media quality, trust, owner response, legitimate engagement, paid visibility). **Payment never overrides explicit filters, safety rules, trust rules, basic relevance, location relevance or property-type requirements.** ₹599 is not "#1 everywhere"; paid visibility works within relevant surfaces | Trustworthy results + fair monetisation | Bounded boosts | Ranking with eligibility-first + caps |
| D-33 | Public discovery / SEO | **Public browsing, search and listing pages.** Authentication mainly for protected actions (contacting owners, etc.). Server-rendered indexable pages, sitemap, robots.txt, canonical URLs, structured data, locality and college pages where justified, metadata, Open Graph/Twitter. **Avoid thin pages** | Acquisition | Public site | Server rendering; SEO infrastructure |

## Contact and saved

| # | Decision | Final answer | Rationale | Product implications | Technical implications |
|---|---|---|---|---|---|
| D-34 | Contact modes | Owners choose **per listing: Chat only** or **Allow calls**. Chat stays available where enabled. **Phone numbers never public on cards.** If calls are enabled: the renter explicitly reveals, the reveal is logged, rate limits apply, anti-scraping protections apply | Owner control; anti-scraping | A per-listing setting; reveal flow | Reveal endpoint + logs + caps; remove the phone from detail responses |
| D-35 | Saved | **Launch:** saved listings + recently viewed. **Later:** saved searches + alerts (not before sufficient inventory) | Avoid empty alerts | `/saved` | `favorites` table |

## Auth, UX, performance and operations

| # | Decision | Final answer | Rationale | Product implications | Technical implications |
|---|---|---|---|---|---|
| D-36 | Authentication | Production auth gaps (no real SMS; production refuses OTP without a provider; the Google UI is non-functional) are addressed in **Phase 0**. **Don't leave broken Google login UI in production:** implement it properly or remove/hide it | Launch blocker | Remove the button until ready | SMS provider integration |
| D-37 | Business model limits | Initial monetisation = Free / ₹299 / ₹599 plans only. **No renter fees, booking fees, contact fees, forced payments or ads** unless separately approved later | Trust; the renter promise | No ad slots | No ad SDKs (`CLAUDE.md`'s mobile interstitial plan is superseded) |
| D-38 | Payments | **Don't implement payments yet** (none exist). Define the plans, promotion, quotas, lifecycle, cancellation, failed payments, renewal, grace, badge suspension independent of billing, upgrade/downgrade, quota reset and abuse prevention. **Don't invent a payment provider** | Sequencing; provider undecided | Phase 1 runs Free + promo | Phase 2 billing module |
| D-39 | UX / UI | Modern, trustworthy, premium, fast, simple, human, local, visual. Avoid OLX visual language, portal clutter, banners, ads, confusing filters and unnecessary animation. The landing page may use richer storytelling; marketplace pages prioritise speed, clarity, comparison, trust and media | Differentiation | The design system (MPB §27) | Performance budgets |
| D-40 | Launch discipline | Define minimum launch requirements (auth, hosting, database, media, verification, admin operations, moderation, legal, monitoring, backups, rate limits, performance, SEO, analytics, initial supply). **Do not launch with an empty marketplace.** Don't silently break existing listings; define a migration and adoption plan | Launch quality | A launch gate (MPB §36) | A migration plan (MPB §46) |
| D-41 | Admin queues | At minimum: free/non-verified submissions; paid/verified submissions; reports; verification reviews; badge actions; appeals; expiring/stale listings; high-risk cases; rejected awaiting correction; system notifications. Clearly distinguish manually approved, automatically approved, under review, rejected, restored and suspended | Operability | Admin IA | Queue endpoints |
| D-42 | Notifications | An architecture covering the owner, renter and admin events listed by the founder (MPB §25) | Reachability | Event catalogue | Email + in-app; SMS later |
| D-43 | Performance | **Performance is a product requirement** with concrete budgets | Mobile users on 4G | Budgets are acceptance criteria | CI performance gates |
| D-44 | Architecture restraint | No microservices, Redis, Elasticsearch, AI, recommendation engines or complex event architecture without demonstrated need. Prefer a simple architecture, strong database design, justified caching, server rendering, efficient queries, CDN and media optimisation, observability | Solo or small team | none | A single NestJS service + Postgres + CDN |
| D-45 | Security scope | Review auth, authorisation, admin roles, rate limits, OTP abuse, scraping, upload abuse, file validation, signed uploads, XSS, CSRF, SQL injection, IDOR, API authorisation, audit logging, payment/webhook security, sensitive data retention, secrets. No secrets in documentation | Trust platform | none | MPB §32 |

## Application architecture

| # | Decision | Final answer | Rationale | Product implications | Technical implications |
|---|---|---|---|---|---|
| D-46 | Admin Console as a separate application | GHOR has a **dedicated Admin Console, `apps/admin`**: the **fourth application surface**, next to `apps/web` (renter + owner web), `apps/mobile` (Expo renter + owner) and `apps/api` (the shared NestJS backend). It uses the **same `apps/api`**. **No second backend; no business logic duplicated in the admin frontend; no client accesses PostgreSQL directly.** TypeScript, React-based, desktop-first responsive, **separate deployment and separate authentication/session boundary**, role-aware UI, GHOR design tokens, no renter or owner UI. **Roles: `admin`, `senior_reviewer`, `super_admin`, with permissions enforced by `apps/api`** (never only hidden in the UI). **Every privileged action and every sensitive evidence view is audited.** The existing `apps/web` `/admin` is **legacy**: it isn't deleted until the migration (build `apps/admin` → reuse the API → move functionality → add the new queues and trust workflows → verify parity → switch operational use → then remove it) | Isolates the highest-privilege surface; supports information-dense operations; keeps the renter/owner web lean | A new IA (Overview, Moderation, Trust, Marketplace, Business, Communication, Analytics, System) and a review workspace (MPB §26) | A new workspace; admin-audience tokens; permission guards on all `/admin/*` routes; audit and evidence-access logs; a separate origin and deployment (MPB §26, roadmap P0-13, P0-16, P1-9…P1-9f, P2-12, P2-13, P3-8) |
| D-47 | Admin infrastructure & security | (1) Production admin domain **`admin.ghor.co.in`**; (2) staging **`admin-staging.ghor.co.in`**; (3) the admin is a completely separate application, **`apps/admin`**; (4) shared backend **`apps/api`**; (5) **no PostgreSQL access from the admin frontend**; (6) **no mandatory IP allowlist or VPN at launch**; (7) **authenticator-app TOTP required for all admin roles** (`admin`, `senior_reviewer`, `super_admin`); (8) **recovery codes issued during TOTP enrollment**; (9) **sensitive actions require re-authentication**; (10) **super_admin does NOT automatically receive GHOR Verified approval authority**; (11) GHOR Verified permissions belong to **`senior_reviewer`**; (12) super_admin can receive that permission **only if explicitly assigned the senior_reviewer capability**; (13) **all privileged actions are API-enforced and audited**; (14) **queue claiming does not stop the 5-minute auto-approval timer**; (15) **only an explicit decision or HOLD stops or suspends auto-approval**; (16) **"Claimed" is an assignment state, not a listing lifecycle status** | Strong authentication on the highest-privilege surface; separation of duties for trust decisions; predictable moderation timing | Moderators enroll an authenticator app before first access; the claim UI shows assignment only; the Hold action is the only way to pause auto-approval besides a decision | TOTP enrollment + recovery-code tables and endpoints; step-up guard; capability-based permission checks (senior_reviewer capability separate from the super_admin role); the claim table is separate from the listing status (MPB §26.3–26.6, ADM-16 to ADM-18; roadmap P0-16) |

---

## Decisions that are explicitly NOT settled

These are left open by the founder and tracked in MPB §52. (Admin Console questions Q-24 to Q-27 were resolved by D-47.)

- Promotion eligibility details.
- The quota counting definition.
- Payment provider, business entity and GST.
- Refund policy.
- Accepted document list.
- Evidence method.
- Auto-approval of risk-flagged items.
- The high-risk auto-hide threshold.
- The Cloudinary plan (and therefore the final video size limits).
- Places curation ownership.
- Paid-boost parameters and labelling.
- WhatsApp.
- The desktop video preview.
- Retention periods.
- Mobile app distribution during Phases 0–1.
- The flat/house freshness interval and grace periods.
- Moderation hours.
- Tenant-fit wording (legal review).
