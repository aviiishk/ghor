import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { AdminAuthConfig } from './admin-auth.config';
import {
  ADMIN_AUDIENCE,
  ADMIN_PRE_AUDIENCE,
  ADMIN_TOKEN_ISSUER,
  AdminSessionsService,
} from './admin-sessions.service';
import type { AdminPrePrincipal, AdminPrincipal } from '../auth/principal';

interface AdminTokenPayload {
  sub: string;
  sid: string;
  typ: string;
}

// Background polling (dashboard refresh) sends this header so it doesn't count as
// activity — otherwise an open tab would keep an idle session alive until the 12 h cap.
export const BACKGROUND_HEADER = 'x-admin-background';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    config: AdminAuthConfig,
    private readonly sessions: AdminSessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.accessSecret,
      audience: ADMIN_AUDIENCE,
      issuer: ADMIN_TOKEN_ISSUER,
      algorithms: ['HS256'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: AdminTokenPayload,
  ): Promise<AdminPrincipal> {
    if (payload.typ !== 'access' || !payload.sid)
      throw new UnauthorizedException();
    return this.sessions.validateAccess(
      payload.sid,
      payload.sub,
      req.headers[BACKGROUND_HEADER] === '1',
    );
  }
}

@Injectable()
export class AdminPreStrategy extends PassportStrategy(Strategy, 'admin-pre') {
  constructor(
    config: AdminAuthConfig,
    private readonly sessions: AdminSessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.accessSecret,
      audience: ADMIN_PRE_AUDIENCE,
      issuer: ADMIN_TOKEN_ISSUER,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: AdminTokenPayload): Promise<AdminPrePrincipal> {
    if (payload.typ !== 'pre' || !payload.sid)
      throw new UnauthorizedException();
    return this.sessions.validatePre(payload.sid, payload.sub);
  }
}

@Injectable()
export class AdminJwtGuard extends AuthGuard('admin-jwt') {}

@Injectable()
export class AdminPreGuard extends AuthGuard('admin-pre') {}
