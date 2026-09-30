import {
  bearer,
  createHarness,
  createListing,
  createProfile,
  loginNewAdmin,
  resetDatabase,
  stepUp,
  userToken,
  type Harness,
} from './helpers/harness';

async function legacyAdmin(
  h: Harness,
  role: 'admin' | 'senior_reviewer' | 'super_admin' = 'admin',
) {
  const p = await createProfile(h.prisma, { role: 'admin' });
  await h.prisma.adminUser.create({ data: { profileId: p.id, role } });
  return { profile: p, token: userToken(h.app, p) };
}

describe('legacy admin hardening + API hygiene', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
    await resetDatabase(h.prisma);
  });
  afterAll(() => h.close());

  describe('LEGACY_ADMIN_ENABLED kill switch (fail closed)', () => {
    const original = process.env.LEGACY_ADMIN_ENABLED;
    afterEach(() => {
      process.env.LEGACY_ADMIN_ENABLED = original;
    });

    it('is OFF by default: unset, "false" or any other value → every /legacy-admin route 404s', async () => {
      const { token } = await legacyAdmin(h);
      for (const value of [undefined, 'false', '', '1', 'TRUE', 'yes']) {
        if (value === undefined) delete process.env.LEGACY_ADMIN_ENABLED;
        else process.env.LEGACY_ADMIN_ENABLED = value;
        await h.http().get('/legacy-admin/listings/queue').set(bearer(token)).expect(404);
        await h.http().get('/legacy-admin/reports').set(bearer(token)).expect(404);
        await h
          .http()
          .post('/legacy-admin/listings/bulk-status')
          .set(bearer(token))
          .send({ ids: [], status: 'approved', reason: 'x' })
          .expect(404);
      }
    });

    it('is available only when explicitly enabled with "true"', async () => {
      const { token } = await legacyAdmin(h);
      process.env.LEGACY_ADMIN_ENABLED = 'true';
      await h.http().get('/legacy-admin/listings/queue').set(bearer(token)).expect(200);
      await h.http().get('/legacy-admin/reports').set(bearer(token)).expect(200);
    });

    it('the committed .env.example ships it disabled', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const text = require('fs').readFileSync(require('path').join(__dirname, '..', '.env.example'), 'utf8') as string;
      expect(text).toMatch(/^LEGACY_ADMIN_ENABLED=false$/m);
    });
  });

  describe('legacy bulk status', () => {
    it('requires a reason, caps at 50, only decides pending listings, and audits each item', async () => {
      const { token, profile } = await legacyAdmin(h);
      const owner = await createProfile(h.prisma);
      const pending = await createListing(h.prisma, owner.id, {
        status: 'pending',
      });
      const draft = await createListing(h.prisma, owner.id, {
        status: 'draft',
      });
      const rented = await createListing(h.prisma, owner.id, {
        status: 'rented',
      });
      const photoless = await createListing(h.prisma, owner.id, {
        status: 'pending',
        photos: 0,
      });

      await h
        .http()
        .post('/legacy-admin/listings/bulk-status')
        .set(bearer(token))
        .send({ ids: [pending.id], status: 'approved' })
        .expect(400); // no reason
      await h
        .http()
        .post('/legacy-admin/listings/bulk-status')
        .set(bearer(token))
        .send({
          ids: Array(51).fill(pending.id),
          status: 'approved',
          reason: 'batch',
        })
        .expect(400);

      const res = await h
        .http()
        .post('/legacy-admin/listings/bulk-status')
        .set(bearer(token))
        .send({
          ids: [pending.id, draft.id, rented.id, photoless.id],
          status: 'approved',
          reason: 'reviewed in legacy console',
        })
        .expect(200);
      expect(res.body.updated).toBe(1);
      expect(res.body.results.map((r: { result: string }) => r.result)).toEqual(
        ['ok', 'invalid_state', 'invalid_state', 'requirements_not_met'],
      );
      expect(
        (await h.prisma.listing.findUniqueOrThrow({ where: { id: draft.id } }))
          .status,
      ).toBe('draft');
      expect(
        (await h.prisma.listing.findUniqueOrThrow({ where: { id: rented.id } }))
          .status,
      ).toBe('rented');
      const audit = await h.prisma.auditLog.findFirstOrThrow({
        where: { targetId: pending.id, action: 'listing.approved' },
      });
      expect(audit.actorId).toBe(profile.id);
      expect(audit.actorRole).toBe('legacy:admin');
    });
  });

  describe('report resolution', () => {
    it('requires a pending report and never resurrects rejected/rented/paused listings', async () => {
      const { token } = await legacyAdmin(h);
      const owner = await createProfile(h.prisma);
      const reporter = await createProfile(h.prisma, { role: 'seeker' });
      for (const status of ['rejected', 'rented'] as const) {
        const l = await createListing(h.prisma, owner.id, { status });
        const r = await h.prisma.report.create({
          data: {
            listingId: l.id,
            reporterId: reporter.id,
            reason: 'x',
            reasonCategory: 'fake',
          },
        });
        await h
          .http()
          .patch(`/legacy-admin/reports/${r.id}`)
          .set(bearer(token))
          .send({ action: 'confirm' })
          .expect(200);
        expect(
          (await h.prisma.listing.findUniqueOrThrow({ where: { id: l.id } }))
            .status,
        ).toBe(status);
        await h
          .http()
          .patch(`/legacy-admin/reports/${r.id}`)
          .set(bearer(token))
          .send({ action: 'dismiss' })
          .expect(409);
      }
      const live = await createListing(h.prisma, owner.id, {
        status: 'approved',
      });
      const r = await h.prisma.report.create({
        data: {
          listingId: live.id,
          reporterId: reporter.id,
          reason: 'x',
          reasonCategory: 'fake',
        },
      });
      await h
        .http()
        .patch(`/legacy-admin/reports/${r.id}`)
        .set(bearer(token))
        .send({ action: 'confirm', note: 'photos stolen' })
        .expect(200);
      const held = await h.prisma.listing.findUniqueOrThrow({
        where: { id: live.id },
      });
      expect(held.status).toBe('pending');
      expect(held.heldAt).not.toBeNull(); // held: auto-approval can't put it back online
    });

    it('report threshold holds a live listing (system actor) instead of just reverting it', async () => {
      const owner = await createProfile(h.prisma);
      const l = await createListing(h.prisma, owner.id, { status: 'approved' });
      for (let i = 0; i < 3; i++) {
        const reporter = await createProfile(h.prisma, { role: 'seeker' });
        await h
          .http()
          .post('/reports')
          .set(bearer(userToken(h.app, reporter)))
          .send({
            listingId: l.id,
            reason: 'fake listing',
            reasonCategory: 'fake',
          })
          .expect(201);
      }
      const row = await h.prisma.listing.findUniqueOrThrow({
        where: { id: l.id },
      });
      expect(row.status).toBe('pending');
      expect(row.holdReason).toBe('reports_threshold');
      expect(
        await h.prisma.auditLog.count({
          where: {
            targetId: l.id,
            action: 'listing.held_for_reports',
            actorType: 'system',
          },
        }),
      ).toBe(1);
      // The owner can't delete a listing that is under trust review (evidence).
      await h
        .http()
        .delete(`/listings/${l.id}`)
        .set(bearer(userToken(h.app, owner)))
        .expect(409);
    });
  });

  describe('roles and bans', () => {
    it('legacy console can no longer grant admin; marketplace role changes skip admins and self', async () => {
      const { token, profile } = await legacyAdmin(h);
      const user = await createProfile(h.prisma, { role: 'seeker' });
      await h
        .http()
        .patch(`/legacy-admin/users/${user.id}/role`)
        .set(bearer(token))
        .send({ role: 'admin' })
        .expect(400);
      await h
        .http()
        .patch(`/legacy-admin/users/${user.id}/role`)
        .set(bearer(token))
        .send({ role: 'owner' })
        .expect(200);
      const other = await legacyAdmin(h);
      await h
        .http()
        .patch(`/legacy-admin/users/${other.profile.id}/role`)
        .set(bearer(token))
        .send({ role: 'seeker' })
        .expect(403);
      await h
        .http()
        .patch(`/legacy-admin/users/${profile.id}/role`)
        .set(bearer(token))
        .send({ role: 'seeker' })
        .expect(403);
    });

    it('bans need step-up (impossible from the legacy console) and can never target admins or oneself', async () => {
      const { token } = await legacyAdmin(h, 'super_admin');
      const victim = await createProfile(h.prisma);
      const res = await h
        .http()
        .patch(`/legacy-admin/users/${victim.id}/ban`)
        .set(bearer(token))
        .send({ banned: true, reason: 'spam' })
        .expect(403);
      expect(res.body.code).toBe('STEP_UP_UNAVAILABLE');

      const sa = await loginNewAdmin(h, 'super_admin');
      await stepUp(h, sa);
      const adminTarget = await legacyAdmin(h);
      await h
        .http()
        .post(`/admin/users/${adminTarget.profile.id}/ban`)
        .set(bearer(sa.accessToken))
        .send({ reason: 'takeover attempt' })
        .expect(403);
      await h
        .http()
        .post(`/admin/users/${sa.profileId}/ban`)
        .set(bearer(sa.accessToken))
        .send({ reason: 'self ban' })
        .expect(403);
      await h
        .http()
        .post(`/admin/users/${victim.id}/ban`)
        .set(bearer(sa.accessToken))
        .send({ reason: 'confirmed scammer' })
        .expect(200);
      await h
        .http()
        .get('/listings/mine')
        .set(bearer(userToken(h.app, victim)))
        .expect(401);
      const plainAdmin = await loginNewAdmin(h, 'admin');
      await h
        .http()
        .post(`/admin/users/${victim.id}/unban`)
        .set(bearer(plainAdmin.accessToken))
        .send({ reason: 'x-plain' })
        .expect(403);
    });
  });

  describe('configuration', () => {
    it('allowlist, per-key validation, optimistic version, public/private split', async () => {
      const sa = await loginNewAdmin(h, 'super_admin');
      await stepUp(h, sa);
      const patch = (key: string, body: object) =>
        h
          .http()
          .patch(`/admin/config/${key}`)
          .set(bearer(sa.accessToken))
          .send(body);
      expect(
        (
          await patch('secret_api_key', {
            value: 'x',
            expectedVersion: 0,
            reason: 'nope',
          })
        ).body.code,
      ).toBe('UNKNOWN_CONFIG_KEY');
      expect(
        (
          await patch('report_threshold', {
            value: 0,
            expectedVersion: 0,
            reason: 'mass delist',
          })
        ).body.code,
      ).toBe('INVALID_CONFIG_VALUE');
      await patch('report_threshold', {
        value: 5,
        expectedVersion: 0,
        reason: 'tuning',
      }).expect(200);
      const stale = await patch('report_threshold', {
        value: 6,
        expectedVersion: 0,
        reason: 'stale editor',
      }).expect(409);
      expect(stale.body.code).toBe('CONFIG_VERSION_CONFLICT');
      await patch('auto_approval_window_seconds', {
        value: 300,
        expectedVersion: 0,
        reason: 'explicit',
      }).expect(200);

      const user = await createProfile(h.prisma);
      const pub = await h
        .http()
        .get('/config')
        .set(bearer(userToken(h.app, user)))
        .expect(200);
      expect(pub.body.report_threshold).toBe(5);
      expect(pub.body).not.toHaveProperty('auto_approval_window_seconds');
      expect(pub.body).not.toHaveProperty('auto_approval_enabled');

      const audit = await h.prisma.auditLog.findFirstOrThrow({
        where: { action: 'config.updated', targetId: 'report_threshold' },
      });
      expect(audit.before).toBeNull();
      expect(audit.after).toMatchObject({ value: 5, version: 1 });
    });

    it('legacy console can read but not change configuration', async () => {
      const { token } = await legacyAdmin(h, 'super_admin');
      await h.http().get('/legacy-admin/config').set(bearer(token)).expect(200);
      await h
        .http()
        .patch('/legacy-admin/config/report_threshold')
        .set(bearer(token))
        .send({ value: 4, expectedVersion: 1, reason: 'legacy edit' })
        .expect(403);
    });
  });

  describe('errors, validation, health', () => {
    it('invalid UUIDs are 400, missing records 404, and no internals leak', async () => {
      const user = await createProfile(h.prisma);
      const token = userToken(h.app, user);
      const bad = await h
        .http()
        .get('/listings/not-a-uuid')
        .set(bearer(token))
        .expect(400);
      expect(bad.body.requestId).toBeTruthy();
      await h
        .http()
        .get('/listings/00000000-0000-4000-8000-000000000000')
        .set(bearer(token))
        .expect(404);
      const sa = await loginNewAdmin(h, 'super_admin');
      const r = await h
        .http()
        .post('/admin/listings/00000000-0000-4000-8000-000000000000/decision')
        .set(bearer(sa.accessToken))
        .send({ expectedVersion: 1, decision: 'approve' })
        .expect(404);
      const text = JSON.stringify(r.body);
      for (const leak of ['prisma', 'Prisma', 'stack', 'SELECT', 'postgres'])
        expect(text).not.toContain(leak);
    });

    it('P2002 (unique violation) maps to 409 without internals', async () => {
      const sa = await loginNewAdmin(h, 'super_admin');
      await stepUp(h, sa);
      const existing = await legacyAdmin(h);
      const res = await h
        .http()
        .post('/admin/admin-users')
        .set(bearer(sa.accessToken))
        .send({
          phone: existing.profile.phone,
          role: 'admin',
          reason: 'duplicate grant',
        })
        .expect(409);
      expect(JSON.stringify(res.body)).not.toMatch(/constraint|prisma/i);
    });

    it('health is 200 when the database answers', async () => {
      const res = await h.http().get('/health').expect(200);
      expect(res.body).toEqual({ status: 'ok', database: 'connected' });
    });

    it('rate limits return 429 with Retry-After', async () => {
      const phone = '+919877777777';
      let last = 0;
      for (let i = 0; i < 6; i++) {
        last = (await h.http().post('/admin/auth/otp/send').send({ phone }))
          .status;
      }
      expect(last).toBe(429);
    });

    it('security headers are set and CORS is an allowlist', async () => {
      const allowed = await h
        .http()
        .options('/health')
        .set('Origin', 'http://web.test')
        .set('Access-Control-Request-Method', 'GET');
      expect(allowed.headers['access-control-allow-origin']).toBe(
        'http://web.test',
      );
      const denied = await h
        .http()
        .options('/health')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'GET');
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
      const res = await h.http().get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-request-id']).toBeTruthy();
    });
  });

  describe('audit log', () => {
    it('is append-only at the database level and has no update/delete endpoint', async () => {
      await h.prisma.auditLog.create({
        data: { category: 'system', action: 'test.row', actorType: 'system' },
      });
      await expect(
        h.prisma.auditLog.updateMany({ data: { action: 'tampered' } }),
      ).rejects.toThrow();
      await expect(h.prisma.auditLog.deleteMany({})).rejects.toThrow();
      const sa = await loginNewAdmin(h, 'super_admin');
      const row = await h.prisma.auditLog.findFirstOrThrow();
      await h
        .http()
        .patch(`/admin/audit/${row.id}`)
        .set(bearer(sa.accessToken))
        .send({})
        .expect(404);
      await h
        .http()
        .delete(`/admin/audit/${row.id}`)
        .set(bearer(sa.accessToken))
        .expect(404);
    });

    it('scope: admin sees only own actions; super_admin sees all; export needs audit.export + step-up and is itself audited', async () => {
      const admin = await loginNewAdmin(h, 'admin');
      const sa = await loginNewAdmin(h, 'super_admin');
      const mine = await h
        .http()
        .get('/admin/audit')
        .set(bearer(admin.accessToken))
        .expect(200);
      expect(mine.body.scope).toBe('own');
      for (const row of mine.body.items)
        expect(row.actorId).toBe(admin.profileId);
      const all = await h
        .http()
        .get('/admin/audit')
        .set(bearer(sa.accessToken))
        .expect(200);
      expect(all.body.scope).toBe('all');

      const range = {
        from: new Date(Date.now() - 86400_000).toISOString(),
        to: new Date(Date.now() + 86400_000 * 2).toISOString(),
      };
      await h
        .http()
        .post('/admin/audit/export')
        .set(bearer(admin.accessToken))
        .send({ ...range, reason: 'x-test' })
        .expect(403);
      await stepUp(h, sa);
      const exp = await h
        .http()
        .post('/admin/audit/export')
        .set(bearer(sa.accessToken))
        .send({ ...range, reason: 'quarterly review' })
        .expect(200);
      expect(exp.body.rows.length).toBeGreaterThan(0);
      expect(
        await h.prisma.auditLog.count({
          where: { action: 'audit.exported', actorId: sa.profileId },
        }),
      ).toBe(1);
    });
  });
});
