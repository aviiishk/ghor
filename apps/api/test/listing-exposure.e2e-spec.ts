import {
  bearer,
  createHarness,
  createListing,
  createProfile,
  IMG,
  loginNewAdmin,
  resetDatabase,
  userToken,
  type Harness,
} from './helpers/harness';

// Pre-merge fix: marketplace listing responses use explicit field shapes
// (src/listings/listing-shapes.ts), so moderation metadata never reaches renters/owners.
const FORBIDDEN = [
  'approvedById',
  'claimedById',
  'claimedAt',
  'claimExpiresAt',
  'heldById',
  'heldAt',
  'holdReason',
  'pausedById',
  'pausedAt',
  'pauseReason',
  'autoApproveAt',
  'version',
  'submittedAt',
  'approvedAt',
  'deletedAt',
];

function keysDeep(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysDeep(v, out);
    }
  }
  return out;
}

function expectNoModerationData(body: unknown, secrets: string[]) {
  const keys = keysDeep(body);
  for (const f of FORBIDDEN) expect({ field: f, present: keys.has(f) }).toEqual({ field: f, present: false });
  const text = JSON.stringify(body);
  for (const s of secrets) expect(text).not.toContain(s);
}

describe('listing responses never expose moderation metadata', () => {
  let h: Harness;
  let admin: Awaited<ReturnType<typeof loginNewAdmin>>;
  let ownerId: string;
  let ownerToken: string;
  let renterToken: string;
  let listingId: string;
  const HOLD_REASON = 'internal-hold-reason-do-not-leak';
  const PAUSE_REASON = 'internal-pause-reason-do-not-leak';

  beforeAll(async () => {
    h = await createHarness();
    await resetDatabase(h.prisma);
    admin = await loginNewAdmin(h, 'admin');
    const owner = await createProfile(h.prisma, { role: 'owner' });
    const renter = await createProfile(h.prisma, { role: 'seeker' });
    ownerId = owner.id;
    ownerToken = userToken(h.app, owner);
    renterToken = userToken(h.app, renter);

    // A live listing whose row carries every kind of internal moderation metadata
    // (approved by a named reviewer, a released hold's reason, an old pause reason, a
    // stale claim, an escalated post-review).
    const now = new Date();
    for (let i = 0; i < 2; i++) {
      const l = await createListing(h.prisma, owner.id, { status: 'approved' });
      await h.prisma.listing.update({
        where: { id: l.id },
        data: {
          approvalSource: 'automatic_5min',
          approvedAt: now,
          approvedById: admin.profileId,
          postReviewStatus: 'escalated',
          holdReason: HOLD_REASON,
          heldById: admin.profileId,
          pauseReason: PAUSE_REASON,
          pausedById: admin.profileId,
          claimedById: admin.profileId,
          claimedAt: now,
          claimExpiresAt: now,
          autoApproveAt: now,
          version: 7,
        },
      });
      if (i === 0) listingId = l.id;
    }
  });
  afterAll(() => h.close());

  const secrets = () => [admin.profileId, HOLD_REASON, PAUSE_REASON];

  it('browse feed (public shape)', async () => {
    const res = await h.http().get('/listings').set(bearer(renterToken)).expect(200);
    expect(res.body.items.length).toBe(2);
    expectNoModerationData(res.body, secrets());
    // Label inputs survive, but internal review state is reduced to confirmed-or-null.
    expect(res.body.items[0].approvalSource).toBe('automatic_5min');
    expect(res.body.items[0].postReviewStatus).toBeNull();
  });

  it('listing detail for a renter (renter shape, owner phone for Call only)', async () => {
    const res = await h.http().get(`/listings/${listingId}`).set(bearer(renterToken)).expect(200);
    expectNoModerationData(res.body, secrets());
    expect(res.body.owner.phone).toBeTruthy();
    expect(res.body.title).toBe('Bright room near campus');
  });

  it('similar listings and the owner profile grid (public shape)', async () => {
    const similar = await h.http().get(`/listings/${listingId}/similar`).set(bearer(renterToken)).expect(200);
    expect(similar.body.length).toBe(1);
    expectNoModerationData(similar.body, secrets());
    const owner = await h.http().get(`/owners/${ownerId}`).set(bearer(renterToken)).expect(200);
    expect(owner.body.listings.length).toBe(2);
    expectNoModerationData(owner.body, secrets());
  });

  it('owner views of their own listings (owner shape) expose no internal fields either', async () => {
    const mine = await h.http().get('/listings/mine').set(bearer(ownerToken)).expect(200);
    expect(mine.body.length).toBe(2);
    expectNoModerationData(mine.body, secrets());
    expect(mine.body[0].status).toBe('approved');

    const own = await h.http().get(`/listings/${listingId}`).set(bearer(ownerToken)).expect(200);
    expectNoModerationData(own.body, secrets());
    expect(own.body.owner.phone).toBeUndefined();

    const updated = await h
      .http()
      .patch(`/listings/${listingId}`)
      .set(bearer(ownerToken))
      .send({ status: 'rented' })
      .expect(200);
    expect(updated.body.status).toBe('rented');
    expectNoModerationData(updated.body, secrets());

    const created = await h
      .http()
      .post('/listings')
      .set(bearer(ownerToken))
      .send({ title: 'New draft', propertyType: 'room', rent: 5000, locality: 'Beltola', images: [{ cloudinaryUrl: IMG(9), position: 0 }] })
      .expect(201);
    expect(created.body.status).toBe('draft');
    expectNoModerationData(created.body, []);
  });

  it('a confirmed post-review is passed through (the client shows "Approved by GHOR")', async () => {
    await h.prisma.listing.update({ where: { id: listingId }, data: { status: 'approved', postReviewStatus: 'confirmed' } });
    const res = await h.http().get(`/listings/${listingId}`).set(bearer(renterToken)).expect(200);
    expect(res.body.postReviewStatus).toBe('confirmed');
  });

  it('admin endpoints still receive the moderation data they need', async () => {
    const res = await h.http().get(`/admin/listings/${listingId}`).set(bearer(admin.accessToken)).expect(200);
    expect(res.body.approvedById).toBe(admin.profileId);
    expect(res.body.version).toBeGreaterThanOrEqual(7);
    expect(res.body.holdReason).toBe(HOLD_REASON);
  });
});
