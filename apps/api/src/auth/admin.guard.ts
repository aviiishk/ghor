import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from './jwt.strategy';

// Always pair with JwtAuthGuard (which populates req.user) — this only checks the role
// once a user is already known: `@UseGuards(JwtAuthGuard, AdminGuard)`. There is no path
// to `role: 'admin'` through onboarding (OnboardingDto structurally blocks it) — an admin
// account only exists via a direct database update by the founder.
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (request.user?.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
