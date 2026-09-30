import {
  bearer,
  createAdminAccount,
  createHarness,
  loginNewAdmin,
  nextTotp,
  resetDatabase,
  stepUp,
  totpNow,
  type Harness,
} from './helpers/harness';

async function signInFirstFactor(h: Harness, phone: string) {
  await h.http().post('/admin/auth/otp/send').send({ phone }).expect(200);
  const res = await h
    .http()
    .post('/admin/auth/otp/verify')
    .send({ phone, code: h.sms.codes.get(phone) })
    .expect(200);
  return res.body as {
    mfa?: string;
    preToken?: string;
    breakGlassToken?: string;
  };
}

describe('admin authentication (D-47)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
    await resetDatabase(h.prisma);
  });
  afterAll(() => h.close());

  describe('TOTP enrollment and sign-in', () => {
    it('first login requires enrollment; secret is stored encrypted; 10 unique recovery codes shown once', async () => {
      const s = await loginNewAdmin(h, 'admin');
      expect(s.recoveryCodes).toHaveLength(10);
      expect(new Set(s.recoveryCodes).size).toBe(10);
      const admin = await h.prisma.adminUser.findUniqueOrThrow({
        where: { id: s.adminUserId },
      });
      expect(admin.totpSecretCiphertext).toBeTruthy();
      expect(admin.totpSecretCiphertext).not.toContain(s.secret);
      const stored = await h.prisma.adminRecoveryCode.findMany({
        where: { adminUserId: s.adminUserId },
      });
      expect(stored).toHaveLength(10);
      for (const row of stored)
        expect(s.recoveryCodes).not.toContain(row.codeHash);
      // Never retrievable again.
      const me = await h
        .http()
        .get('/admin/auth/me')
        .set(bearer(s.accessToken))
        .expect(200);
      expect(JSON.stringify(me.body)).not.toContain(s.recoveryCodes[0]);
      expect(me.body.recoveryCodesRemaining).toBe(10);
      expect(JSON.stringify(me.body)).not.toContain(s.secret);
      const audit = await h.prisma.auditLog.findMany({
        where: { targetId: s.adminUserId },
        select: { action: true },
      });
      expect(audit.map((a) => a.action)).toEqual(
        expect.arrayContaining([
          'admin.totp.enrolled',
          'admin.recovery_codes.generated',
        ]),
      );
    });

    it('returning admin: OTP then TOTP; a replayed TOTP code is rejected', async () => {
      const s = await loginNewAdmin(h, 'admin');
      const ff = await signInFirstFactor(h, s.phone);
      expect(ff.mfa).toBe('verify');
      const code = nextTotp(h, s.secret);
      const ok = await h
        .http()
        .post('/admin/auth/totp/verify')
        .set(bearer(ff.preToken!))
        .send({ code })
        .expect(200);
      expect(ok.body.accessToken).toBeTruthy();
      // Same code, second pre-session → replay of the same time step → rejected.
      const ff2 = await signInFirstFactor2(h, s.phone);
      await h
        .http()
        .post('/admin/auth/totp/verify')
        .set(bearer(ff2.preToken!))
        .send({ code })
        .expect(401);
    });

    it('5 wrong codes lock the account for 15 minutes (423), audited and alerted', async () => {
      const s = await loginNewAdmin(h, 'admin');
      const ff = await signInFirstFactor2(h, s.phone);
      for (let i = 0; i < 5; i++) {
        await h
          .http()
          .post('/admin/auth/totp/verify')
          .set(bearer(ff.preToken!))
          .send({ code: '000000' })
          .expect(401);
      }
      const locked = await h
        .http()
        .post('/admin/auth/totp/verify')
        .set(bearer(ff.preToken!))
        .send({ code: totpNow(h, s.secret) })
        .expect(423);
      expect(locked.body.code).toBe('TOTP_LOCKED');
      expect(
        await h.prisma.auditLog.count({
          where: { action: 'admin.mfa.locked', targetId: s.adminUserId },
        }),
      ).toBe(1);
      expect(
        await h.prisma.systemAlert.count({
          where: { kind: 'admin_mfa_locked' },
        }),
      ).toBeGreaterThanOrEqual(1);
      h.clock.advance(16 * 60_000);
      const ff2 = await signInFirstFactor2(h, s.phone);
      await h
        .http()
        .post('/admin/auth/totp/verify')
        .set(bearer(ff2.preToken!))
        .send({ code: nextTotp(h, s.secret) })
        .expect(200);
    });

    it('non-admin phone numbers get the same OTP response and no SMS (no enumeration)', async () => {
      const phone = '+919812345678';
      h.sms.codes.delete(phone);
      const res = await h
        .http()
        .post('/admin/auth/otp/send')
        .send({ phone })
        .expect(200);
      expect(res.body).toEqual({ sent: true });
      expect(h.sms.codes.has(phone)).toBe(false);
      const v = await h
        .http()
        .post('/admin/auth/otp/verify')
        .send({ phone, code: '123456' })
        .expect(401);
      expect(v.body.message).toBe('Invalid or expired code');
    });
  });

  describe('recovery codes', () => {
    it('using a code: single-use, audited, security alert + notifications, TOTP re-enrollment and fresh codes required, other sessions ended', async () => {
      const superAdmin = await loginNewAdmin(h, 'super_admin'); // should receive the security notification
      const s = await loginNewAdmin(h, 'admin');
      const ff = await signInFirstFactor2(h, s.phone);
      const code = s.recoveryCodes[3];

      const used = await h
        .http()
        .post('/admin/auth/recovery/verify')
        .set(bearer(ff.preToken!))
        .send({ recoveryCode: code })
        .expect(200);
      expect(used.body).toEqual({ mfa: 'enroll' });

      // The earlier full session was ended.
      await h
        .http()
        .get('/admin/auth/me')
        .set(bearer(s.accessToken))
        .expect(401);
      // The recovery session can do nothing but re-enroll.
      await h
        .http()
        .post('/admin/auth/totp/verify')
        .set(bearer(ff.preToken!))
        .send({ code: totpNow(h, s.secret) })
        .expect(409);
      // Audit + alert + notifications (via outbox) to the admin and every super_admin.
      expect(
        await h.prisma.auditLog.count({
          where: {
            action: 'admin.recovery_code.used',
            targetId: s.adminUserId,
          },
        }),
      ).toBe(1);
      expect(
        await h.prisma.systemAlert.count({
          where: { kind: 'recovery_code_used' },
        }),
      ).toBeGreaterThanOrEqual(1);
      const queued = await h.prisma.outboxEvent.findMany({
        where: { dedupeKey: { startsWith: 'security:recovery:' } },
      });
      const recipients = queued.map(
        (q) => (q.payload as { userId: string }).userId,
      );
      expect(recipients).toEqual(
        expect.arrayContaining([s.profileId, superAdmin.profileId]),
      );

      // Re-enroll → brand-new codes; every old code (including unused ones) is dead.
      const enroll = await h
        .http()
        .post('/admin/auth/totp/enroll')
        .set(bearer(ff.preToken!))
        .expect(200);
      const confirm = await h
        .http()
        .post('/admin/auth/totp/enroll/confirm')
        .set(bearer(ff.preToken!))
        .send({ code: nextTotp(h, enroll.body.secret) })
        .expect(200);
      expect(confirm.body.recoveryCodes).toHaveLength(10);
      for (const old of s.recoveryCodes)
        expect(confirm.body.recoveryCodes).not.toContain(old);

      const ff2 = await signInFirstFactor2(h, s.phone);
      await h
        .http()
        .post('/admin/auth/recovery/verify')
        .set(bearer(ff2.preToken!))
        .send({ recoveryCode: code })
        .expect(401);
      await h
        .http()
        .post('/admin/auth/recovery/verify')
        .set(bearer(ff2.preToken!))
        .send({ recoveryCode: s.recoveryCodes[5] })
        .expect(401);
    });

    it('regeneration requires step-up and invalidates all previous codes', async () => {
      const s = await loginNewAdmin(h, 'admin');
      h.clock.advance(11 * 60_000); // sign-in step-up lapses
      const denied = await h
        .http()
        .post('/admin/auth/recovery/regenerate')
        .set(bearer(s.accessToken))
        .expect(401);
      expect(denied.body.code).toBe('STEP_UP_REQUIRED');
      await stepUp(h, s);
      const regen = await h
        .http()
        .post('/admin/auth/recovery/regenerate')
        .set(bearer(s.accessToken))
        .expect(200);
      expect(regen.body.recoveryCodes).toHaveLength(10);
      const live = await h.prisma.adminRecoveryCode.count({
        where: { adminUserId: s.adminUserId, usedAt: null, revokedAt: null },
      });
      expect(live).toBe(10);
      const revoked = await h.prisma.adminRecoveryCode.count({
        where: { adminUserId: s.adminUserId, revokedAt: { not: null } },
      });
      expect(revoked).toBe(10);
    });
  });

  describe('sessions', () => {
    it('idle timeout: 30 minutes without activity ends the session', async () => {
      const s = await loginNewAdmin(h, 'admin');
      h.clock.advance(29 * 60_000);
      await h
        .http()
        .get('/admin/auth/me')
        .set(bearer(s.accessToken))
        .expect(200); // activity slides idle
      h.clock.advance(29 * 60_000);
      const refreshed = await h
        .http()
        .post('/admin/auth/refresh')
        .send({ refreshToken: s.refreshToken })
        .expect(200);
      h.clock.advance(31 * 60_000);
      const res = await h
        .http()
        .post('/admin/auth/refresh')
        .send({ refreshToken: refreshed.body.refreshToken })
        .expect(401);
      expect(res.body.code).toBe('SESSION_EXPIRED');
    });

    it('background polling does not keep a session alive', async () => {
      const s = await loginNewAdmin(h, 'admin');
      h.clock.advance(20 * 60_000);
      await h
        .http()
        .get('/admin/auth/me')
        .set(bearer(s.accessToken))
        .set('x-admin-background', '1')
        .expect(200);
      h.clock.advance(11 * 60_000);
      await h
        .http()
        .get('/admin/auth/me')
        .set(bearer(s.accessToken))
        .expect(401);
    });

    it('absolute timeout: 12 hours even with continuous activity', async () => {
      const s = await loginNewAdmin(h, 'admin');
      let token = s.refreshToken;
      for (let i = 0; i < 30; i++) {
        h.clock.advance(29 * 60_000);
        const r = await h
          .http()
          .post('/admin/auth/refresh')
          .send({ refreshToken: token });
        if (r.status !== 200) {
          // Refreshes at 29 min … 696 min (11.6 h) succeed; the one at 725 min (> 12 h) fails.
          expect(i).toBe(24);
          expect(r.body.code).toBe('SESSION_EXPIRED');
          return;
        }
        token = r.body.refreshToken;
      }
      throw new Error('session outlived the 12-hour absolute limit');
    });

    it('logout invalidates the session immediately; reusing a rotated refresh token revokes the session', async () => {
      const s = await loginNewAdmin(h, 'admin');
      const r1 = await h
        .http()
        .post('/admin/auth/refresh')
        .send({ refreshToken: s.refreshToken })
        .expect(200);
      // Old refresh token presented again → theft signal → whole session revoked.
      await h
        .http()
        .post('/admin/auth/refresh')
        .send({ refreshToken: s.refreshToken })
        .expect(401);
      await h
        .http()
        .post('/admin/auth/refresh')
        .send({ refreshToken: r1.body.refreshToken })
        .expect(401);
      expect(
        await h.prisma.auditLog.count({
          where: { action: 'admin.session.refresh_reuse_detected' },
        }),
      ).toBeGreaterThanOrEqual(1);

      const s2 = await loginNewAdmin(h, 'admin');
      await h
        .http()
        .post('/admin/auth/logout')
        .set(bearer(s2.accessToken))
        .expect(204);
      await h
        .http()
        .get('/admin/auth/me')
        .set(bearer(s2.accessToken))
        .expect(401);
      await h
        .http()
        .post('/admin/auth/refresh')
        .send({ refreshToken: s2.refreshToken })
        .expect(401);
    });

    it('IDOR: an admin cannot revoke another admin’s session', async () => {
      const a = await loginNewAdmin(h, 'admin');
      const b = await loginNewAdmin(h, 'admin');
      const bSession = await h.prisma.adminSession.findFirstOrThrow({
        where: { adminUserId: b.adminUserId, revokedAt: null },
      });
      await h
        .http()
        .delete(`/admin/auth/sessions/${bSession.id}`)
        .set(bearer(a.accessToken))
        .expect(404);
      await h
        .http()
        .get('/admin/auth/me')
        .set(bearer(b.accessToken))
        .expect(200);
    });

    it('TOTP reset by a super_admin invalidates the target’s sessions and requires re-enrollment', async () => {
      const sa = await loginNewAdmin(h, 'super_admin');
      const target = await loginNewAdmin(h, 'admin');
      await stepUp(h, sa);
      await h
        .http()
        .post(`/admin/admin-users/${target.adminUserId}/totp-reset`)
        .set(bearer(sa.accessToken))
        .send({ reason: 'lost phone, identity confirmed by call' })
        .expect(200);
      await h
        .http()
        .get('/admin/auth/me')
        .set(bearer(target.accessToken))
        .expect(401);
      const ff = await signInFirstFactor2(h, target.phone);
      expect(ff.mfa).toBe('enroll');
      expect(
        await h.prisma.auditLog.count({
          where: { action: 'admin.totp.reset', targetId: target.adminUserId },
        }),
      ).toBe(1);
    });

    it('a super_admin’s TOTP cannot be reset by themselves (needs a second super_admin)', async () => {
      const sa = await loginNewAdmin(h, 'super_admin');
      await stepUp(h, sa);
      await h
        .http()
        .post(`/admin/admin-users/${sa.adminUserId}/totp-reset`)
        .set(bearer(sa.accessToken))
        .send({ reason: 'self reset attempt' })
        .expect(403);
    });

    it('disabling an admin ends their sessions at once', async () => {
      const sa = await loginNewAdmin(h, 'super_admin');
      const target = await loginNewAdmin(h, 'admin');
      await stepUp(h, sa);
      await h
        .http()
        .put(`/admin/admin-users/${target.adminUserId}/status`)
        .set(bearer(sa.accessToken))
        .send({ status: 'disabled', reason: 'left the team' })
        .expect(200);
      await h
        .http()
        .get('/admin/auth/me')
        .set(bearer(target.accessToken))
        .expect(401);
    });
  });

  describe('step-up', () => {
    it('sensitive action without step-up → 401 STEP_UP_REQUIRED; after step-up → allowed; window is 10 minutes', async () => {
      const sa = await loginNewAdmin(h, 'super_admin');
      const body = {
        value: 4,
        expectedVersion: 0,
        reason: 'tuning report threshold',
      };
      h.clock.advance(11 * 60_000);
      const denied = await h
        .http()
        .patch('/admin/config/report_threshold')
        .set(bearer(sa.accessToken))
        .send(body)
        .expect(401);
      expect(denied.body.code).toBe('STEP_UP_REQUIRED');
      await stepUp(h, sa);
      await h
        .http()
        .patch('/admin/config/report_threshold')
        .set(bearer(sa.accessToken))
        .send(body)
        .expect(200);
      h.clock.advance(11 * 60_000);
      await h
        .http()
        .patch('/admin/config/report_threshold')
        .set(bearer(sa.accessToken))
        .send({ value: 5, expectedVersion: 1, reason: 'again' })
        .expect(401);
      expect(
        await h.prisma.auditLog.count({
          where: { action: 'admin.step_up', actorId: sa.profileId },
        }),
      ).toBe(1);
    });
  });

  describe('break-glass (ADMIN_PHONES)', () => {
    it('is explicit, single-use, audited, alerted, grants super_admin and forces TOTP enrollment', async () => {
      const phone = '+919900000001';
      const ff = await signInFirstFactor(h, phone);
      expect(ff.breakGlassToken).toBeTruthy();
      expect(ff.preToken).toBeUndefined(); // no admin account yet → nothing without the explicit step

      const before = await h.prisma.profile.findUniqueOrThrow({
        where: { phone },
        include: { adminUser: true },
      });
      expect(before.adminUser).toBeNull(); // OTP verification alone promoted nobody

      const bg = await h
        .http()
        .post('/admin/auth/break-glass')
        .send({ breakGlassToken: ff.breakGlassToken })
        .expect(200);
      expect(bg.body.mfa).toBe('enroll');
      await h
        .http()
        .post('/admin/auth/break-glass')
        .send({ breakGlassToken: ff.breakGlassToken })
        .expect(401); // single use

      const admin = await h.prisma.adminUser.findUniqueOrThrow({
        where: { profileId: before.id },
      });
      expect(admin.role).toBe('super_admin');
      expect(admin.totpEnrolledAt).toBeNull();
      expect(
        await h.prisma.auditLog.count({
          where: { action: 'admin.break_glass.used' },
        }),
      ).toBe(1);
      expect(
        await h.prisma.systemAlert.count({
          where: { kind: 'break_glass_used' },
        }),
      ).toBe(1);

      // Pre-session can only enroll; no console access yet.
      await h
        .http()
        .get('/admin/dashboard')
        .set(bearer(bg.body.preToken))
        .expect(401);
      const enroll = await h
        .http()
        .post('/admin/auth/totp/enroll')
        .set(bearer(bg.body.preToken))
        .expect(200);
      await h
        .http()
        .post('/admin/auth/totp/enroll/confirm')
        .set(bearer(bg.body.preToken))
        .send({ code: totpNow(h, enroll.body.secret) })
        .expect(200);
    });

    it('is refused for phones not in ADMIN_PHONES', async () => {
      const { profile } = await createAdminAccount(h, 'admin');
      const ff = await signInFirstFactor2(h, profile.phone!);
      expect(ff.breakGlassToken).toBeUndefined();
    });
  });
});

// A second OTP round for the same phone needs the 60-second resend cooldown to pass.
async function signInFirstFactor2(h: Harness, phone: string) {
  h.clock.advance(61_000);
  return signInFirstFactor(h, phone);
}
