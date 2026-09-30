import {
  applyDecorators,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { adminAllowedOrigins } from '../common/cors';
import { PermissionGuard } from '../permissions/permission.guard';
import { StepUpGuard } from '../permissions/step-up.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { AdminJwtGuard } from './admin-jwt.strategy';

// The admin API is called by the admin BFF (server-to-server, no Origin header). A request
// that DOES carry a browser Origin must come from an allowed admin origin — a marketplace
// page (or any other site) can never drive /admin/* from a victim's browser.
@Injectable()
export class AdminOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const origin = context.switchToHttp().getRequest<Request>().headers.origin;
    if (!origin) return true;
    if (adminAllowedOrigins().includes(origin.replace(/\/+$/, ''))) return true;
    throw new ForbiddenException({
      message: 'Origin not allowed',
      code: 'ORIGIN_NOT_ALLOWED',
    });
  }
}

// Every authenticated admin-console controller uses this instead of @Controller: origin
// check → admin-audience token + live MFA session → declared permission (fail closed) →
// step-up where required → per-session rate limit (strict DTO validation applies to /admin/* globally, see
// common/validation.ts).
export function AdminApi(prefix: string) {
  return applyDecorators(
    Controller(prefix ? `admin/${prefix}` : 'admin'),
    UseGuards(
      AdminOriginGuard,
      AdminJwtGuard,
      PermissionGuard,
      StepUpGuard,
      RateLimitGuard,
    ),
  );
}
