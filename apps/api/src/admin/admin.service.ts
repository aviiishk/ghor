import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  async listUsers() {
    return this.prisma.profile.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        phone: true,
        googleId: true,
        role: true,
        banned: true,
        createdAt: true,
        _count: { select: { listings: true } },
      },
    });
  }

  // The follow-up to ADMIN_PHONES bootstrap (auth.service.ts) — once at least one admin
  // exists, they promote/demote others through here instead of a direct DB update. A
  // caller can't remove their *own* admin role through this endpoint — a cheap guard
  // against accidentally locking yourself out with no other way back in (root
  // CLAUDE.md's role-escalation guard already prevents self-escalating the other
  // direction, via OnboardingDto — this is the symmetric self-*de*-escalation guard).
  async setRole(callerId: string, userId: string, role: 'seeker' | 'owner' | 'admin') {
    if (userId === callerId && role !== 'admin') {
      throw new BadRequestException('You cannot remove your own admin role');
    }
    return this.prisma.profile.update({
      where: { id: userId },
      data: { role },
      select: { id: true, fullName: true, phone: true, role: true, banned: true },
    });
  }

  async setBanned(userId: string, banned: boolean) {
    // Banning also revokes every outstanding refresh token immediately — the login
    // check (googleLogin/verifyOtp/refresh) already blocks a banned profile, but that
    // only bites on the next token refresh (up to 15 minutes later) without this. Root
    // CLAUDE.md's "blocks auth" is closer to instant with the revoke included.
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.profile.update({
        where: { id: userId },
        data: { banned },
        select: { id: true, fullName: true, phone: true, role: true, banned: true },
      });
      if (banned) {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return profile;
    });
  }

  // ---------------------------------------------------------------------------
  // App config — root CLAUDE.md §14.6, editable without a new deploy/app-store release.
  // ---------------------------------------------------------------------------

  async listConfig() {
    return this.prisma.appConfig.findMany({ orderBy: { key: 'asc' } });
  }

  async setConfig(key: string, value: unknown) {
    return this.prisma.appConfig.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
  }

  // ---------------------------------------------------------------------------
  // Analytics — funnel counts from the events table, root CLAUDE.md §14.13/§15.5.
  // ---------------------------------------------------------------------------

  async analytics() {
    const [signups, listingViews, contactTaps, chatStarted, listingsCreated] = await Promise.all([
      this.prisma.event.count({ where: { eventName: 'signup' } }),
      this.prisma.event.count({ where: { eventName: 'listing_view' } }),
      this.prisma.event.count({ where: { eventName: 'contact_tap' } }),
      this.prisma.event.count({ where: { eventName: 'chat_started' } }),
      this.prisma.event.count({ where: { eventName: 'listing_created' } }),
    ]);
    const [totalUsers, totalListings, pendingListings, openReports] = await Promise.all([
      this.prisma.profile.count(),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { status: 'pending' } }),
      this.prisma.report.count({ where: { status: 'pending' } }),
    ]);

    return {
      // Since 2026-09-25 all five are really recorded (see src/events/): signup,
      // listing_view, chat_started, listing_created server-side; contact_tap from clients
      // via POST /events. Counts before that date are missing, not zero-by-bug.
      funnel: { signups, listingViews, contactTaps, chatStarted, listingsCreated },
      totals: { totalUsers, totalListings, pendingListings, openReports },
    };
  }
}
