import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { UserPrincipal } from './principal';

export interface JwtPayload {
  sub: string;
  role: string;
  aud?: string | string[];
}

// Kept as the name every marketplace controller already imports.
export type AuthenticatedUser = UserPrincipal;

// Marketplace (web/mobile) access tokens. Admin-console tokens are signed with a different
// secret AND carry aud=admin, so they fail here twice over; conversely the admin strategy
// rejects these (docs/GHOR-ADMIN-API-AUDIT.md T-07, D-47 "admin and user tokens mutually
// rejected").
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Tokens issued before 2026-09-29 carry no `aud`; anything that carries one must be a
    // user token.
    if (payload.aud !== undefined && payload.aud !== 'user') {
      throw new UnauthorizedException();
    }
    // 1. Liveness: a signed access token outlives its account for up to its 15-min TTL, so
    //    deleted/banned accounts are rejected here, per request.
    // 2. (security review 2026-09-26) The role comes from the DATABASE, not the token's
    //    claim, so a demotion or ban takes effect on the next request.
    // 3. Admin power (legacy /legacy-admin routes only) comes from an ACTIVE admin_users
    //    row, never from profiles.role.
    const profile = await this.prisma.profile.findUnique({
      where: { id: payload.sub },
      select: {
        role: true,
        banned: true,
        deletedAt: true,
        adminUser: { select: { role: true, status: true, seniorCapability: true } },
      },
    });
    if (!profile || profile.banned || profile.deletedAt) throw new UnauthorizedException();

    // Trust feature (root CLAUDE.md §2): last_active_at drives "Active X days ago".
    this.prisma.profile
      .update({
        where: { id: payload.sub },
        data: { lastActiveAt: new Date() },
      })
      .catch(() => {});

    const admin = profile.adminUser?.status === 'active' ? profile.adminUser : null;
    return {
      kind: 'user',
      userId: payload.sub,
      role: profile.role,
      adminRole: admin?.role ?? null,
      seniorCapability: admin?.seniorCapability ?? false,
    };
  }
}
