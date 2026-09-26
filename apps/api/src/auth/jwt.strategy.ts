import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  role: string;
}

export interface AuthenticatedUser {
  userId: string;
  role: string;
}

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
    // One write per authenticated request, doing two jobs:
    // 1. Trust feature (root CLAUDE.md §2): last_active_at drives "Active X days ago".
    // 2. Liveness check: a signed access token outlives its account for up to its 15-min
    //    TTL. Without this, a deleted account's still-valid token hit findUniqueOrThrow()
    //    and 500'd (found live 2026-09-25), and a banned user kept full access until
    //    expiry. updateMany (not update) so "no such active profile" is a count of 0, not
    //    a thrown Prisma error.
    const { count } = await this.prisma.profile.updateMany({
      where: { id: payload.sub, banned: false },
      data: { lastActiveAt: new Date() },
    });
    if (count === 0) throw new UnauthorizedException();

    return { userId: payload.sub, role: payload.role };
  }
}
