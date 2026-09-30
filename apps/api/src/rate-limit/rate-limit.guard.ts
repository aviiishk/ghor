import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RateLimitService } from './rate-limit.service';
import { clientIp } from '../common/request-context';
import type { Principal } from '../auth/principal';

export type RateLimitScope = 'ip' | 'principal' | 'phone' | 'global';

export interface RateLimitRule {
  name: string;
  scope: RateLimitScope;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMIT_KEY = 'ghor:rate-limit';
export const RateLimit = (...rules: RateLimitRule[]) =>
  SetMetadata(RATE_LIMIT_KEY, rules);

// Defaults for authenticated admin/legacy-admin routes that declare no explicit rule
// (MPB §26.6 "API requests per admin session"): generous for reads, tighter for writes.
const ADMIN_READ_DEFAULT: RateLimitRule = {
  name: 'admin-read',
  scope: 'principal',
  limit: 300,
  windowSeconds: 60,
};
const ADMIN_WRITE_DEFAULT: RateLimitRule = {
  name: 'admin-write',
  scope: 'principal',
  limit: 60,
  windowSeconds: 60,
};

// Place AFTER the authentication guard so 'principal' scope can key on the session/user.
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: Principal }>();
    const res = http.getResponse<Response>();
    let rules = this.reflector.getAllAndOverride<RateLimitRule[] | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!rules?.length) {
      if (!req.user) return true;
      rules = [req.method === 'GET' ? ADMIN_READ_DEFAULT : ADMIN_WRITE_DEFAULT];
    }

    for (const rule of rules) {
      const subject = this.subject(rule.scope, req);
      if (subject === null) continue;
      const result = await this.limiter.hit(
        `${rule.name}:${rule.scope}:${subject}`,
        rule.limit,
        rule.windowSeconds,
      );
      if (!result.allowed) {
        res.setHeader('Retry-After', String(result.retryAfterSeconds));
        throw new HttpException(
          {
            message: 'Too many requests — please wait and try again',
            code: 'RATE_LIMITED',
            retryAfterSeconds: result.retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    return true;
  }

  private subject(
    scope: RateLimitScope,
    req: Request & { user?: Principal },
  ): string | null {
    switch (scope) {
      case 'global':
        return 'all';
      case 'ip':
        return clientIp(req);
      case 'phone': {
        const phone = (req.body as { phone?: unknown } | undefined)?.phone;
        return typeof phone === 'string' && phone.length <= 20 ? phone : null;
      }
      case 'principal': {
        const p = req.user;
        if (!p) return clientIp(req);
        return p.kind === 'user' ? `u:${p.userId}` : `s:${p.sessionId}`;
      }
    }
  }
}
