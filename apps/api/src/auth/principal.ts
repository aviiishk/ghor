import type { AdminRole } from '@prisma/client';
import { permissionsFor, type Permission } from '../permissions/permissions';

// A marketplace user authenticated with a user-audience token (web/mobile). If the same
// person also holds an active AdminUser record, adminRole is set — that only matters for
// the legacy /legacy-admin/* routes (D-46 transition); the new console never accepts a
// user token.
export interface UserPrincipal {
  kind: 'user';
  userId: string;
  role: string;
  adminRole: AdminRole | null;
  seniorCapability: boolean;
}

// An admin authenticated through the admin console (aud=admin token + live, MFA-completed
// admin session). Role/capability come from the database on every request, not the token.
export interface AdminPrincipal {
  kind: 'admin';
  adminUserId: string;
  profileId: string;
  sessionId: string;
  role: AdminRole;
  seniorCapability: boolean;
  stepUpAt: Date | null;
}

// A pre-MFA admin session (phone OTP passed, TOTP not yet verified / enrollment pending).
// Accepted only by the enrollment/verification endpoints.
export interface AdminPrePrincipal {
  kind: 'admin_pre';
  adminUserId: string;
  profileId: string;
  sessionId: string;
  state: 'pending_mfa' | 'reenroll_required';
}

export type Principal = UserPrincipal | AdminPrincipal | AdminPrePrincipal;

export function grantedPermissions(
  principal: Principal | undefined,
): ReadonlySet<Permission> {
  if (!principal) return new Set();
  if (principal.kind === 'admin')
    return permissionsFor(principal.role, principal.seniorCapability);
  if (principal.kind === 'user')
    return permissionsFor(principal.adminRole, principal.seniorCapability);
  return new Set();
}

export function hasPermission(
  principal: Principal | undefined,
  permission: Permission,
): boolean {
  return grantedPermissions(principal).has(permission);
}

// The id of the human behind a principal, as stored in audit rows (profile id).
export function actorProfileId(principal: Principal): string {
  return principal.kind === 'user' ? principal.userId : principal.profileId;
}

export function actorRoleLabel(principal: Principal): string {
  if (principal.kind === 'admin') {
    return principal.seniorCapability
      ? `${principal.role}+senior`
      : principal.role;
  }
  if (principal.kind === 'user')
    return principal.adminRole
      ? `legacy:${principal.adminRole}`
      : principal.role;
  return 'admin_pre';
}
