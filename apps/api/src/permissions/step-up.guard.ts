import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { STEP_UP_KEY } from './decorators';
import { STEP_UP_WINDOW_MS } from './permissions';
import type { Principal } from '../auth/principal';
import { Clock } from '../common/clock';

// Enforces D-47 step-up server-side: the admin session must have re-entered a TOTP code
// within the last 10 minutes. The UI may prompt for it, but this guard is the boundary.
@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly clock: Clock,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean | undefined>(
      STEP_UP_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const principal = context
      .switchToHttp()
      .getRequest<Request & { user?: Principal }>().user;
    if (!principal) throw new UnauthorizedException();
    if (principal.kind !== 'admin') {
      // Legacy (user-token) admin sessions have no TOTP and therefore can never step up.
      throw new ForbiddenException({
        message:
          'This action requires re-authentication in the GHOR admin console',
        code: 'STEP_UP_UNAVAILABLE',
      });
    }
    const fresh =
      principal.stepUpAt !== null &&
      this.clock.now().getTime() - principal.stepUpAt.getTime() <=
        STEP_UP_WINDOW_MS;
    if (!fresh) {
      throw new UnauthorizedException({
        message: 'Re-enter your authenticator code to continue',
        code: 'STEP_UP_REQUIRED',
      });
    }
    return true;
  }
}
