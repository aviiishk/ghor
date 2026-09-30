import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuditService,
  maskPhone,
  type AuditContext,
} from '../audit/audit.service';
import { actorProfileId, type Principal } from '../auth/principal';

// Marketplace (renter/owner) account administration. Admin accounts are managed only via
// AdminAccountsService — nothing here can touch an account that holds an admin record
// (no "ban the other admins" takeover, audit T-05), and nobody can act on themselves.
@Injectable()
export class UsersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: {
    q?: string;
    role?: 'seeker' | 'owner' | 'admin';
    banned?: boolean;
    cursor?: string;
    limit?: number;
  }) {
    const limit = query.limit ?? 50;
    const where: Prisma.ProfileWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.banned !== undefined) where.banned = query.banned;
    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        // Phone search by trailing digits only — enough to find someone, without making
        // the list a phone-number lookup tool.
        ...(/^\d{4,}$/.test(q) ? [{ phone: { endsWith: q } }] : []),
      ];
    }
    const rows = await this.prisma.profile.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        fullName: true,
        phone: true,
        googleId: true,
        role: true,
        banned: true,
        createdAt: true,
        lastActiveAt: true,
        phoneVerified: true,
        adminUser: { select: { role: true, status: true } },
        _count: { select: { listings: true } },
      },
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(
      ({ phone, googleId, adminUser, ...r }) => ({
        ...r,
        phone: maskPhone(phone),
        hasGoogle: !!googleId,
        isAdmin: !!adminUser,
      }),
    );
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async detail(id: string) {
    const p = await this.prisma.profile.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        banned: true,
        createdAt: true,
        lastActiveAt: true,
        phoneVerified: true,
        idVerificationStatus: true,
        adminUser: { select: { role: true, status: true } },
        _count: { select: { listings: true, reports: true, reviews: true } },
      },
    });
    if (!p) throw new NotFoundException('User not found');
    const [listings, reportsAgainst] = await Promise.all([
      this.prisma.listing.findMany({
        where: { ownerId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          status: true,
          pausedAt: true,
          heldAt: true,
          version: true,
          createdAt: true,
        },
      }),
      this.prisma.report.count({ where: { listing: { ownerId: id } } }),
    ]);
    return {
      ...p,
      phone: maskPhone(p.phone),
      isAdmin: !!p.adminUser,
      listings,
      reportsAgainstListings: reportsAgainst,
    };
  }

  async setBanned(
    principal: Principal,
    id: string,
    input: { banned: boolean; reason: string },
    ctx: AuditContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const target = await this.assertMutableTarget(tx, principal, id);
      if (target.banned === input.banned) {
        throw new ConflictException({
          message: input.banned
            ? 'User is already banned'
            : 'User is not banned',
          code: 'NO_CHANGE',
        });
      }
      const updated = await tx.profile.update({
        where: { id },
        data: { banned: input.banned },
        select: { id: true, fullName: true, role: true, banned: true },
      });
      if (input.banned) {
        // Existing refresh tokens die immediately; access tokens die on their next
        // request (JwtStrategy re-checks `banned`).
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.record(tx, {
        category: 'admin_action',
        action: input.banned ? 'user.banned' : 'user.unbanned',
        actor: AuditService.actor(principal),
        target: { type: 'profile', id },
        reason: input.reason,
        before: { banned: target.banned },
        after: { banned: updated.banned },
        ctx,
      });
      return updated;
    });
  }

  // Marketplace side only (seeker ↔ owner). Granting or removing admin power is NOT
  // possible here — that is AdminAccountsService (roles.manage + step-up).
  async setMarketplaceRole(
    principal: Principal,
    id: string,
    input: { role: 'seeker' | 'owner'; reason?: string },
    ctx: AuditContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const target = await this.assertMutableTarget(tx, principal, id);
      if (target.role === input.role) return { id, role: target.role };
      const updated = await tx.profile.update({
        where: { id },
        data: { role: input.role },
        select: { id: true, role: true },
      });
      await this.audit.record(tx, {
        category: 'admin_action',
        action: 'user.marketplace_role_changed',
        actor: AuditService.actor(principal),
        target: { type: 'profile', id },
        reason: input.reason ?? null,
        before: { role: target.role },
        after: { role: updated.role },
        ctx,
      });
      return updated;
    });
  }

  private async assertMutableTarget(
    tx: Prisma.TransactionClient,
    principal: Principal,
    id: string,
  ) {
    if (id === actorProfileId(principal)) {
      throw new ForbiddenException({
        message: 'You cannot perform this action on your own account',
        code: 'SELF_MODIFICATION_FORBIDDEN',
      });
    }
    const target = await tx.profile.findUnique({
      where: { id },
      include: { adminUser: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.adminUser || target.role === 'admin') {
      throw new ForbiddenException({
        message: 'Admin accounts are managed from Admin users',
        code: 'ADMIN_TARGET_FORBIDDEN',
      });
    }
    return target;
  }
}
