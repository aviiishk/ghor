import { ModulesContainer } from '@nestjs/core';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import {
  ADMIN_PRE_KEY,
  ADMIN_PUBLIC_KEY,
  ADMIN_SELF_KEY,
  PERMISSIONS_KEY,
} from '../src/permissions/decorators';
import {
  bearer,
  createHarness,
  createProfile,
  loginNewAdmin,
  resetDatabase,
  stepUp,
  userToken,
  type Harness,
} from './helpers/harness';

describe('permissions', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
    await resetDatabase(h.prisma);
  });
  afterAll(() => h.close());

  // Fails the build if anyone adds an /admin/* or /legacy-admin/* route without declaring
  // its authorization (PermissionGuard would deny it at runtime anyway — fail closed —
  // but an undeclared route is a bug worth catching before it ships).
  it('every /admin and /legacy-admin route declares permission metadata', () => {
    const undeclared: string[] = [];
    let adminRoutes = 0;
    for (const mod of h.app.get(ModulesContainer).values()) {
      for (const wrapper of mod.controllers.values()) {
        const ctrl = wrapper.metatype as
          (new (...args: unknown[]) => unknown) | undefined;
        if (!ctrl) continue;
        const base = String(Reflect.getMetadata(PATH_METADATA, ctrl) ?? '');
        for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
          const handler = (ctrl.prototype as Record<string, unknown>)[name];
          if (name === 'constructor' || typeof handler !== 'function') continue;
          if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined)
            continue;
          const path =
            `/${base}/${String(Reflect.getMetadata(PATH_METADATA, handler) ?? '')}`.replace(
              /\/+/g,
              '/',
            );
          if (!path.startsWith('/admin') && !path.startsWith('/legacy-admin'))
            continue;
          adminRoutes++;
          const declared =
            (
              Reflect.getMetadata(PERMISSIONS_KEY, handler) ??
              Reflect.getMetadata(PERMISSIONS_KEY, ctrl)
            )?.length ||
            Reflect.getMetadata(ADMIN_SELF_KEY, handler) ||
            Reflect.getMetadata(ADMIN_PUBLIC_KEY, handler) ||
            Reflect.getMetadata(ADMIN_PRE_KEY, handler);
          if (!declared) {
            undeclared.push(
              `${RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)]} ${path}`,
            );
          }
        }
      }
    }
    expect(adminRoutes).toBeGreaterThan(40);
    expect(undeclared).toEqual([]);
  });

  it('admin → super_admin-only endpoint → 403', async () => {
    const admin = await loginNewAdmin(h, 'admin');
    await h
      .http()
      .get('/admin/admin-users')
      .set(bearer(admin.accessToken))
      .expect(403);
    await h
      .http()
      .get('/admin/config')
      .set(bearer(admin.accessToken))
      .expect(403);
  });

  it('super_admin → GHOR Verified (verification.view) endpoint WITHOUT senior capability → 403', async () => {
    const sa = await loginNewAdmin(h, 'super_admin');
    const res = await h
      .http()
      .get('/admin/trust/verification-statuses')
      .set(bearer(sa.accessToken))
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
    expect(res.body.missing).toEqual(['verification.view']);
  });

  it('senior_reviewer → GHOR Verified capability → allowed', async () => {
    const senior = await loginNewAdmin(h, 'senior_reviewer');
    await h
      .http()
      .get('/admin/trust/verification-statuses')
      .set(bearer(senior.accessToken))
      .expect(200);
  });

  it('super_admin WITH an explicitly assigned senior capability → allowed', async () => {
    const sa = await loginNewAdmin(h, 'super_admin', {
      seniorCapability: true,
    });
    await h
      .http()
      .get('/admin/trust/verification-statuses')
      .set(bearer(sa.accessToken))
      .expect(200);
  });

  it('granting the senior capability requires roles.manage + step-up, is audited, and takes effect', async () => {
    const granter = await loginNewAdmin(h, 'super_admin');
    const target = await loginNewAdmin(h, 'super_admin');
    const url = `/admin/admin-users/${target.adminUserId}/senior-capability`;
    const body = { enabled: true, reason: 'second senior reviewer for launch' };

    // Fresh sign-in counts as step-up; let it lapse to prove the API enforces the window.
    h.clock.advance(11 * 60_000);
    const noStepUp = await h
      .http()
      .put(url)
      .set(bearer(granter.accessToken))
      .send(body)
      .expect(401);
    expect(noStepUp.body.code).toBe('STEP_UP_REQUIRED');

    await stepUp(h, granter);
    await h
      .http()
      .put(url)
      .set(bearer(granter.accessToken))
      .send(body)
      .expect(200);
    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { action: 'admin_user.senior_capability_granted' },
    });
    expect(audit.actorId).toBe(granter.profileId);
    expect(audit.targetId).toBe(target.adminUserId);
    expect(audit.reason).toBe(body.reason);
  });

  it('nobody can modify their own admin account (no self-escalation)', async () => {
    const sa = await loginNewAdmin(h, 'super_admin');
    const other = await loginNewAdmin(h, 'super_admin'); // so "last super admin" isn't the reason
    void other;
    await stepUp(h, sa);
    const res = await h
      .http()
      .put(`/admin/admin-users/${sa.adminUserId}/senior-capability`)
      .set(bearer(sa.accessToken))
      .send({ enabled: true, reason: 'self grant attempt' })
      .expect(403);
    expect(res.body.code).toBe('SELF_MODIFICATION_FORBIDDEN');
  });

  it('senior capability cannot be given to a plain admin', async () => {
    const sa = await loginNewAdmin(h, 'super_admin');
    const plain = await loginNewAdmin(h, 'admin');
    await stepUp(h, sa);
    await h
      .http()
      .put(`/admin/admin-users/${plain.adminUserId}/senior-capability`)
      .set(bearer(sa.accessToken))
      .send({ enabled: true, reason: 'should not be possible' })
      .expect(400);
  });

  // The "last active super_admin" guard in AdminAccountsService is defense in depth: via the
  // API the caller is always another active super_admin, so the realistic lock-out risk is
  // an admin disabling or demoting THEMSELVES — which is refused outright.
  it('a super_admin cannot disable or demote themselves', async () => {
    const sa = await loginNewAdmin(h, 'super_admin');
    await stepUp(h, sa);
    for (const [path, body] of [
      ['status', { status: 'disabled', reason: 'self disable attempt' }],
      ['role', { role: 'admin', reason: 'self demote attempt' }],
    ] as const) {
      const res = await h
        .http()
        .put(`/admin/admin-users/${sa.adminUserId}/${path}`)
        .set(bearer(sa.accessToken))
        .send(body)
        .expect(403);
      expect(res.body.code).toBe('SELF_MODIFICATION_FORBIDDEN');
    }
  });

  it('role changes are super_admin-only, step-up protected, audited, and end the target’s sessions', async () => {
    const sa = await loginNewAdmin(h, 'super_admin');
    const target = await loginNewAdmin(h, 'admin');
    await stepUp(h, sa);
    await h
      .http()
      .put(`/admin/admin-users/${target.adminUserId}/role`)
      .set(bearer(sa.accessToken))
      .send({ role: 'senior_reviewer', reason: 'promoted after training' })
      .expect(200);
    // The target's existing session was revoked → must sign in again under the new role.
    await h
      .http()
      .get('/admin/dashboard')
      .set(bearer(target.accessToken))
      .expect(401);
    const row = await h.prisma.auditLog.findFirstOrThrow({
      where: {
        action: 'admin_user.role_changed',
        targetId: target.adminUserId,
      },
    });
    expect(row.before).toMatchObject({ role: 'admin' });
    expect(row.after).toMatchObject({ role: 'senior_reviewer' });
  });

  it('legacy admin API: a user without an admin record gets 403; an admin-role user can read the queue', async () => {
    const seeker = await createProfile(h.prisma, { role: 'seeker' });
    await h
      .http()
      .get('/legacy-admin/listings/queue')
      .set(bearer(userToken(h.app, seeker)))
      .expect(403);
    const legacy = await createProfile(h.prisma, { role: 'admin' });
    await h.prisma.adminUser.create({
      data: { profileId: legacy.id, role: 'admin' },
    });
    await h
      .http()
      .get('/legacy-admin/listings/queue')
      .set(bearer(userToken(h.app, legacy)))
      .expect(200);
  });

  it('profiles.role = admin WITHOUT an active admin_users row grants nothing', async () => {
    const stale = await createProfile(h.prisma, { role: 'admin' });
    await h
      .http()
      .get('/legacy-admin/listings/queue')
      .set(bearer(userToken(h.app, stale)))
      .expect(403);
  });
});
