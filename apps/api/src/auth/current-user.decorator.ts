import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from './jwt.strategy';

// Usage: someHandler(@CurrentUser() user: AuthenticatedUser). Only meaningful behind
// JwtAuthGuard — req.user is whatever JwtStrategy.validate() returned.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();
    return request.user;
  },
);
