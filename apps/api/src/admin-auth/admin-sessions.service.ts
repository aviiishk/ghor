import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AdminSessionState } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../common/clock';
import {
  AuditService,
  type AuditContext,
  type Db,
} from '../audit/audit.service';
import { AlertsService } from '../alerts/alerts.service';
import { AdminAuthConfig } from './admin-auth.config';
import type { AdminPrePrincipal, AdminPrincipal } from '../auth/principal';

// D-47 session limits.
export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ADMIN_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
export const ADMIN_ACCESS_TOKEN_TTL_S = 10 * 60;
export const ADMIN_PRE_TTL_MS = 10 * 60 * 1000;
// Don't rewrite last_seen_at on every single request; 30 s granularity is plenty.
const SLIDE_WRITE_GRANULARITY_MS = 30 * 1000;

export const ADMIN_TOKEN_ISSUER = 'ghor-api';
export const ADMIN_AUDIENCE = 'admin';
export const ADMIN_PRE_AUDIENCE = 'admin-pre';

export interface AdminTokenBundle {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

// Server-side admin sessions (docs/GHOR-ADMIN-API-AUDIT.md §10).
//  - The admin access token is a short-lived JWT (10 min, aud=admin, own secret) that names
//    the session (sid); every request re-validates the session row, so logout, idle
//    timeout, absolute timeout, disablement and TOTP resets take effect immediately.
//  - The refresh token is 32 random bytes, stored only as SHA-256, rotated on every use.
//    Presenting an already-rotated token revokes the session (theft signal).
@Injectable()
export class AdminSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly jwt: JwtService,
    private readonly config: AdminAuthConfig,
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
  ) {}

  async createPre(
    db: Db,
    adminUserId: string,
    state: Exclude<AdminSessionState, 'active'>,
    method: 'otp_totp' | 'recovery_code' | 'break_glass',
    ctx: AuditContext,
  ) {
    const now = this.clock.now();
    return db.adminSession.create({
      data: {
        adminUserId,
        state,
        method,
        createdAt: now,
        lastSeenAt: now,
        idleExpiresAt: new Date(now.getTime() + ADMIN_PRE_TTL_MS),
        absoluteExpiresAt: new Date(now.getTime() + ADMIN_ABSOLUTE_TIMEOUT_MS),
        ipHash: ctx.ipHash,
        userAgent: ctx.userAgent,
      },
    });
  }

  signPre(adminUserId: string, sessionId: string): string {
    return this.jwt.sign(
      { sub: adminUserId, sid: sessionId, typ: 'pre' },
      {
        secret: this.config.accessSecret,
        expiresIn: ADMIN_PRE_TTL_MS / 1000,
        audience: ADMIN_PRE_AUDIENCE,
        issuer: ADMIN_TOKEN_ISSUER,
      },
    );
  }

  // Promotes a pre-MFA session to active and issues the first token pair. A completed TOTP
  // (or enrollment) at sign-in also counts as a fresh step-up.
  async activate(db: Db, sessionId: string): Promise<AdminTokenBundle> {
    const now = this.clock.now();
    const session = await db.adminSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    const refreshToken = randomBytes(32).toString('base64url');
    const idleExpiresAt = this.idleDeadline(now, session.absoluteExpiresAt);
    await db.adminSession.update({
      where: { id: sessionId },
      data: {
        state: 'active',
        mfaVerifiedAt: now,
        stepUpAt: now,
        lastSeenAt: now,
        idleExpiresAt,
        refreshTokenHash: sha256(refreshToken),
        previousRefreshTokenHash: null,
      },
    });
    return this.bundle(
      session.adminUserId,
      sessionId,
      refreshToken,
      idleExpiresAt,
      session.absoluteExpiresAt,
    );
  }

  async validateAccess(
    sessionId: string,
    adminUserId: string,
    background: boolean,
  ): Promise<AdminPrincipal> {
    const now = this.clock.now();
    const session = await this.prisma.adminSession.findUnique({
      where: { id: sessionId },
      include: {
        adminUser: { include: { profile: { select: { banned: true } } } },
      },
    });
    if (
      !session ||
      session.adminUserId !== adminUserId ||
      session.revokedAt ||
      session.state !== 'active'
    ) {
      throw this.expired();
    }
    await this.assertLive(session, now);

    if (
      !background &&
      now.getTime() - session.lastSeenAt.getTime() >= SLIDE_WRITE_GRANULARITY_MS
    ) {
      await this.prisma.adminSession.update({
        where: { id: session.id },
        data: {
          lastSeenAt: now,
          idleExpiresAt: this.idleDeadline(now, session.absoluteExpiresAt),
        },
      });
    }
    return {
      kind: 'admin',
      adminUserId: session.adminUserId,
      profileId: session.adminUser.profileId,
      sessionId: session.id,
      role: session.adminUser.role,
      seniorCapability:
        session.adminUser.role === 'super_admin' &&
        session.adminUser.seniorCapability,
      stepUpAt: session.stepUpAt,
    };
  }

  async validatePre(
    sessionId: string,
    adminUserId: string,
  ): Promise<AdminPrePrincipal> {
    const now = this.clock.now();
    const session = await this.prisma.adminSession.findUnique({
      where: { id: sessionId },
      include: {
        adminUser: { include: { profile: { select: { banned: true } } } },
      },
    });
    if (
      !session ||
      session.adminUserId !== adminUserId ||
      session.revokedAt ||
      session.state === 'active' ||
      session.idleExpiresAt <= now ||
      session.adminUser.status !== 'active' ||
      session.adminUser.profile.banned
    ) {
      throw this.expired();
    }
    return {
      kind: 'admin_pre',
      adminUserId,
      profileId: session.adminUser.profileId,
      sessionId,
      state: session.state,
    };
  }

  async refresh(
    refreshToken: string,
    background: boolean,
    ctx: AuditContext,
  ): Promise<AdminTokenBundle> {
    const now = this.clock.now();
    const hash = sha256(refreshToken);
    const session = await this.prisma.adminSession.findUnique({
      where: { refreshTokenHash: hash },
      include: {
        adminUser: { include: { profile: { select: { banned: true } } } },
      },
    });
    if (!session) {
      await this.handlePossibleReuse(hash, ctx);
      throw this.expired();
    }
    if (session.revokedAt || session.state !== 'active') throw this.expired();
    await this.assertLive(session, now);

    const next = randomBytes(32).toString('base64url');
    const idleExpiresAt = background
      ? session.idleExpiresAt
      : this.idleDeadline(now, session.absoluteExpiresAt);
    const rotated = await this.prisma.adminSession.updateMany({
      where: { id: session.id, refreshTokenHash: hash, revokedAt: null },
      data: {
        refreshTokenHash: sha256(next),
        previousRefreshTokenHash: hash,
        ...(background ? {} : { lastSeenAt: now, idleExpiresAt }),
      },
    });
    if (rotated.count !== 1) throw this.expired();
    return this.bundle(
      session.adminUserId,
      session.id,
      next,
      idleExpiresAt,
      session.absoluteExpiresAt,
    );
  }

  async revoke(db: Db, sessionId: string, reason: string): Promise<void> {
    await db.adminSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: {
        revokedAt: this.clock.now(),
        revokedReason: reason,
        refreshTokenHash: null,
      },
    });
  }

  async revokeAllForAdmin(
    db: Db,
    adminUserId: string,
    reason: string,
    exceptSessionId?: string,
  ): Promise<number> {
    const result = await db.adminSession.updateMany({
      where: {
        adminUserId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: {
        revokedAt: this.clock.now(),
        revokedReason: reason,
        refreshTokenHash: null,
      },
    });
    return result.count;
  }

  private async handlePossibleReuse(hash: string, ctx: AuditContext) {
    const reused = await this.prisma.adminSession.findUnique({
      where: { previousRefreshTokenHash: hash },
      include: { adminUser: { select: { profileId: true } } },
    });
    if (!reused || reused.revokedAt) return;
    await this.prisma.$transaction(async (tx) => {
      await this.revoke(tx, reused.id, 'refresh_token_reuse');
      await this.audit.record(tx, {
        category: 'security',
        action: 'admin.session.refresh_reuse_detected',
        actor: { type: 'anonymous' },
        target: { type: 'admin_session', id: reused.id },
        metadata: { adminUserId: reused.adminUserId },
        ctx,
      });
      await this.alerts.security(tx, {
        kind: 'admin_refresh_token_reuse',
        severity: 'warning',
        message:
          'An already-used admin refresh token was presented; the session was revoked',
        affectedProfileId: reused.adminUser.profileId,
        eventId: `reuse:${reused.id}`,
      });
    });
  }

  private async assertLive(
    session: {
      id: string;
      idleExpiresAt: Date;
      absoluteExpiresAt: Date;
      adminUser: { status: string; profile: { banned: boolean } };
    },
    now: Date,
  ) {
    let reason: string | null = null;
    if (session.absoluteExpiresAt <= now) reason = 'absolute_timeout';
    else if (session.idleExpiresAt <= now) reason = 'idle_timeout';
    else if (session.adminUser.status !== 'active') reason = 'admin_disabled';
    else if (session.adminUser.profile.banned) reason = 'profile_banned';
    if (reason) {
      await this.revoke(this.prisma, session.id, reason);
      throw this.expired();
    }
  }

  private idleDeadline(now: Date, absolute: Date): Date {
    return new Date(
      Math.min(now.getTime() + ADMIN_IDLE_TIMEOUT_MS, absolute.getTime()),
    );
  }

  private bundle(
    adminUserId: string,
    sessionId: string,
    refreshToken: string,
    idle: Date,
    absolute: Date,
  ): AdminTokenBundle {
    const accessToken = this.jwt.sign(
      { sub: adminUserId, sid: sessionId, typ: 'access' },
      {
        secret: this.config.accessSecret,
        expiresIn: ADMIN_ACCESS_TOKEN_TTL_S,
        audience: ADMIN_AUDIENCE,
        issuer: ADMIN_TOKEN_ISSUER,
      },
    );
    return {
      accessToken,
      refreshToken,
      accessExpiresAt: new Date(
        this.clock.now().getTime() + ADMIN_ACCESS_TOKEN_TTL_S * 1000,
      ).toISOString(),
      idleExpiresAt: idle.toISOString(),
      absoluteExpiresAt: absolute.toISOString(),
    };
  }

  private expired() {
    return new UnauthorizedException({
      message: 'Your admin session has ended — sign in again',
      code: 'SESSION_EXPIRED',
    });
  }
}
