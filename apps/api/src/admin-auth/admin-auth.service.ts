import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import type { AdminUser } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../common/clock';
import { OtpService } from '../auth/otp.service';
import {
  AuditService,
  maskPhone,
  type AuditActor,
  type AuditContext,
  type Db,
} from '../audit/audit.service';
import { AlertsService } from '../alerts/alerts.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { permissionsFor, STEP_UP_WINDOW_MS } from '../permissions/permissions';
import type { AdminPrePrincipal, AdminPrincipal } from '../auth/principal';
import { AdminAuthConfig } from './admin-auth.config';
import {
  AdminSessionsService,
  ADMIN_TOKEN_ISSUER,
  type AdminTokenBundle,
} from './admin-sessions.service';
import { TotpService } from './totp.service';
import { RecoveryCodesService } from './recovery-codes.service';
import { openSecret, sealSecret } from './secret-box';

const TOTP_MAX_FAILURES = 5;
const TOTP_LOCK_MS = 15 * 60 * 1000;
const PENDING_ENROLLMENT_TTL_MS = 15 * 60 * 1000;
const BREAK_GLASS_AUDIENCE = 'admin-breakglass';
const BREAK_GLASS_TTL_S = 5 * 60;

const GENERIC_LOGIN_ERROR = 'Invalid or expired code';

export interface FirstFactorResult {
  mfa?: 'verify' | 'enroll';
  preToken?: string;
  breakGlassToken?: string;
}

