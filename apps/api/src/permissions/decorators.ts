import { SetMetadata } from '@nestjs/common';
import type { Permission } from './permissions';

export const PERMISSIONS_KEY = 'ghor:permissions';
export const ADMIN_SELF_KEY = 'ghor:admin-self';
export const ADMIN_PUBLIC_KEY = 'ghor:admin-public';
export const ADMIN_PRE_KEY = 'ghor:admin-pre';
export const STEP_UP_KEY = 'ghor:step-up';

// Every /admin/* handler must carry exactly one of these declarations; PermissionGuard
// fails closed when none is present, and test/admin-route-metadata.e2e-spec.ts fails the
// build if a new admin route forgets one.

// All listed permissions are required.
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// Any authenticated, MFA-complete admin — for self-service endpoints (own session, own
// profile, own recovery codes) where no marketplace power is exercised.
export const AdminSelfService = () => SetMetadata(ADMIN_SELF_KEY, true);

// Unauthenticated admin-auth endpoints (OTP send/verify, refresh, break-glass).
export const AdminPublic = () => SetMetadata(ADMIN_PUBLIC_KEY, true);

// Pre-MFA endpoints (TOTP enroll/verify, recovery-code sign-in).
export const AdminPreAuth = () => SetMetadata(ADMIN_PRE_KEY, true);

// Requires a TOTP step-up within STEP_UP_WINDOW_MS.
export const RequireStepUp = () => SetMetadata(STEP_UP_KEY, true);
