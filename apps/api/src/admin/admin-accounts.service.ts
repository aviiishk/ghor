import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AdminRole, AdminUser, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../common/clock';
import {
  AuditService,
  maskPhone,
  type AuditContext,
} from '../audit/audit.service';
import { AlertsService } from '../alerts/alerts.service';
import { AdminSessionsService } from '../admin-auth/admin-sessions.service';
import { RecoveryCodesService } from '../admin-auth/recovery-codes.service';
import type { AdminPrincipal } from '../auth/principal';

// Admin account management (MPB §26.5 "Admin users, roles and permissions": super_admin).
// Guards encoded here, all enforced server-side:
//  - nobody changes their own role, capability, status or TOTP through these endpoints
//    (self-escalation / self-lockout);
//  - the last active super_admin can never be demoted or disabled;
//  - the senior-reviewer capability (GHOR Verified authority) can only be held by a
//    super_admin (senior_reviewer has it inherently; admin can never have it);
//  - a super_admin's TOTP is reset only by a DIFFERENT super_admin (D-47 hierarchy);
//  - every change is audited in the same transaction; profiles.role 'admin' (the legacy
//    flag the old web UI reads) is kept in sync.
@Injectable()
export class AdminAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
    private readonly sessions: AdminSessionsService,
    private readonly codes: RecoveryCodesService,
  ) {}

  async list() {
    const rows = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        profile: { select: { fullName: true, phone: true } },
        sessions: {
          where: { revokedAt: null, state: 'active' },
          select: { lastSeenAt: true },
        },
      },
    });
    return rows.map((a) => ({
      id: a.id,
      profileId: a.profileId,
      name: a.profile.fullName,
      phone: maskPhone(a.profile.phone),
      role: a.role,
      seniorCapability: a.role === 'super_admin' && a.seniorCapability,
      status: a.status,
      totpEnrolled: !!a.totpEnrolledAt,
      totpLocked: !!(a.totpLockedUntil && a.totpLockedUntil > this.clock.now()),
      activeSessions: a.sessions.length,
      lastSeenAt: a.sessions.reduce<Date | null>(
        (m, s) => (!m || s.lastSeenAt > m ? s.lastSeenAt : m),
        null,
      ),
      createdAt: a.createdAt,
    }));
  }

  async create(
    caller: AdminPrincipal,
    input: { phone: string; role: AdminRole; reason: string },
    ctx: AuditContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findUnique({
        where: { phone: input.phone },
        include: { adminUser: true },
      });
      if (!profile) {
        throw new NotFoundException({
          message:
            'No GHOR account uses that phone number — they must sign up first',
          code: 'PROFILE_NOT_FOUND',
        });
      }
      if (profile.adminUser)
        throw new ConflictException({
          message: 'This person already has an admin account',
          code: 'ALREADY_ADMIN',
        });
      if (profile.banned)
        throw new ConflictException({
          message: 'Banned accounts cannot become admins',
          code: 'PROFILE_BANNED',
        });
      if (profile.id === caller.profileId) throw this.selfForbidden();
      const admin = await tx.adminUser.create({
        data: {
          profileId: profile.id,
          role: input.role,
          createdById: caller.profileId,
          createdAt: this.clock.now(),
        },
      });
      await tx.profile.update({
        where: { id: profile.id },
        data: { role: 'admin' },
      });
      await this.audit.record(tx, {
        category: 'admin_action',
        action: 'admin_user.created',
        actor: AuditService.actor(caller),
        target: { type: 'admin_user', id: admin.id },
        reason: input.reason,
        after: {
          role: admin.role,
          status: admin.status,
          profileId: profile.id,
        },
        ctx,
      });
      return { id: admin.id, role: admin.role, status: admin.status };
    });
  }

  async changeRole(
    caller: AdminPrincipal,
    adminUserId: string,
    input: { role: AdminRole; reason: string },
    ctx: AuditContext,
  ) {
    return this.mutate(caller, adminUserId, ctx, async (tx, target) => {
      if (target.role === input.role)
        throw new ConflictException({
          message: 'The admin already has this role',
          code: 'NO_CHANGE',
        });
      if (target.role === 'super_admin')
        await this.assertNotLastSuperAdmin(tx, target.id);
      // Leaving super_admin drops the capability flag (only a super_admin can carry it).
      const data: Prisma.AdminUserUpdateInput = {
        role: input.role,
        ...(input.role !== 'super_admin' ? { seniorCapability: false } : {}),
      };
      const updated = await tx.adminUser.update({
        where: { id: target.id },
        data,
      });
      // New permissions apply on the next request anyway (read from the DB each time);
      // ending the sessions forces a fresh, MFA-verified sign-in under the new role.
      await this.sessions.revokeAllForAdmin(tx, target.id, 'role_changed');
      return {
        action: 'admin_user.role_changed',
        reason: input.reason,
        before: {
          role: target.role,
          seniorCapability: target.seniorCapability,
        },
        after: {
          role: updated.role,
          seniorCapability: updated.seniorCapability,
        },
        result: {
          id: updated.id,
          role: updated.role,
          seniorCapability: updated.seniorCapability,
        },
      };
    });
  }

  // GHOR Verified authority for a super_admin (D-47): explicit, step-up (route), audited.
  async setSeniorCapability(
    caller: AdminPrincipal,
    adminUserId: string,
    input: { enabled: boolean; reason: string },
    ctx: AuditContext,
  ) {
    return this.mutate(caller, adminUserId, ctx, async (tx, target) => {
      if (target.role !== 'super_admin') {
        throw new BadRequestException({
          message:
            target.role === 'senior_reviewer'
              ? 'Senior reviewers already hold GHOR Verified authority'
              : 'Only a super admin can be given the senior-reviewer capability',
          code: 'CAPABILITY_NOT_APPLICABLE',
        });
      }
      if (target.seniorCapability === input.enabled)
        throw new ConflictException({
          message: 'No change',
          code: 'NO_CHANGE',
        });
      const updated = await tx.adminUser.update({
        where: { id: target.id },
        data: { seniorCapability: input.enabled },
      });
      return {
        action: input.enabled
          ? 'admin_user.senior_capability_granted'
          : 'admin_user.senior_capability_revoked',
        reason: input.reason,
        before: { seniorCapability: target.seniorCapability },
        after: { seniorCapability: updated.seniorCapability },
        result: {
          id: updated.id,
          role: updated.role,
          seniorCapability: updated.seniorCapability,
        },
      };
    });
  }

  async setStatus(
    caller: AdminPrincipal,
    adminUserId: string,
    input: { status: 'active' | 'disabled'; reason: string },
    ctx: AuditContext,
  ) {
    return this.mutate(caller, adminUserId, ctx, async (tx, target) => {
      if (target.status === input.status)
        throw new ConflictException({
          message: 'No change',
          code: 'NO_CHANGE',
        });
      if (input.status === 'disabled' && target.role === 'super_admin')
        await this.assertNotLastSuperAdmin(tx, target.id);
      const updated = await tx.adminUser.update({
        where: { id: target.id },
        data: {
          status: input.status,
          disabledAt: input.status === 'disabled' ? this.clock.now() : null,
        },
      });
      if (input.status === 'disabled') {
        await this.sessions.revokeAllForAdmin(tx, target.id, 'admin_disabled');
        const owns = await tx.listing.count({
          where: { ownerId: target.profileId },
        });
        await tx.profile.update({
          where: { id: target.profileId },
          data: { role: owns ? 'owner' : 'seeker' },
        });
      } else {
        await tx.profile.update({
          where: { id: target.profileId },
          data: { role: 'admin' },
        });
      }
      return {
        action:
          input.status === 'disabled'
            ? 'admin_user.disabled'
            : 'admin_user.enabled',
        reason: input.reason,
        before: { status: target.status },
        after: { status: updated.status },
        result: { id: updated.id, status: updated.status },
      };
    });
  }

  // D-47 recovery hierarchy: admin/senior_reviewer → reset by a super_admin; super_admin →
  // reset by a SECOND super_admin (never themselves). The bootstrap super_admin's only
  // other path is the ADMIN_PHONES break-glass (infrastructure, not this endpoint).
  async resetTotp(
    caller: AdminPrincipal,
    adminUserId: string,
    input: { reason: string },
    ctx: AuditContext,
  ) {
    return this.mutate(caller, adminUserId, ctx, async (tx, target) => {
      await tx.adminUser.update({
        where: { id: target.id },
        data: {
          totpSecretCiphertext: null,
          totpEnrolledAt: null,
          totpLastTimeStep: null,
          pendingTotpSecretCiphertext: null,
          pendingTotpCreatedAt: null,
          totpFailedAttempts: 0,
          totpLockedUntil: null,
        },
      });
      await this.codes.revokeAll(tx, target.id);
      const revoked = await this.sessions.revokeAllForAdmin(
        tx,
        target.id,
        'totp_reset',
      );
      await this.alerts.security(tx, {
        kind: 'admin_totp_reset',
        severity: 'warning',
        message:
          'An admin authenticator was reset by a super admin; re-enrollment is required at next sign-in',
        affectedProfileId: target.profileId,
        eventId: `totp-reset:${target.id}:${this.clock.now().getTime()}`,
      });
      return {
        action: 'admin.totp.reset',
        category: 'security' as const,
        reason: input.reason,
        before: { totpEnrolled: !!target.totpEnrolledAt },
        after: { totpEnrolled: false, sessionsRevoked: revoked },
        result: { id: target.id, totpEnrolled: false },
      };
    });
  }

  async revokeSessions(
    caller: AdminPrincipal,
    adminUserId: string,
    input: { reason: string },
    ctx: AuditContext,
  ) {
    return this.mutate(caller, adminUserId, ctx, async (tx, target) => {
      const revoked = await this.sessions.revokeAllForAdmin(
        tx,
        target.id,
        'revoked_by_super_admin',
      );
      return {
        action: 'admin_user.sessions_revoked',
        category: 'security' as const,
        reason: input.reason,
        after: { sessionsRevoked: revoked },
        result: { id: target.id, sessionsRevoked: revoked },
      };
    });
  }

  private async mutate<T>(
    caller: AdminPrincipal,
    adminUserId: string,
    ctx: AuditContext,
    fn: (
      tx: Prisma.TransactionClient,
      target: AdminUser,
    ) => Promise<{
      action: string;
      category?: 'admin_action' | 'security';
      reason: string;
      before?: unknown;
      after?: unknown;
      result: T;
    }>,
  ): Promise<T> {
    if (adminUserId === caller.adminUserId) throw this.selfForbidden();
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.adminUser.findUnique({
        where: { id: adminUserId },
      });
      if (!target) throw new NotFoundException('Admin not found');
      const out = await fn(tx, target);
      await this.audit.record(tx, {
        category: out.category ?? 'admin_action',
        action: out.action,
        actor: AuditService.actor(caller),
        target: { type: 'admin_user', id: target.id },
        reason: out.reason,
        before: out.before,
        after: out.after,
        ctx,
      });
      return out.result;
    });
  }

  private async assertNotLastSuperAdmin(
    tx: Prisma.TransactionClient,
    excludingId: string,
  ) {
    const others = await tx.adminUser.count({
      where: {
        role: 'super_admin',
        status: 'active',
        id: { not: excludingId },
      },
    });
    if (others === 0) {
      throw new ConflictException({
        message: 'GHOR must always have at least one active super admin',
        code: 'LAST_SUPER_ADMIN',
      });
    }
  }

  private selfForbidden() {
    return new ForbiddenException({
      message: 'You cannot change your own admin account here',
      code: 'SELF_MODIFICATION_FORBIDDEN',
    });
  }
}
