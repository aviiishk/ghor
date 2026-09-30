import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { authenticator } from 'otplib';
import type { AdminRole, ListingStatus, Prisma } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Clock } from '../../src/common/clock';
import { SMS_SENDER, type SmsSender } from '../../src/auth/sms-sender';

// Deterministic time for session expiry, step-up windows, TOTP steps and auto-approval.
export class TestClock extends Clock {
  offsetMs = 0;
  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }
  advance(ms: number) {
    this.offsetMs += ms;
  }
}

// Captures OTP codes instead of sending SMS.
export class FakeSms implements SmsSender {
  readonly codes = new Map<string, string>();
  async sendOtp(phone: string, code: string) {
    this.codes.set(phone, code);
  }
}

export interface Harness {
  app: INestApplication;
  prisma: PrismaService;
  clock: TestClock;
  sms: FakeSms;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

export async function createHarness(): Promise<Harness> {
  const clock = new TestClock();
  const sms = new FakeSms();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Clock)
    .useValue(clock)
    .overrideProvider(SMS_SENDER)
    .useValue(sms)
    .compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app);
  await app.init();
  const prisma = app.get(PrismaService);
  return {
    app,
    prisma,
    clock,
    sms,
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
  };
}

// Every table except Prisma's migration ledger. TRUNCATE is not blocked by the audit_log
// append-only trigger (row-level UPDATE/DELETE are) — test-only reset.
export async function resetDatabase(prisma: PrismaService) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

let phoneSeq = 1000;
export const nextPhone = () => `+9198${String(++phoneSeq).padStart(8, '0')}`;

export async function createProfile(
  prisma: PrismaService,
  data: Partial<Prisma.ProfileCreateInput> = {},
) {
  return prisma.profile.create({
    data: {
      phone: nextPhone(),
      phoneVerified: true,
      fullName: 'Test Person',
      role: 'owner',
      ...data,
    },
  });
}

export function userToken(
  app: INestApplication,
  profile: { id: string; role: string },
) {
  return app
    .get(JwtService)
    .sign(
      { sub: profile.id, role: profile.role, aud: 'user' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 },
    );
}

export const IMG = (n: number) =>
  `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/v1/ghor/listings/test-${n}.jpg`;

export async function createListing(
  prisma: PrismaService,
  ownerId: string,
  opts: {
    status?: ListingStatus;
    photos?: number;
    autoApproveAt?: Date | null;
    submittedAt?: Date | null;
  } = {},
) {
  const photos = opts.photos ?? 3;
  return prisma.listing.create({
    data: {
      ownerId,
      title: 'Bright room near campus',
      propertyType: 'room',
      rent: 7000,
      locality: 'Jalukbari',
      status: opts.status ?? 'pending',
      submittedAt:
        opts.submittedAt ??
        (opts.status === 'pending' || !opts.status ? new Date() : null),
      autoApproveAt: opts.autoApproveAt ?? null,
      images: {
        create: Array.from({ length: photos }, (_, i) => ({
          cloudinaryUrl: IMG(i),
          position: i,
        })),
      },
    },
  });
}

export interface AdminSession {
  adminUserId: string;
  profileId: string;
  phone: string;
  secret: string;
  accessToken: string;
  refreshToken: string;
  recoveryCodes: string[];
}

export async function createAdminAccount(
  h: Harness,
  role: AdminRole,
  opts: { seniorCapability?: boolean; phone?: string } = {},
) {
  const profile = await createProfile(h.prisma, {
    role: 'admin',
    phone: opts.phone ?? nextPhone(),
  });
  const admin = await h.prisma.adminUser.create({
    data: {
      profileId: profile.id,
      role,
      seniorCapability: opts.seniorCapability ?? false,
    },
  });
  return { profile, admin };
}

export function totpNow(h: Harness, secret: string): string {
  return authenticator
    .clone({ epoch: h.clock.now().getTime() })
    .generate(secret);
}

// Move to the next 30-second TOTP step (replay protection rejects reuse of a step).
export function nextTotp(h: Harness, secret: string): string {
  h.clock.advance(31_000);
  return totpNow(h, secret);
}

export const ADMIN_ORIGIN = 'http://admin.test';

// Drives the REAL first-login flow: OTP → TOTP enrollment → confirm (recovery codes).
export async function loginNewAdmin(
  h: Harness,
  role: AdminRole,
  opts: { seniorCapability?: boolean } = {},
): Promise<AdminSession> {
  const { profile, admin } = await createAdminAccount(h, role, opts);
  const phone = profile.phone!;
  await h.http().post('/admin/auth/otp/send').send({ phone }).expect(200);
  const verify = await h
    .http()
    .post('/admin/auth/otp/verify')
    .send({ phone, code: h.sms.codes.get(phone) })
    .expect(200);
  const pre = verify.body.preToken as string;
  const enroll = await h
    .http()
    .post('/admin/auth/totp/enroll')
    .set('Authorization', `Bearer ${pre}`)
    .expect(200);
  const secret = enroll.body.secret as string;
  const confirm = await h
    .http()
    .post('/admin/auth/totp/enroll/confirm')
    .set('Authorization', `Bearer ${pre}`)
    .send({ code: totpNow(h, secret) })
    .expect(200);
  return {
    adminUserId: admin.id,
    profileId: profile.id,
    phone,
    secret,
    accessToken: confirm.body.accessToken,
    refreshToken: confirm.body.refreshToken,
    recoveryCodes: confirm.body.recoveryCodes,
  };
}

export async function stepUp(h: Harness, s: AdminSession) {
  await h
    .http()
    .post('/admin/auth/step-up')
    .set('Authorization', `Bearer ${s.accessToken}`)
    .send({ code: nextTotp(h, s.secret) })
    .expect(200);
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
