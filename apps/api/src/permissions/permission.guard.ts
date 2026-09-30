import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ADMIN_SELF_KEY, PERMISSIONS_KEY } from './decorators';
import type { Permission } from './permissions';
import { grantedPermissions, type Principal } from '../auth/principal';

// The authoritative authorization check for admin and legacy-admin routes. Runs after the
// authentication guard (which sets req.user). Fails CLOSED: a route with no declared
// permission is denied, never allowed by omission.
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      targets,
    );
    const selfService = this.reflector.getAllAndOverride<boolean | undefined>(
      ADMIN_SELF_KEY,
      targets,
    );
    const principal = context
      .switchToHttp()
      .getRequest<Request & { user?: Principal }>().user;

    if (!principal) throw new UnauthorizedException();

    if (required?.length) {
      const granted = grantedPermissions(principal);
      const missing = required.filter((p) => !granted.has(p));
      if (missing.length) {
        throw new ForbiddenException({
          message: 'You do not have permission to perform this action',
          code: 'FORBIDDEN_PERMISSION',
          missing,
        });
      }
      return true;
    }
    if (selfService && principal.kind === 'admin') return true;

    throw new ForbiddenException({
      message: 'This endpoint declares no permission',
      code: 'PERMISSION_NOT_DECLARED',
    });
  }
}

// Service-level assertion for endpoints whose required permission depends on the input
// (e.g. POST /admin/listings/:id/decision: approve needs listings.approve, reject needs
// listings.reject). The route still declares its baseline permission via the decorator.
export function assertPermission(
  principal: Principal,
  permission: Permission,
): void {
  if (!grantedPermissions(principal).has(permission)) {
    throw new ForbiddenException({
      message: 'You do not have permission to perform this action',
      code: 'FORBIDDEN_PERMISSION',
      missing: [permission],
    });
  }
}