// Admin-console authentication (D-47). Entirely separate from marketplace login:
// different endpoints, different token audience and secret, server-side sessions,
// mandatory TOTP. The marketplace login no longer knows anything about admins.
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly otp: OtpService,
    private readonly totp: TotpService,
    private readonly codes: RecoveryCodesService,
    private readonly sessions: AdminSessionsService,
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
    private readonly config: AdminAuthConfig,
    private readonly jwt: JwtService,
    private readonly limiter: RateLimitService,
  ) {}

  // ---------------------------------------------------------------------------
  // First factor: phone OTP
  // ---------------------------------------------------------------------------

  async sendOtp(phone: string, ctx: AuditContext): Promise<{ sent: true }> {
    this.ensureConfigured();
    const eligible = await this.isEligible(phone);
    // Ineligible numbers get the same response and no SMS: the endpoint can't be used to
    // discover which phone numbers belong to admins.
    if (eligible) await this.otp.send(phone);
    await this.audit.recordStandalone({
      category: 'security',
      action: eligible ? 'admin.auth.otp_sent' : 'admin.auth.otp_ineligible',
      actor: { type: 'anonymous' },
      metadata: { phone: maskPhone(phone) },
      ctx,
    });
    return { sent: true };
  }

  async verifyOtp(
    phone: string,
    code: string,
    ctx: AuditContext,
  ): Promise<FirstFactorResult> {
    this.ensureConfigured();
    const fail = async (why: string): Promise<never> => {
      await this.audit.recordStandalone({
        category: 'security',
        action: 'admin.auth.first_factor_failed',
        actor: { type: 'anonymous' },
        metadata: { phone: maskPhone(phone), why },
        ctx,
      });
      throw new UnauthorizedException({
        message: GENERIC_LOGIN_ERROR,
        code: 'INVALID_CODE',
      });
    };

    if (!(await this.isEligible(phone))) return fail('ineligible');
    try {
      await this.otp.verifyAndConsume(phone, code);
    } catch {
      return fail('otp');
    }

    const breakGlassEligible = this.config.adminPhones().includes(phone);
    let profile = await this.prisma.profile.findUnique({
      where: { phone },
      include: { adminUser: true },
    });
    if (!profile && breakGlassEligible) {
      // Bootstrap: the very first super_admin may not have a GHOR account yet.
      profile = await this.prisma.profile.create({
        data: { phone, phoneVerified: true },
        include: { adminUser: true },
      });
    }
    if (!profile || profile.banned)
      return fail(profile ? 'banned' : 'no_profile');

    const result: FirstFactorResult = {};
    if (breakGlassEligible)
      result.breakGlassToken = this.signBreakGlass(profile.id);

    const admin = profile.adminUser;
    if (admin && admin.status === 'active') {
      const enrolled = !!admin.totpEnrolledAt;
      const session = await this.sessions.createPre(
        this.prisma,
        admin.id,
        enrolled ? 'pending_mfa' : 'reenroll_required',
        'otp_totp',
        ctx,
      );
      result.mfa = enrolled ? 'verify' : 'enroll';
      result.preToken = this.sessions.signPre(admin.id, session.id);
    } else if (!breakGlassEligible) {
      return fail('not_admin');
    }

    await this.audit.recordStandalone({
      category: 'security',
      action: 'admin.auth.first_factor_ok',
      actor: {
        type: admin ? 'admin' : 'anonymous',
        id: profile.id,
        role: admin?.role ?? null,
      },
      metadata: {
        mfa: result.mfa ?? null,
        breakGlassOffered: breakGlassEligible,
      },
      ctx,
    });
    return result;
  }

  // ---------------------------------------------------------------------------
  // Break-glass (D-47): deployment-level ADMIN_PHONES → super_admin. Explicit, single-use,
  // audited, alerted, and never part of marketplace login. Always forces TOTP re-enrollment.
  // ---------------------------------------------------------------------------

  async activateBreakGlass(
    token: string,
    ctx: AuditContext,
  ): Promise<FirstFactorResult> {
    this.ensureConfigured();
    let payload: { sub: string; jti: string; typ: string };
    try {
      payload = this.jwt.verify(token, {
        secret: this.config.accessSecret,
        audience: BREAK_GLASS_AUDIENCE,
        issuer: ADMIN_TOKEN_ISSUER,
      });
    } catch {
      throw new UnauthorizedException({
        message: 'Break-glass token is invalid or expired',
        code: 'INVALID_TOKEN',
      });
    }
    if (payload.typ !== 'breakglass') throw new UnauthorizedException();
    const once = await this.limiter.hit(
      `breakglass-jti:${payload.jti}`,
      1,
      BREAK_GLASS_TTL_S * 3,
    );
    if (!once.allowed) {
      throw new UnauthorizedException({
        message: 'Break-glass token already used',
        code: 'TOKEN_USED',
      });
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: payload.sub },
      include: { adminUser: true },
    });
    if (
      !profile?.phone ||
      profile.banned ||
      !this.config.adminPhones().includes(profile.phone)
    ) {
      await this.audit.recordStandalone({
        category: 'security',
        action: 'admin.break_glass.denied',
        actor: { type: 'anonymous', id: payload.sub },
        ctx,
      });
      throw new ForbiddenException({
        message: 'Break-glass is not available for this account',
        code: 'BREAK_GLASS_DENIED',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const before = profile.adminUser;
      const clearedMfa = {
        totpSecretCiphertext: null,
        totpEnrolledAt: null,
        totpLastTimeStep: null,
        pendingTotpSecretCiphertext: null,
        pendingTotpCreatedAt: null,
        totpFailedAttempts: 0,
        totpLockedUntil: null,
      };
      const admin = await tx.adminUser.upsert({
        where: { profileId: profile.id },
        create: {
          profileId: profile.id,
          role: 'super_admin',
          status: 'active',
          createdAt: this.clock.now(),
        },
        update: {
          role: 'super_admin',
          status: 'active',
          disabledAt: null,
          ...clearedMfa,
        },
      });
      await this.codes.revokeAll(tx, admin.id);
      await this.sessions.revokeAllForAdmin(tx, admin.id, 'break_glass');
      await tx.profile.update({
        where: { id: profile.id },
        data: { role: 'admin' },
      });
      const session = await this.sessions.createPre(
        tx,
        admin.id,
        'reenroll_required',
        'break_glass',
        ctx,
      );
      await this.audit.record(tx, {
        category: 'security',
        action: 'admin.break_glass.used',
        actor: { type: 'admin', id: profile.id, role: 'break_glass' },
        target: { type: 'admin_user', id: admin.id },
        before: before
          ? {
              role: before.role,
              status: before.status,
              totpEnrolled: !!before.totpEnrolledAt,
            }
          : null,
        after: { role: 'super_admin', status: 'active', totpEnrolled: false },
        ctx,
      });
      await this.alerts.security(tx, {
        kind: 'break_glass_used',
        message: `Break-glass (ADMIN_PHONES) sign-in used for ${maskPhone(profile.phone)}; account is super_admin and must re-enroll TOTP`,
        affectedProfileId: profile.id,
        eventId: `breakglass:${session.id}`,
      });
      return {
        mfa: 'enroll',
        preToken: this.sessions.signPre(admin.id, session.id),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // TOTP enrollment / verification
  // ---------------------------------------------------------------------------

  async startEnrollment(pre: AdminPrePrincipal, ctx: AuditContext) {
    this.ensureConfigured();
    const admin = await this.loadAdmin(pre.adminUserId);
    if (admin.totpEnrolledAt && pre.state !== 'reenroll_required') {
      throw new ConflictException({
        message: 'An authenticator is already enrolled',
        code: 'ALREADY_ENROLLED',
      });
    }
    const secret = this.totp.generateSecret();
    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        pendingTotpSecretCiphertext: sealSecret(secret, this.config.totpKey!),
        pendingTotpCreatedAt: this.clock.now(),
      },
    });
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: admin.profileId },
    });
    await this.audit.recordStandalone({
      category: 'security',
      action: 'admin.totp.enrollment_started',
      actor: this.adminActor(admin),
      target: { type: 'admin_user', id: admin.id },
      ctx: { ...ctx, sessionId: pre.sessionId },
    });
    // The secret is shown only during enrollment (to scan or type in) and is never
    // retrievable after confirmation.
    return {
      otpauthUri: this.totp.uri(
        secret,
        maskPhone(profile.phone) ?? admin.id.slice(0, 8),
      ),
      secret,
    };
  }

  async confirmEnrollment(
    pre: AdminPrePrincipal,
    code: string,
    ctx: AuditContext,
  ) {
    this.ensureConfigured();
    const admin = await this.loadAdmin(pre.adminUserId);
    if (admin.totpEnrolledAt && pre.state !== 'reenroll_required') {
      throw new ConflictException({
        message: 'An authenticator is already enrolled',
        code: 'ALREADY_ENROLLED',
      });
    }
    this.assertNotLocked(admin);
    const pending = admin.pendingTotpSecretCiphertext;
    if (
      !pending ||
      !admin.pendingTotpCreatedAt ||
      this.clock.now().getTime() - admin.pendingTotpCreatedAt.getTime() >
        PENDING_ENROLLMENT_TTL_MS
    ) {
      throw new ConflictException({
        message: 'Start enrollment again',
        code: 'ENROLLMENT_EXPIRED',
      });
    }
    const step = this.totp.verify(
      openSecret(pending, this.config.totpKey!),
      code,
      null,
    );
    if (step === null) {
      await this.registerFailure(admin, ctx, 'enroll');
      throw new UnauthorizedException({
        message: 'Incorrect code',
        code: 'INVALID_TOTP',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.adminUser.updateMany({
        where: { id: admin.id, pendingTotpSecretCiphertext: pending },
        data: {
          totpSecretCiphertext: pending,
          totpEnrolledAt: this.clock.now(),
          totpLastTimeStep: step,
          pendingTotpSecretCiphertext: null,
          pendingTotpCreatedAt: null,
          totpFailedAttempts: 0,
          totpLockedUntil: null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          message: 'Start enrollment again',
          code: 'ENROLLMENT_EXPIRED',
        });
      }
      const recoveryCodes = await this.codes.regenerate(tx, admin.id);
      const tokens = await this.sessions.activate(tx, pre.sessionId);
      const actor = this.adminActor(admin);
      const sctx = { ...ctx, sessionId: pre.sessionId };
      await this.audit.record(tx, {
        category: 'security',
        action: 'admin.totp.enrolled',
        actor,
        target: { type: 'admin_user', id: admin.id },
        ctx: sctx,
      });
      await this.audit.record(tx, {
        category: 'security',
        action: 'admin.recovery_codes.generated',
        actor,
        target: { type: 'admin_user', id: admin.id },
        metadata: { count: recoveryCodes.length, reason: 'enrollment' },
        ctx: sctx,
      });
      await this.audit.record(tx, {
        category: 'security',
        action: 'admin.login',
        actor,
        target: { type: 'admin_session', id: pre.sessionId },
        metadata: { method: 'totp_enrollment' },
        ctx: sctx,
      });
      return { ...tokens, recoveryCodes };
    });
  }

  async verifyTotp(
    pre: AdminPrePrincipal,
    code: string,
    ctx: AuditContext,
  ): Promise<AdminTokenBundle> {
    this.ensureConfigured();
    if (pre.state !== 'pending_mfa') {
      throw new ConflictException({
        message: 'Authenticator enrollment is required first',
        code: 'ENROLLMENT_REQUIRED',
      });
    }
    const admin = await this.loadAdmin(pre.adminUserId);
    this.assertNotLocked(admin);
    const step = this.checkTotp(admin, code);
    if (step === null) {
      await this.registerFailure(admin, ctx, 'login');
      throw new UnauthorizedException({
        message: 'Incorrect code',
        code: 'INVALID_TOTP',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      await this.consumeStep(tx, admin.id, step);
      const tokens = await this.sessions.activate(tx, pre.sessionId);
      await this.audit.record(tx, {
        category: 'security',
        action: 'admin.login',
        actor: this.adminActor(admin),
        target: { type: 'admin_session', id: pre.sessionId },
        metadata: { method: 'totp' },
        ctx: { ...ctx, sessionId: pre.sessionId },
      });
      return tokens;
    });
  }

  // ---------------------------------------------------------------------------
  // Recovery codes
  // ---------------------------------------------------------------------------

  // Sign-in with a recovery code (D-47): the code is burned, a security event + alert +
  // notifications are raised, the authenticator and all remaining codes are invalidated,
  // every other session of this admin is ended, and this session can only re-enroll.
  async useRecoveryCode(
    pre: AdminPrePrincipal,
    code: string,
    ctx: AuditContext,
  ): Promise<{ mfa: 'enroll' }> {
    this.ensureConfigured();
    if (pre.state !== 'pending_mfa') {
      throw new ConflictException({
        message: 'Authenticator enrollment is required first',
        code: 'ENROLLMENT_REQUIRED',
      });
    }
    const admin = await this.loadAdmin(pre.adminUserId);
    this.assertNotLocked(admin);
    const codeHash = this.codes.hash(code);
    const used = await this.prisma.$transaction(async (tx) => {
      const burned = await tx.adminRecoveryCode.updateMany({
        where: {
          adminUserId: admin.id,
          codeHash,
          usedAt: null,
          revokedAt: null,
        },
        data: { usedAt: this.clock.now() },
      });
      if (burned.count !== 1) return false;
      await this.codes.revokeAll(tx, admin.id);
      await tx.adminUser.update({
        where: { id: admin.id },
        data: {
          totpSecretCiphertext: null,
          totpEnrolledAt: null,
          totpLastTimeStep: null,
          totpFailedAttempts: 0,
          totpLockedUntil: null,
        },
      });
      await this.sessions.revokeAllForAdmin(
        tx,
        admin.id,
        'recovery_code_used',
        pre.sessionId,
      );
      await tx.adminSession.update({
        where: { id: pre.sessionId },
        data: { state: 'reenroll_required', method: 'recovery_code' },
      });
      await this.audit.record(tx, {
        category: 'security',
        action: 'admin.recovery_code.used',
        actor: this.adminActor(admin),
        target: { type: 'admin_user', id: admin.id },
        ctx: { ...ctx, sessionId: pre.sessionId },
      });
      await this.alerts.security(tx, {
        kind: 'recovery_code_used',
        severity: 'warning',
        message:
          'An admin signed in with a recovery code; their authenticator must be re-enrolled',
        affectedProfileId: admin.profileId,
        eventId: `recovery:${pre.sessionId}`,
      });
      return true;
    });
    if (!used) {
      await this.registerFailure(admin, ctx, 'recovery_code');
      throw new UnauthorizedException({
        message: 'Invalid recovery code',
        code: 'INVALID_RECOVERY_CODE',
      });
    }
    return { mfa: 'enroll' };
  }

  async regenerateRecoveryCodes(
    principal: AdminPrincipal,
    ctx: AuditContext,
  ): Promise<{ recoveryCodes: string[] }> {
    this.ensureConfigured();
    return this.prisma.$transaction(async (tx) => {
      const recoveryCodes = await this.codes.regenerate(
        tx,
        principal.adminUserId,
      );
      await this.audit.record(tx, {
        category: 'security',
        action: 'admin.recovery_codes.regenerated',
        actor: AuditService.actor(principal),
        target: { type: 'admin_user', id: principal.adminUserId },
        metadata: { count: recoveryCodes.length },
        ctx,
      });
      return { recoveryCodes };
    });
  }

  // ---------------------------------------------------------------------------
  // Step-up, refresh, logout, self-service
  // ---------------------------------------------------------------------------

  async stepUp(
    principal: AdminPrincipal,
    code: string,
    ctx: AuditContext,
  ): Promise<{ stepUpUntil: string }> {
    this.ensureConfigured();
    const admin = await this.loadAdmin(principal.adminUserId);
    this.assertNotLocked(admin);
    const step = this.checkTotp(admin, code);
    if (step === null) {
      await this.registerFailure(admin, ctx, 'step_up');
      throw new UnauthorizedException({
        message: 'Incorrect code',
        code: 'INVALID_TOTP',
      });
    }
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await this.consumeStep(tx, admin.id, step);
      await tx.adminSession.update({
        where: { id: principal.sessionId },
        data: { stepUpAt: now },
      });
      await this.audit.record(tx, {
        category: 'security',
        action: 'admin.step_up',
        actor: AuditService.actor(principal),
        target: { type: 'admin_session', id: principal.sessionId },
        ctx,
      });
    });
    return {
      stepUpUntil: new Date(now.getTime() + STEP_UP_WINDOW_MS).toISOString(),
    };
  }

  refresh(refreshToken: string, background: boolean, ctx: AuditContext) {
    return this.sessions.refresh(refreshToken, background, ctx);
  }

  async logout(principal: AdminPrincipal, ctx: AuditContext): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.sessions.revoke(tx, principal.sessionId, 'logout');
      await this.audit.record(tx, {
        category: 'security',
        action: 'admin.logout',
        actor: AuditService.actor(principal),
        target: { type: 'admin_session', id: principal.sessionId },
        ctx,
      });
    });
  }

  async me(principal: AdminPrincipal) {
    const [admin, session, recoveryCodesRemaining] = await Promise.all([
      this.prisma.adminUser.findUniqueOrThrow({
        where: { id: principal.adminUserId },
        include: { profile: { select: { fullName: true, phone: true } } },
      }),
      this.prisma.adminSession.findUniqueOrThrow({
        where: { id: principal.sessionId },
      }),
      this.codes.remaining(this.prisma, principal.adminUserId),
    ]);
    return {
      adminUserId: admin.id,
      profileId: admin.profileId,
      name: admin.profile.fullName,
      phone: maskPhone(admin.profile.phone),
      role: admin.role,
      seniorCapability: principal.seniorCapability,
      permissions: [
        ...permissionsFor(admin.role, principal.seniorCapability),
      ].sort(),
      session: {
        id: session.id,
        method: session.method,
        idleExpiresAt: session.idleExpiresAt,
        absoluteExpiresAt: session.absoluteExpiresAt,
        stepUpUntil: session.stepUpAt
          ? new Date(session.stepUpAt.getTime() + STEP_UP_WINDOW_MS)
          : null,
      },
      recoveryCodesRemaining,
    };
  }

  async listSessions(principal: AdminPrincipal) {
    const rows = await this.prisma.adminSession.findMany({
      where: {
        adminUserId: principal.adminUserId,
        revokedAt: null,
        state: 'active',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        method: true,
        createdAt: true,
        lastSeenAt: true,
        idleExpiresAt: true,
        absoluteExpiresAt: true,
        userAgent: true,
      },
    });
    return rows.map((r) => ({ ...r, current: r.id === principal.sessionId }));
  }

  async revokeOwnSession(
    principal: AdminPrincipal,
    sessionId: string,
    ctx: AuditContext,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const session = await tx.adminSession.findUnique({
        where: { id: sessionId },
      });
      // IDOR guard: another admin's session is indistinguishable from a missing one.
      if (!session || session.adminUserId !== principal.adminUserId) {
        throw new NotFoundException('Session not found');
      }
      await this.sessions.revoke(tx, sessionId, 'revoked_by_owner');
      await this.audit.record(tx, {
        category: 'security',
        action: 'admin.session.revoked',
        actor: AuditService.actor(principal),
        target: { type: 'admin_session', id: sessionId },
        ctx,
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private ensureConfigured() {
    if (!this.config.configured) {
      throw new ServiceUnavailableException(
        'Admin authentication is not configured on this server',
      );
    }
  }

  private async isEligible(phone: string): Promise<boolean> {
    if (this.config.adminPhones().includes(phone)) return true;
    const profile = await this.prisma.profile.findUnique({
      where: { phone },
      select: { banned: true, adminUser: { select: { status: true } } },
    });
    return (
      !!profile && !profile.banned && profile.adminUser?.status === 'active'
    );
  }

  private signBreakGlass(profileId: string): string {
    return this.jwt.sign(
      { sub: profileId, jti: randomUUID(), typ: 'breakglass' },
      {
        secret: this.config.accessSecret,
        expiresIn: BREAK_GLASS_TTL_S,
        audience: BREAK_GLASS_AUDIENCE,
        issuer: ADMIN_TOKEN_ISSUER,
      },
    );
  }

  private async loadAdmin(adminUserId: string): Promise<AdminUser> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
    });
    if (!admin || admin.status !== 'active') {
      throw new UnauthorizedException({
        message: 'Your admin session has ended — sign in again',
        code: 'SESSION_EXPIRED',
      });
    }
    return admin;
  }

  private checkTotp(admin: AdminUser, code: string): number | null {
    if (!admin.totpSecretCiphertext || !admin.totpEnrolledAt) {
      throw new ConflictException({
        message: 'Authenticator enrollment is required first',
        code: 'ENROLLMENT_REQUIRED',
      });
    }
    return this.totp.verify(
      openSecret(admin.totpSecretCiphertext, this.config.totpKey!),
      code,
      admin.totpLastTimeStep,
    );
  }

  // Atomic replay protection: only one request can consume a given (or later) time step.
  private async consumeStep(tx: Db, adminUserId: string, step: number) {
    const res = await tx.adminUser.updateMany({
      where: {
        id: adminUserId,
        OR: [{ totpLastTimeStep: null }, { totpLastTimeStep: { lt: step } }],
      },
      data: {
        totpLastTimeStep: step,
        totpFailedAttempts: 0,
        totpLockedUntil: null,
      },
    });
    if (res.count !== 1) {
      throw new UnauthorizedException({
        message: 'Incorrect code',
        code: 'INVALID_TOTP',
      });
    }
  }

  private assertNotLocked(admin: AdminUser) {
    const now = this.clock.now();
    if (admin.totpLockedUntil && admin.totpLockedUntil > now) {
      const retryAfterSeconds = Math.ceil(
        (admin.totpLockedUntil.getTime() - now.getTime()) / 1000,
      );
      throw new HttpException(
        {
          message: 'Too many incorrect codes — try again later',
          code: 'TOTP_LOCKED',
          retryAfterSeconds,
        },
        HttpStatus.LOCKED,
      );
    }
  }

  // Invalid-attempt throttling: 5 wrong TOTP/recovery codes → locked for 15 minutes,
  // audited and alerted.
  private async registerFailure(
    admin: AdminUser,
    ctx: AuditContext,
    stage: string,
  ) {
    const updated = await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { totpFailedAttempts: { increment: 1 } },
    });
    await this.audit.recordStandalone({
      category: 'security',
      action: 'admin.mfa.failed',
      actor: this.adminActor(admin),
      target: { type: 'admin_user', id: admin.id },
      metadata: { stage, failures: updated.totpFailedAttempts },
      ctx,
    });
    if (updated.totpFailedAttempts >= TOTP_MAX_FAILURES) {
      await this.prisma.$transaction(async (tx) => {
        await tx.adminUser.update({
          where: { id: admin.id },
          data: {
            totpFailedAttempts: 0,
            totpLockedUntil: new Date(
              this.clock.now().getTime() + TOTP_LOCK_MS,
            ),
          },
        });
        await this.audit.record(tx, {
          category: 'security',
          action: 'admin.mfa.locked',
          actor: this.adminActor(admin),
          target: { type: 'admin_user', id: admin.id },
          ctx,
        });
        await this.alerts.raise(tx, {
          kind: 'admin_mfa_locked',
          severity: 'warning',
          message:
            'An admin account was locked after repeated incorrect authenticator codes',
          dedupeKey: `mfa_locked:${admin.id}`,
          metadata: { adminUserId: admin.id },
        });
      });
    }
  }

  private adminActor(admin: AdminUser): AuditActor {
    return { type: 'admin', id: admin.profileId, role: admin.role };
  }
}
