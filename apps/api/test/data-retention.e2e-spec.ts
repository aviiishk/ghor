import { AutoApprovalJob } from '../src/jobs/auto-approval.job';
import {
  bearer,
  createHarness,
  createListing,
  createProfile,
  loginNewAdmin,
  resetDatabase,
  userToken,
  type AdminSession,
  type Harness,
} from './helpers/harness';

// P0-10 data retention, the F-04 fail-safe, and the Phase 0 admin read additions.
describe('data retention + Phase 0 completion', () => {
  let h: Harness;
  let admin: AdminSession;
  beforeAll(async () => {
    h = await createHarness();
    await resetDatabase(h.prisma);
    admin = await loginNewAdmin(h, 'admin');
  });
  afterAll(() => h.close());

  async function chatAndReport(listingId: string) {
    const seeker = await createProfile(h.prisma, { role: 'seeker' });
    const t = userToken(h.app, seeker);
    const conv = await h.http().post('/conversations').set(bearer(t)).send({ listingId }).expect(201);
    await h.http().post(`/conversations/${conv.body.id}/messages`).set(bearer(t)).send({ body: 'Still available?' }).expect(201);
    await h.http().post(`/listings/${listingId}/reviews`).set(bearer(t)).send({ rating: 4 }).expect(201);
    await h.http().post('/reports').set(bearer(t)).send({ listingId, reason: 'wrong price', reasonCategory: 'other' }).expect(201);
    return { seeker, token: t, conversationId: conv.body.id as string };
  }

  describe('account deletion anonymises (never destroys other people’s data)', () => {
    it('keeps chats, messages, reviews, reports and audit; blocks sign-in; frees the phone', async () => {
      const owner = await createProfile(h.prisma, { role: 'owner', fullName: 'Rina Das' });
      const listing = await createListing(h.prisma, owner.id, { status: 'approved' });
      const { token: seekerToken, conversationId } = await chatAndReport(listing.id);
      const ownerToken = userToken(h.app, owner);

      await h.http().delete('/auth/me').set(bearer(ownerToken)).expect(200);

      const p = await h.prisma.profile.findUniqueOrThrow({ where: { id: owner.id } });
      expect(p.deletedAt).not.toBeNull();
      expect(p.phone).toBeNull();
      expect(p.fullName).toBe('Deleted user');
      // Existing tokens stop working immediately.
      await h.http().get('/auth/me').set(bearer(ownerToken)).expect(401);
      // The other party still has the whole conversation.
      const msgs = await h.http().get(`/conversations/${conversationId}/messages`).set(bearer(seekerToken)).expect(200);
      expect(JSON.stringify(msgs.body)).toContain('Still available?');
      // Trust & safety records survive.
      expect(await h.prisma.report.count({ where: { listingId: listing.id } })).toBe(1);
      expect(await h.prisma.review.count({ where: { listingId: listing.id } })).toBe(1);
      expect(await h.prisma.auditLog.count({ where: { action: 'account.deleted', targetId: owner.id } })).toBe(1);
      // The listing is archived, not deleted, and gone from every public surface.
      const l = await h.prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
      expect(l.deletedAt).not.toBeNull();
      await h.http().get(`/listings/${listing.id}`).set(bearer(seekerToken)).expect(404);
      // Admins can still open it (evidence).
      await h.http().get(`/admin/listings/${listing.id}`).set(bearer(admin.accessToken)).expect(200);
      // Signing up again with the same phone creates a fresh, unrelated profile.
      const again = await h.prisma.profile.create({ data: { phone: owner.phone } });
      expect(again.id).not.toBe(owner.id);
    });
  });

  describe('listing deletion archives', () => {
    it('hides it everywhere but keeps conversations, snapshots and audit', async () => {
      const owner = await createProfile(h.prisma);
      const listing = await createListing(h.prisma, owner.id, { status: 'approved' });
      const seeker = await createProfile(h.prisma, { role: 'seeker' });
      const st = userToken(h.app, seeker);
      const conv = await h.http().post('/conversations').set(bearer(st)).send({ listingId: listing.id }).expect(201);
      await h.http().post(`/conversations/${conv.body.id}/messages`).set(bearer(st)).send({ body: 'Hi' }).expect(201);
      const ot = userToken(h.app, owner);

      await h.http().delete(`/listings/${listing.id}`).set(bearer(ot)).expect(204);

      const row = await h.prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
      expect(row.deletedAt).not.toBeNull();
      expect(row.version).toBe(2);
      const mine = await h.http().get('/listings/mine').set(bearer(ot)).expect(200);
      expect(mine.body.map((l: { id: string }) => l.id)).not.toContain(listing.id);
      const feed = await h.http().get('/listings').set(bearer(st)).expect(200);
      expect(feed.body.items.map((l: { id: string }) => l.id)).not.toContain(listing.id);
      await h.http().get(`/listings/${listing.id}`).set(bearer(st)).expect(404);
      await h.http().post('/reports').set(bearer(st)).send({ listingId: listing.id, reason: 'x', reasonCategory: 'other' }).expect(404);
      // The seeker's existing thread survives (it used to be cascaded away).
      await h.http().get(`/conversations/${conv.body.id}/messages`).set(bearer(st)).expect(200);
      expect(await h.prisma.listingSnapshot.count({ where: { listingId: listing.id } })).toBeGreaterThan(0);
      expect(await h.prisma.auditLog.count({ where: { action: 'listing.deleted_by_owner', targetId: listing.id } })).toBe(1);
      // Already archived → 404, and moderation can't act on it.
      await h.http().delete(`/listings/${listing.id}`).set(bearer(ot)).expect(404);
      await h.http().post(`/admin/listings/${listing.id}/pause`).set(bearer(admin.accessToken))
        .send({ expectedVersion: 2, reason: 'x-test' }).expect(409);
    });
  });

  describe('auto-approval F-04 fail-safe (unresolved decision)', () => {
    it('with the policy unresolved (null), an old backlog is HELD, never bulk-approved; fresh items still approve', async () => {
      const owner = await createProfile(h.prisma);
      const backlog = await Promise.all(
        [3, 5, 24].map((hours) =>
          createListing(h.prisma, owner.id, { status: 'pending', autoApproveAt: new Date(h.clock.now().getTime() - hours * 3600_000) }),
        ),
      );
      const fresh = await createListing(h.prisma, owner.id, { status: 'pending', autoApproveAt: new Date(h.clock.now().getTime() - 5_000) });
      await h.prisma.appConfig.upsert({
        where: { key: 'auto_approval_enabled' },
        create: { key: 'auto_approval_enabled', value: true },
        update: { value: true },
      });
      await h.app.get(AutoApprovalJob).tick();
      await h.prisma.appConfig.delete({ where: { key: 'auto_approval_enabled' } });
      for (const b of backlog) {
        const row = await h.prisma.listing.findUniqueOrThrow({ where: { id: b.id } });
        expect(row.status).toBe('pending');
        expect(row.holdReason).toBe('overdue_f04_unresolved');
      }
      expect((await h.prisma.listing.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe('approved');
    });

    it('the job is OFF by default', async () => {
      const res = await h.app.get(AutoApprovalJob).tick();
      expect(res.details).toEqual({ disabled: true });
    });
  });

  describe('admin read additions', () => {
    it('review context exposes real data and marks missing data as Phase 1', async () => {
      const owner = await createProfile(h.prisma);
      const a = await createListing(h.prisma, owner.id, { status: 'pending' });
      const other = await createProfile(h.prisma);
      await createListing(h.prisma, other.id, { status: 'approved' }); // reuses the same test photo URLs
      const res = await h.http().get(`/admin/listings/${a.id}`).set(bearer(admin.accessToken)).expect(200);
      const c = res.body.context;
      expect(c.media.photoCount).toBe(3);
      expect(c.media.exactDuplicates.length).toBeGreaterThan(0);
      expect(c.media.visualSimilarity.available).toBe(false);
      expect(c.risk.automatedFlags.available).toBe(false);
      expect(typeof c.risk.ownerAccountAgeDays).toBe('number');
      expect(c.ownerPlan).toMatchObject({ plan: 'free', ghorVerified: false });
      expect(c.responseBehaviour).toHaveProperty('inquiries');
    });

    it('trends and dashboard use real data; the verified-owner track is reported unavailable', async () => {
      const trends = await h.http().get('/admin/analytics/trends?days=14').set(bearer(admin.accessToken)).expect(200);
      expect(trends.body.series).toHaveLength(14);
      const total = trends.body.series.reduce((n: number, d: { autoApproved: number }) => n + d.autoApproved, 0);
      expect(total).toBeGreaterThan(0); // the fail-safe test above auto-approved one listing today
      const dash = await h.http().get('/admin/dashboard').set(bearer(admin.accessToken)).expect(200);
      expect(dash.body.ownerTracks.verifiedOwner.available).toBe(false);
      expect(dash.body.highRisk.heldByReason.overdue_f04_unresolved).toBe(3);
      expect(Array.isArray(dash.body.recentModeration)).toBe(true);
    });
  });
});
