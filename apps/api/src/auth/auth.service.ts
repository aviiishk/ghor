import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { Profile } from '@prisma/client';
import { OnboardingDto } from './dto/onboarding.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EventsService } from '../events/events.service';
import { OtpService } from './otp.service';
import { AuditService } from '../audit/audit.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// @nestjs/jwt's `expiresIn` option types as `number | StringValue` (seconds, or a
// template-literal-constrained string like "15m") — a plain `string` read from
// ConfigService doesn't satisfy that without a cast. Converting to seconds up front
// sidesteps the cast entirely and is unambiguous at the jsonwebtoken layer either way.
function parseExpiryToSeconds(value: string): number {
  const match = /^(\d+)\s*([smhd])$/i.exec(value.trim());
  if (!match) {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : 900;
  }
  const amount = Number(match[1]);
  const unitSeconds: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  return amount * unitSeconds[match[2].toLowerCase()];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly events: EventsService,
    private readonly otp: OtpService,
    private readonly audit: AuditService,
  ) {
    this.googleClient = new OAuth2Client(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  // ---------------------------------------------------------------------------
  // Google OAuth
  // ---------------------------------------------------------------------------

  async googleLogin(idToken: string): Promise<TokenPair> {
    // Fail closed (security review 2026-09-26): with GOOGLE_CLIENT_ID unset, `audience`
    // was undefined and google-auth-library then accepts an ID token minted for ANY
    // Google OAuth client — any app's user token could create/sign in to a GHOR account.
    // Comma-separated so the Android, iOS and web client IDs can all be listed.
    const audience = (this.config.get<string>('GOOGLE_CLIENT_ID') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!audience.length) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }

    let payload: { sub: string; name?: string } | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid Google token');
    }

    let profile = await this.prisma.profile.findUnique({
      where: { googleId: payload.sub },
    });
    if (!profile) {
      profile = await this.prisma.profile.create({
        data: { googleId: payload.sub, fullName: payload.name },
      });
    }
    if (profile.banned) {
      throw new UnauthorizedException('This account has been banned');
    }

    return this.issueTokens(profile);
  }

  // ---------------------------------------------------------------------------
  // Phone OTP
  // ---------------------------------------------------------------------------

  async sendOtp(phone: string): Promise<{ sent: true }> {
    await this.otp.send(phone);
    return { sent: true };
  }

  async verifyOtp(phone: string, code: string): Promise<TokenPair> {
    await this.otp.verifyAndConsume(phone, code);

    let profile = await this.prisma.profile.findUnique({ where: { phone } });
    if (!profile) {
      profile = await this.prisma.profile.create({
        data: { phone, phoneVerified: true },
      });
    } else if (!profile.phoneVerified) {
      profile = await this.prisma.profile.update({
        where: { id: profile.id },
        data: { phoneVerified: true },
      });
    }
    // No admin promotion here any more (Phase 0, 2026-09-29): ADMIN_PHONES used to promote
    // silently on every marketplace login. It is now an explicit, audited break-glass step
    // on the admin-console login only (AdminAuthService.activateBreakGlass).
    if (profile.banned) {
      throw new UnauthorizedException('This account has been banned');
    }

    return this.issueTokens(profile);
  }

  // ---------------------------------------------------------------------------
  // First-admin bootstrap
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Token issuance / refresh / logout
  // ---------------------------------------------------------------------------

  private hashToken(token: string): string {
    // SHA-256, not bcrypt: refresh tokens are high-entropy signed JWTs, not low-entropy
    // user-chosen secrets — a fast deterministic hash is the correct, standard choice here
    // (and it's what makes an exact-match DB lookup on refresh possible at all; bcrypt's
    // per-call salt would rule that out). bcrypt stays reserved for the OTP code (OtpService),
    // which is exactly the low-entropy case it's designed for.
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(profile: Profile): Promise<TokenPair> {
    const accessToken = this.jwt.sign(
      // aud=user: admin-console tokens (aud=admin, different secret) and user tokens are
      // mutually rejected — JwtStrategy refuses anything but a user-audience token.
      { sub: profile.id, role: profile.role, aud: 'user' },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: parseExpiryToSeconds(
          this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
        ),
      },
    );
    const refreshToken = this.jwt.sign(
      { sub: profile.id, jti: randomUUID() },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: parseExpiryToSeconds(
          this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
        ),
      },
    );
    const decoded = this.jwt.decode<{ exp: number }>(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId: profile.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(
          (decoded?.exp ?? Math.floor(Date.now() / 1000) + 2592000) * 1000,
        ),
      },
    });

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke the presented token before issuing a new pair, so a leaked/reused
    // refresh token can only ever be redeemed once. The revoke IS the check (code review
    // 2026-09-26): a conditional updateMany, so of N parallel refreshes with the same
    // token exactly one flips revokedAt and the rest get count 0 → 401. The previous
    // findFirst-then-update let all of them through.
    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: payload.sub },
    });
    if (!profile || profile.banned || profile.deletedAt) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.issueTokens(profile);
  }

  async logout(refreshToken: string): Promise<{ loggedOut: true }> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { loggedOut: true };
  }

  // ---------------------------------------------------------------------------
  // Profile / onboarding
  // ---------------------------------------------------------------------------

  async getProfile(userId: string): Promise<Omit<Profile, 'idDocumentUrl'>> {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: userId },
    });
    // idDocumentUrl is sensitive (root CLAUDE.md §6) — never returned, including to the
    // owner's own profile fetch. Destructure it out rather than trusting every call site.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { idDocumentUrl, ...safe } = profile;
    return safe;
  }

  async completeOnboarding(userId: string, dto: OnboardingDto) {
    // role is already restricted to 'seeker' | 'owner' by OnboardingDto's @IsIn — 'admin'
    // is structurally unreachable *from* this endpoint, not just guarded by convention.
    const before = await this.prisma.profile.findUniqueOrThrow({
      where: { id: userId },
    });

    // But an already-admin caller going through onboarding (profiles.role = 'admin' is the
    // legacy admin flag, kept in sync with admin_users by AdminAccountsService) must not be
    // silently demoted back to whatever seeker/owner the onboarding form submits —
    // onboarding is "which side of the marketplace are you," not a role reset. Bug
    // found live 2026-08-19: promote via ADMIN_PHONES, then complete onboarding (which
    // every first-time user does immediately after verify in the real app flow) and the
    // admin role was clobbered back to 'seeker' on the very next request.
    const nextRole = before.role === 'admin' ? 'admin' : dto.role;
    // First completion only (no name yet) — onboarding can be re-submitted.
    if (!before.fullName) {
      this.events.record(userId, 'signup', { role: nextRole });
    }
    const updated = await this.prisma.profile.update({
      where: { id: userId },
      data: { fullName: dto.fullName, role: nextRole },
    });

    // idDocumentUrl is sensitive (root CLAUDE.md §6) — never returned, same as getProfile().
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { idDocumentUrl, ...profile } = updated;

    // The caller's current access token still carries the pre-onboarding role claim
    // (default 'seeker') — reissue a fresh pair whenever role actually changes, so
    // nothing downstream that trusts the JWT's role (rather than re-querying Profile)
    // can act on a stale claim. issueTokens() doesn't revoke the old refresh token; a
    // user having two valid sessions moments apart is expected, not a bug (root
    // CLAUDE.md's refresh_tokens table is already 1:many per user).
    if (before.role !== updated.role) {
      const tokens = await this.issueTokens(updated);
      return { profile, ...tokens };
    }
    return { profile, accessToken: null, refreshToken: null };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updated = await this.prisma.profile.update({
      where: { id: userId },
      data: { fullName: dto.fullName.trim() },
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { idDocumentUrl, ...profile } = updated;
    return profile;
  }

  // ---------------------------------------------------------------------------
  // Account deletion (root CLAUDE.md §15.4 — Play Store requirement)
  // ---------------------------------------------------------------------------

  // Hard delete, not anonymize: every user-owned relation on Profile is onDelete: Cascade
  // in schema.prisma (listings + their images/conversations/reports/reviews, conversations
  // on either side, messages, push/refresh tokens, notifications), and Event.userId is
  // SetNull so funnel analytics keep their counts without the identity. Known consequence:
  // the other party in a conversation loses that thread too — accepted over keeping a
  // half-deleted "Deleted user" profile around, which Play's data-deletion policy makes
  // murkier. Cloudinary image files are NOT deleted yet — only their DB rows. apps/api's
  // .env has Cloudinary admin credentials, but no destroy call is wired; see STATUS.md.
  async deleteAccount(userId: string): Promise<{ deleted: true }> {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: userId },
    });
    // A banned user deleting their account would free their phone/Google ID for a fresh
    // signup — i.e. a one-click ban evasion. Banned accounts go through the founder.
    if (profile.banned) {
      throw new ForbiddenException(
        'This account is suspended. Contact support to delete it.',
      );
    }
    // Admin accounts carry audit accountability; they are disabled through the admin
    // console, never self-deleted (the admin_users FK is also ON DELETE RESTRICT).
    const admin = await this.prisma.adminUser.findUnique({ where: { profileId: userId } });
    if (admin) {
      throw new ForbiddenException(
        'Admin accounts cannot be deleted from the app. Contact a GHOR super admin.',
      );
    }
    // P0-10: anonymise, never hard-delete. Personal data (name, phone, Google id, push
    // tokens, notification inbox, ID-document reference) is removed; the account's
    // listings are archived; everything other people or trust & safety rely on (their
    // conversations and messages, reports, reviews, moderation and audit history) stays.
    // The phone/Google id are freed, so signing up again creates a brand-new profile.
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const archived = await tx.listing.updateMany({
        where: { ownerId: userId, deletedAt: null },
        data: {
          deletedAt: now,
          autoApproveAt: null,
          claimedById: null,
          claimedAt: null,
          claimExpiresAt: null,
          version: { increment: 1 },
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.pushToken.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.profile.update({
        where: { id: userId },
        data: {
          fullName: 'Deleted user',
          phone: null,
          googleId: null,
          phoneVerified: false,
          idDocumentUrl: null,
          lastActiveAt: null,
          deletedAt: now,
        },
      });
      await this.audit.record(tx, {
        category: 'user_action',
        action: 'account.deleted',
        actor: { type: 'user', id: userId, role: profile.role },
        target: { type: 'profile', id: userId },
        metadata: { mode: 'anonymised', listingsArchived: archived.count },
      });
    });
    this.logger.log(`Account anonymised: ${userId}`);
    return { deleted: true };
  }
}
