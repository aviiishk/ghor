import { JwtService } from '@nestjs/jwt';
import {
  bearer,
  createHarness,
  createListing,
  createProfile,
  loginNewAdmin,
  resetDatabase,
  userToken,
  type Harness,
} from './helpers/harness';

// D-47: admin tokens and user tokens are mutually rejected.
describe('admin / user token separation', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
    await resetDatabase(h.prisma);
  });
  afterAll(() => h.close());

  it('USER token → admin endpoint → rejected (401)', async () => {
    const user = await createProfile(h.prisma, { role: 'owner' });
    await h
      .http()
      .get('/admin/dashboard')
      .set(bearer(userToken(h.app, user)))
      .expect(401);
  });

  it('USER token of a legacy admin (active admin_users row) → new admin endpoint → rejected', async () => {
    const legacy = await createProfile(h.prisma, { role: 'admin' });
    await h.prisma.adminUser.create({
      data: { profileId: legacy.id, role: 'super_admin' },
    });
    await h
      .http()
      .get('/admin/dashboard')
      .set(bearer(userToken(h.app, legacy)))
      .expect(401);
  });

  it('ADMIN token → user endpoint → rejected (401)', async () => {
    const admin = await loginNewAdmin(h, 'super_admin');
    await h
      .http()
      .get('/listings/mine')
      .set(bearer(admin.accessToken))
      .expect(401);
    await h.http().get('/auth/me').set(bearer(admin.accessToken)).expect(401);
    // …and the same token works on the admin API.
    await h
      .http()
      .get('/admin/dashboard')
      .set(bearer(admin.accessToken))
      .expect(200);
  });

  it('a user-audience token forged with the ADMIN secret is rejected by the admin API', async () => {
    const user = await createProfile(h.prisma);
    const forged = h.app.get(JwtService).sign(
      {
        sub: user.id,
        sid: '00000000-0000-4000-8000-000000000000',
        typ: 'access',
      },
      {
        secret: process.env.JWT_ADMIN_ACCESS_SECRET,
        audience: 'user',
        issuer: 'ghor-api',
        expiresIn: 600,
      },
    );
    await h.http().get('/admin/dashboard').set(bearer(forged)).expect(401);
  });

  it('an admin-audience token signed with the USER secret is rejected everywhere', async () => {
    const user = await createProfile(h.prisma);
    const forged = h.app
      .get(JwtService)
      .sign(
        { sub: user.id, role: 'admin', aud: 'admin' },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 600 },
      );
    await h.http().get('/listings/mine').set(bearer(forged)).expect(401);
    await h.http().get('/admin/dashboard').set(bearer(forged)).expect(401);
  });

  it('a pre-MFA token cannot call admin endpoints', async () => {
    const { adminUser } = await (async () => {
      const p = await createProfile(h.prisma, { role: 'admin' });
      const a = await h.prisma.adminUser.create({
        data: { profileId: p.id, role: 'admin' },
      });
      return { adminUser: { ...a, phone: p.phone! } };
    })();
    await h
      .http()
      .post('/admin/auth/otp/send')
      .send({ phone: adminUser.phone })
      .expect(200);
    const v = await h
      .http()
      .post('/admin/auth/otp/verify')
      .send({ phone: adminUser.phone, code: h.sms.codes.get(adminUser.phone) })
      .expect(200);
    expect(v.body.mfa).toBe('enroll');
    await h
      .http()
      .get('/admin/dashboard')
      .set(bearer(v.body.preToken))
      .expect(401);
  });

  it('admin API rejects a browser Origin that is not an admin origin', async () => {
    const admin = await loginNewAdmin(h, 'admin');
    await h
      .http()
      .get('/admin/dashboard')
      .set(bearer(admin.accessToken))
      .set('Origin', 'http://web.test')
      .expect(403);
    await h
      .http()
      .get('/admin/dashboard')
      .set(bearer(admin.accessToken))
      .set('Origin', 'http://admin.test')
      .expect(200);
  });

  it('marketplace OTP login never promotes ADMIN_PHONES (break-glass is admin-console only)', async () => {
    const phone = '+919900000001'; // listed in ADMIN_PHONES for tests
    await h.http().post('/auth/otp/send').send({ phone }).expect(201);
    const res = await h
      .http()
      .post('/auth/otp/verify')
      .send({ phone, code: h.sms.codes.get(phone) })
      .expect(201);
    const profile = await h.prisma.profile.findUniqueOrThrow({
      where: { phone },
      include: { adminUser: true },
    });
    expect(profile.role).not.toBe('admin');
    expect(profile.adminUser).toBeNull();
    // The resulting user token grants no legacy admin power either.
    await h
      .http()
      .get('/legacy-admin/listings/queue')
      .set(bearer(res.body.accessToken))
      .expect(403);
  });

  it('IDOR: an admin-role user token cannot edit or delete someone else’s listing', async () => {
    const owner = await createProfile(h.prisma);
    const listing = await createListing(h.prisma, owner.id, {
      status: 'approved',
    });
    const legacyAdmin = await createProfile(h.prisma, { role: 'admin' });
    await h.prisma.adminUser.create({
      data: { profileId: legacyAdmin.id, role: 'super_admin' },
    });
    const token = userToken(h.app, legacyAdmin);
    await h
      .http()
      .patch(`/listings/${listing.id}`)
      .set(bearer(token))
      .send({ title: 'Hijacked title' })
      .expect(403);
    await h
      .http()
      .patch(`/listings/${listing.id}`)
      .set(bearer(token))
      .send({ status: 'rented' })
      .expect(403);
    await h
      .http()
      .delete(`/listings/${listing.id}`)
      .set(bearer(token))
      .expect(403);
    const after = await h.prisma.listing.findUniqueOrThrow({
      where: { id: listing.id },
    });
    expect(after.title).toBe('Bright room near campus');
    const blocked = await h.prisma.auditLog.count({
      where: {
        action: {
          in: ['listing.admin_edit_blocked', 'listing.admin_delete_blocked'],
        },
      },
    });
    expect(blocked).toBe(3);
  });
});
