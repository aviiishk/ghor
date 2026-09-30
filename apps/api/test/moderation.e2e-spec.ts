import { AutoApprovalJob } from '../src/jobs/auto-approval.job';
import { OutboxWorker } from '../src/jobs/outbox.worker';
import {
  bearer,
  createHarness,
  createListing,
  createProfile,
  loginNewAdmin,
  resetDatabase,
  stepUp,
  userToken,
  type AdminSession,
  type Harness,
} from './helpers/harness';

describe('moderation', () => {
  let h: Harness;
  let a: AdminSession;
  let b: AdminSession;
  beforeAll(async () => {
    h = await createHarness();
    await resetDatabase(h.prisma);
    a = await loginNewAdmin(h, 'admin');
    b = await loginNewAdmin(h, 'admin');
  });
  afterAll(() => h.close());

  const newPending = async (opts: Parameters<typeof createListing>[2] = {}) => {
    const owner = await createProfile(h.prisma);
    return createListing(h.prisma, owner.id, { status: 'pending', ...opts });
  };

  describe('optimistic concurrency', () => {
    it('version 17: A approves → 18; B rejecting with 17 gets 409 and nothing is overwritten', async () => {
      const l = await newPending();
      await h.prisma.listing.update({
        where: { id: l.id },
        data: { version: 17 },
      });

      await h
        .http()
        .post(`/admin/listings/${l.id}/decision`)
        .set(bearer(a.accessToken))
        .send({ expectedVersion: 17, decision: 'approve' })
        .expect(200)
        .expect((r) => expect(r.body.version).toBe(18));

      const conflict = await h
        .http()
        .post(`/admin/listings/${l.id}/decision`)
        .set(bearer(b.accessToken))
        .send({
          expectedVersion: 17,
          decision: 'reject',
          reasonCodes: ['fake_photos'],
        })
        .expect(409);
      expect(conflict.body.code).toBe('LISTING_VERSION_CONFLICT');
      expect(conflict.body.currentVersion).toBe(18);

      const after = await h.prisma.listing.findUniqueOrThrow({
        where: { id: l.id },
      });
      expect(after.status).toBe('approved');
      expect(after.version).toBe(18);
      expect(after.approvalSource).toBe('manual');
      expect(
        await h.prisma.moderationDecision.count({ where: { listingId: l.id } }),
      ).toBe(1);
    });

    it('two simultaneous decisions on the same version: exactly one wins', async () => {
      const l = await newPending();
      const [r1, r2] = await Promise.all([
        h
          .http()
          .post(`/admin/listings/${l.id}/decision`)
          .set(bearer(a.accessToken))
          .send({ expectedVersion: 1, decision: 'approve' }),
        h
          .http()
          .post(`/admin/listings/${l.id}/decision`)
          .set(bearer(b.accessToken))
          .send({
            expectedVersion: 1,
            decision: 'reject',
            reasonCodes: ['spam'],
          }),
      ]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
      expect(
        await h.prisma.moderationDecision.count({ where: { listingId: l.id } }),
      ).toBe(1);
    });

    it('an owner edit during review bumps the version, so a decision on the stale content is refused', async () => {
      const owner = await createProfile(h.prisma);
      const l = await createListing(h.prisma, owner.id, { status: 'pending' });
      await h
        .http()
        .patch(`/listings/${l.id}`)
        .set(bearer(userToken(h.app, owner)))
        .send({ title: 'Totally different listing' })
        .expect(200);
      await h
        .http()
        .post(`/admin/listings/${l.id}/decision`)
        .set(bearer(a.accessToken))
        .send({ expectedVersion: 1, decision: 'approve' })
        .expect(409);
    });
  });

  describe('decisions', () => {
    it('writes decision + snapshot + audit + owner outbox message together', async () => {
      const l = await newPending();
      await h
        .http()
        .post(`/admin/listings/${l.id}/decision`)
        .set(bearer(a.accessToken))
        .send({
          expectedVersion: 1,
          decision: 'request_changes',
          reasonCodes: ['missing_room_photo'],
          ownerMessage: 'Add a photo of the room itself',
        })
        .expect(200);
      expect(
        await h.prisma.moderationDecision.count({
          where: { listingId: l.id, decision: 'request_changes' },
        }),
      ).toBe(1);
      expect(
        await h.prisma.listingSnapshot.count({
          where: { listingId: l.id, version: 2 },
        }),
      ).toBe(1);
      const audit = await h.prisma.auditLog.findFirstOrThrow({
        where: { targetId: l.id, action: 'listing.changes_requested' },
      });
      expect(audit.actorId).toBe(a.profileId);
      expect(audit.reason).toBe('missing_room_photo');
      const msg = await h.prisma.outboxEvent.findFirstOrThrow({
        where: { dedupeKey: `listing:${l.id}:v2:changes_requested` },
      });
      expect((msg.payload as { userId: string }).userId).toBe(l.ownerId);
    });

    it('audit write failure rolls back the decision (same transaction)', async () => {
      const l = await newPending();
      // Make every audit insert fail for the duration of this test.
      await h.prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION test_block_audit() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'audit unavailable'; END; $$ LANGUAGE plpgsql`);
      await h.prisma.$executeRawUnsafe(
        'CREATE TRIGGER test_block_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION test_block_audit()',
      );
      try {
        await h
          .http()
          .post(`/admin/listings/${l.id}/decision`)
          .set(bearer(a.accessToken))
          .send({ expectedVersion: 1, decision: 'approve' })
          .expect(500);
      } finally {
        await h.prisma.$executeRawUnsafe(
          'DROP TRIGGER test_block_audit ON audit_log',
        );
        await h.prisma.$executeRawUnsafe('DROP FUNCTION test_block_audit()');
      }
      const after = await h.prisma.listing.findUniqueOrThrow({
        where: { id: l.id },
      });
      expect(after.status).toBe('pending');
      expect(after.version).toBe(1);
      expect(
        await h.prisma.moderationDecision.count({ where: { listingId: l.id } }),
      ).toBe(0);
      expect(
        await h.prisma.outboxEvent.count({
          where: { dedupeKey: { startsWith: `listing:${l.id}` } },
        }),
      ).toBe(0);
    });

    it('cannot approve a listing with fewer than 3 photos, a draft, or a rented listing', async () => {
      const few = await newPending({ photos: 2 });
      const r = await h
        .http()
        .post(`/admin/listings/${few.id}/decision`)
        .set(bearer(a.accessToken))
        .send({ expectedVersion: 1, decision: 'approve' })
        .expect(422);
      expect(r.body.code).toBe('PUBLISH_REQUIREMENTS_NOT_MET');
      for (const status of ['draft', 'rented', 'rejected'] as const) {
        const l = await newPending({ status });
        const res = await h
          .http()
          .post(`/admin/listings/${l.id}/decision`)
          .set(bearer(a.accessToken))
          .send({ expectedVersion: 1, decision: 'approve' })
          .expect(409);
        expect(res.body.code).toBe('INVALID_STATE');
      }
    });

    it('reject requires a reason code; unexpected fields are refused', async () => {
      const l = await newPending();
      await h
        .http()
        .post(`/admin/listings/${l.id}/decision`)
        .set(bearer(a.accessToken))
        .send({ expectedVersion: 1, decision: 'reject' })
        .expect(400);
      await h
        .http()
        .post(`/admin/listings/${l.id}/decision`)
        .set(bearer(a.accessToken))
        .send({ expectedVersion: 1, decision: 'approve', status: 'approved' })
        .expect(400);
    });

    it('the outbox worker delivers the owner notification exactly once', async () => {
      const l = await newPending();
      await h
        .http()
        .post(`/admin/listings/${l.id}/decision`)
        .set(bearer(a.accessToken))
        .send({ expectedVersion: 1, decision: 'approve' })
        .expect(200);
      const worker = h.app.get(OutboxWorker);
      await worker.tick();
      await worker.tick();
      const notes = await h.prisma.notification.findMany({
        where: { userId: l.ownerId },
      });
      expect(notes).toHaveLength(1);
      expect(notes[0].type).toBe('listing_approved');
    });
  });

  describe('claims (assignment metadata, D-47)', () => {
    it('claiming does not change status, version or the auto-approval time; others get 409', async () => {
      const due = new Date(h.clock.now().getTime() + 5 * 60_000);
      const l = await newPending({ autoApproveAt: due });
      const res = await h
        .http()
        .post(`/admin/listings/${l.id}/claim`)
        .set(bearer(a.accessToken))
        .expect(200);
      expect(res.body.claimedById).toBe(a.profileId);
      const after = await h.prisma.listing.findUniqueOrThrow({
        where: { id: l.id },
      });
      expect(after.status).toBe('pending');
      expect(after.version).toBe(1);
      expect(after.autoApproveAt?.toISOString()).toBe(due.toISOString());
      const other = await h
        .http()
        .post(`/admin/listings/${l.id}/claim`)
        .set(bearer(b.accessToken))
        .expect(409);
      expect(other.body.code).toBe('CLAIMED_BY_OTHER');
      // B cannot release A's claim.
      await h
        .http()
        .delete(`/admin/listings/${l.id}/claim`)
        .set(bearer(b.accessToken))
        .expect(403);
    });

    it('a claimed item is STILL auto-approved when its timer expires', async () => {
      const l = await newPending({
        autoApproveAt: new Date(h.clock.now().getTime() - 1000),
      });
      await h
        .http()
        .post(`/admin/listings/${l.id}/claim`)
        .set(bearer(a.accessToken))
        .expect(200);
      await enableAutoApproval(h);
      await h.app.get(AutoApprovalJob).tick();
      const after = await h.prisma.listing.findUniqueOrThrow({
        where: { id: l.id },
      });
      expect(after.status).toBe('approved');
      expect(after.approvalSource).toBe('automatic_5min');
      await disableAutoApproval(h);
    });
  });

  describe('hold, pause, restore, post-review', () => {
    it('hold stops auto-approval; releasing restarts the window', async () => {
      const l = await newPending({
        autoApproveAt: new Date(h.clock.now().getTime() - 1000),
      });
      await h
        .http()
        .post(`/admin/listings/${l.id}/hold`)
        .set(bearer(a.accessToken))
        .send({
          expectedVersion: 1,
          reason: 'owner phone reused by banned account',
        })
        .expect(200);
      await enableAutoApproval(h);
      await h.app.get(AutoApprovalJob).tick();
      expect(
        (await h.prisma.listing.findUniqueOrThrow({ where: { id: l.id } }))
          .status,
      ).toBe('pending');

      await h
        .http()
        .delete(`/admin/listings/${l.id}/hold`)
        .set(bearer(a.accessToken))
        .send({ expectedVersion: 2, reason: 'checked, fine' })
        .expect(200);
      const released = await h.prisma.listing.findUniqueOrThrow({
        where: { id: l.id },
      });
      expect(released.heldAt).toBeNull();
      expect(released.autoApproveAt!.getTime()).toBeGreaterThan(
        h.clock.now().getTime(),
      );
      await disableAutoApproval(h);
    });

    it('pause hides a live listing from browse and detail; restore brings it back', async () => {
      const owner = await createProfile(h.prisma);
      const seeker = await createProfile(h.prisma, { role: 'seeker' });
      const l = await createListing(h.prisma, owner.id, { status: 'approved' });
      const seekerToken = userToken(h.app, seeker);
      await h
        .http()
        .get(`/listings/${l.id}`)
        .set(bearer(seekerToken))
        .expect(200);

      await h
        .http()
        .post(`/admin/listings/${l.id}/pause`)
        .set(bearer(a.accessToken))
        .send({ expectedVersion: 1, reason: 'suspected scam, investigating' })
        .expect(200);
      await h
        .http()
        .get(`/listings/${l.id}`)
        .set(bearer(seekerToken))
        .expect(404);
      const feed = await h
        .http()
        .get('/listings')
        .set(bearer(seekerToken))
        .expect(200);
      expect(feed.body.items.map((i: { id: string }) => i.id)).not.toContain(
        l.id,
      );
      expect(
        (await h.prisma.listing.findUniqueOrThrow({ where: { id: l.id } }))
          .status,
      ).toBe('approved');

      await h
        .http()
        .post(`/admin/listings/${l.id}/restore`)
        .set(bearer(a.accessToken))
        .send({ expectedVersion: 2, reason: 'owner verified' })
        .expect(200);
      await h
        .http()
        .get(`/listings/${l.id}`)
        .set(bearer(seekerToken))
        .expect(200);
    });

    it('post-review confirms an automatically approved listing', async () => {
      const l = await newPending({
        autoApproveAt: new Date(h.clock.now().getTime() - 1000),
      });
      await enableAutoApproval(h);
      await h.app.get(AutoApprovalJob).tick();
      await disableAutoApproval(h);
      const approved = await h.prisma.listing.findUniqueOrThrow({
        where: { id: l.id },
      });
      expect(approved.postReviewStatus).toBe('pending');
      await h
        .http()
        .post(`/admin/listings/${l.id}/post-review`)
        .set(bearer(a.accessToken))
        .send({ expectedVersion: approved.version, outcome: 'confirm' })
        .expect(200);
      expect(
        (await h.prisma.listing.findUniqueOrThrow({ where: { id: l.id } }))
          .postReviewStatus,
      ).toBe('confirmed');
    });

    it('notes are stored and audited, never shown to owners', async () => {
      const l = await newPending();
      await h
        .http()
        .post(`/admin/listings/${l.id}/note`)
        .set(bearer(a.accessToken))
        .send({ body: 'Called owner, confirmed.' })
        .expect(201);
      const detail = await h
        .http()
        .get(`/admin/listings/${l.id}`)
        .set(bearer(a.accessToken))
        .expect(200);
      expect(detail.body.notes[0].body).toBe('Called owner, confirmed.');
      const ownerView = await h
        .http()
        .get(`/listings/${l.id}`)
        .set(bearer(userToken(h.app, { id: l.ownerId, role: 'owner' })))
        .expect(200);
      expect(JSON.stringify(ownerView.body)).not.toContain('Called owner');
    });
  });

  describe('bulk decisions', () => {
    it('max 50 items, reason required, step-up required, per-item results', async () => {
      const tooMany = Array.from({ length: 51 }, () => ({
        id: '00000000-0000-4000-8000-000000000000',
        expectedVersion: 1,
      }));
      await stepUp(h, a);
      await h
        .http()
        .post('/admin/listings/bulk-decision')
        .set(bearer(a.accessToken))
        .send({ items: tooMany, decision: 'approve', reasonCodes: ['ok'] })
        .expect(400);

      const good = await newPending();
      const stale = await newPending();
      const draft = await newPending({ status: 'draft' });
      await h
        .http()
        .post('/admin/listings/bulk-decision')
        .set(bearer(a.accessToken))
        .send({
          items: [{ id: good.id, expectedVersion: 1 }],
          decision: 'approve',
        })
        .expect(400); // no reason

      const res = await h
        .http()
        .post('/admin/listings/bulk-decision')
        .set(bearer(a.accessToken))
        .send({
          items: [
            { id: good.id, expectedVersion: 1 },
            { id: stale.id, expectedVersion: 7 },
            { id: draft.id, expectedVersion: 1 },
          ],
          decision: 'approve',
          reasonCodes: ['meets_standards'],
        })
        .expect(200);
      expect(res.body.results.map((r: { result: string }) => r.result)).toEqual(
        ['ok', 'conflict', 'invalid_state'],
      );
      expect(
        await h.prisma.auditLog.count({
          where: { action: 'listing.approved', targetId: good.id },
        }),
      ).toBe(1);
    });

    it('without step-up → 401', async () => {
      const fresh = await loginNewAdmin(h, 'admin');
      h.clock.advance(11 * 60_000);
      const l = await newPending();
      await h
        .http()
        .post('/admin/listings/bulk-decision')
        .set(bearer(fresh.accessToken))
        .send({
          items: [{ id: l.id, expectedVersion: 1 }],
          decision: 'approve',
          reasonCodes: ['ok'],
        })
        .expect(401);
    });
  });

  describe('auto-approval job', () => {
    it('does nothing while the kill switch is off (default)', async () => {
      const l = await newPending({
        autoApproveAt: new Date(h.clock.now().getTime() - 60_000),
      });
      const result = await h.app.get(AutoApprovalJob).tick();
      expect(result.details).toEqual({ disabled: true });
      expect(
        (await h.prisma.listing.findUniqueOrThrow({ where: { id: l.id } }))
          .status,
      ).toBe('pending');
    });

    it('approves due items once (idempotent across ticks), audited with a system actor', async () => {
      const l = await newPending({
        autoApproveAt: new Date(h.clock.now().getTime() - 1000),
      });
      const notDue = await newPending({
        autoApproveAt: new Date(h.clock.now().getTime() + 60_000),
      });
      await enableAutoApproval(h);
      const job = h.app.get(AutoApprovalJob);
      await job.tick();
      await job.tick();
      await disableAutoApproval(h);
      const after = await h.prisma.listing.findUniqueOrThrow({
        where: { id: l.id },
      });
      expect(after.status).toBe('approved');
      expect(after.version).toBe(2);
      expect(
        (await h.prisma.listing.findUniqueOrThrow({ where: { id: notDue.id } }))
          .status,
      ).toBe('pending');
      const audit = await h.prisma.auditLog.findMany({
        where: { targetId: l.id, action: 'listing.auto_approved' },
      });
      expect(audit).toHaveLength(1);
      expect(audit[0].actorType).toBe('system');
      expect(
        await h.prisma.outboxEvent.count({
          where: { dedupeKey: `listing:${l.id}:v2:approved` },
        }),
      ).toBe(1);
    });

    it('holds (never approves) items that fail safeguards: too few photos, banned owner', async () => {
      const few = await newPending({
        photos: 1,
        autoApproveAt: new Date(h.clock.now().getTime() - 1000),
      });
      const bannedOwner = await createProfile(h.prisma, { banned: true });
      const banned = await createListing(h.prisma, bannedOwner.id, {
        status: 'pending',
        autoApproveAt: new Date(h.clock.now().getTime() - 1000),
      });
      await enableAutoApproval(h);
      await h.app.get(AutoApprovalJob).tick();
      await disableAutoApproval(h);
      for (const [id, reason] of [
        [few.id, 'publish_requirements_not_met'],
        [banned.id, 'owner_restricted'],
      ]) {
        const row = await h.prisma.listing.findUniqueOrThrow({ where: { id } });
        expect(row.status).toBe('pending');
        expect(row.holdReason).toBe(reason);
      }
    });

    it('F-04 placeholder: with a max-overdue set, long-overdue items are held instead of approved', async () => {
      const old = await newPending({
        autoApproveAt: new Date(h.clock.now().getTime() - 3 * 3600_000),
      });
      await h.prisma.appConfig.upsert({
        where: { key: 'auto_approval_max_overdue_seconds' },
        create: { key: 'auto_approval_max_overdue_seconds', value: 3600 },
        update: { value: 3600 },
      });
      await enableAutoApproval(h);
      await h.app.get(AutoApprovalJob).tick();
      await disableAutoApproval(h);
      await h.prisma.appConfig.delete({
        where: { key: 'auto_approval_max_overdue_seconds' },
      });
      const row = await h.prisma.listing.findUniqueOrThrow({
        where: { id: old.id },
      });
      expect(row.status).toBe('pending');
      expect(row.holdReason).toBe('overdue_after_outage');
    });

    it('an admin decision racing the job always wins cleanly (no double transition)', async () => {
      const l = await newPending({
        autoApproveAt: new Date(h.clock.now().getTime() - 1000),
      });
      await enableAutoApproval(h);
      const [decision] = await Promise.all([
        h
          .http()
          .post(`/admin/listings/${l.id}/decision`)
          .set(bearer(a.accessToken))
          .send({
            expectedVersion: 1,
            decision: 'reject',
            reasonCodes: ['duplicate'],
          }),
        h.app.get(AutoApprovalJob).tick(),
      ]);
      await disableAutoApproval(h);
      const decisions = await h.prisma.moderationDecision.findMany({
        where: { listingId: l.id },
      });
      expect(decisions).toHaveLength(1);
      const row = await h.prisma.listing.findUniqueOrThrow({
        where: { id: l.id },
      });
      expect(row.version).toBe(2);
      expect(row.status).toBe(
        decision.status === 200 ? 'rejected' : 'approved',
      );
    });
  });
});

async function enableAutoApproval(h: Harness) {
  await h.prisma.appConfig.upsert({
    where: { key: 'auto_approval_enabled' },
    create: { key: 'auto_approval_enabled', value: true },
    update: { value: true },
  });
}

async function disableAutoApproval(h: Harness) {
  await h.prisma.appConfig.deleteMany({
    where: { key: 'auto_approval_enabled' },
  });
}
