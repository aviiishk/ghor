import type { AdminRole } from '@prisma/client';

// =============================================================================
// Central permission definition — the ONLY place that maps admin roles to powers.
// Source: MPB §26.5 (RBAC) + D-47, as audited in docs/GHOR-ADMIN-API-AUDIT.md §9.
//
// Rules encoded here (do not "simplify" them away):
//  - No role is "everything". super_admin in particular does NOT get GHOR Verified
//    authority (verification.* / badge.*) — that belongs to the senior-reviewer
//    capability (D-47). A super_admin gets it only with seniorCapability = true, which is
//    itself a step-up-protected, audited assignment (AdminAccountsService).
//  - Account suspension (ban) is senior_reviewer / super_admin only (MPB §26.5).
//  - Admin management, role management, configuration and audit export are super_admin.
// =============================================================================

export const PERMISSIONS = [
  'listings.review',
  'listings.approve',
  'listings.reject',
  'listings.hold',
  'listings.pause',
  'listings.restore',
  'reports.review',
  'reviews.moderate',
  'users.view',
  'users.restrict',
  'users.suspend',
  'appeals.review',
  'verification.view',
  'verification.approve',
  'verification.reject',
  'badge.grant',
  'badge.revoke',
  'badge.suspend',
  'admin.manage',
  'roles.manage',
  'configuration.manage',
  'audit.view',
  'audit.export',
  'system.health.view',
  'system.health.ack',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const BASE_ADMIN: Permission[] = [
  'listings.review',
  'listings.approve',
  'listings.reject',
  'listings.hold',
  'listings.pause',
  'listings.restore',
  'reports.review',
  'reviews.moderate',
  'users.view',
  'users.restrict',
  'appeals.review',
  'audit.view',
  'system.health.view',
];

// GHOR Verified authority — the senior-reviewer capability.
export const SENIOR_CAPABILITY: Permission[] = [
  'verification.view',
  'verification.approve',
  'verification.reject',
  'badge.grant',
  'badge.revoke',
  'badge.suspend',
];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  admin: BASE_ADMIN,
  senior_reviewer: [...BASE_ADMIN, 'users.suspend', ...SENIOR_CAPABILITY],
  super_admin: [
    ...BASE_ADMIN,
    'users.suspend',
    'admin.manage',
    'roles.manage',
    'configuration.manage',
    'audit.export',
    'system.health.ack',
  ],
};

export function permissionsFor(
  role: AdminRole | null | undefined,
  seniorCapability = false,
): ReadonlySet<Permission> {
  if (!role) return new Set();
  const granted = new Set<Permission>(ROLE_PERMISSIONS[role]);
  // The capability flag only means something for super_admin; senior_reviewer already has
  // it and plain admin can never hold it (enforced when assigning, and ignored here).
  if (role === 'super_admin' && seniorCapability) {
    SENIOR_CAPABILITY.forEach((p) => granted.add(p));
  }
  return granted;
}

export type AuditScope = 'own' | 'own_and_trust' | 'all';

// Audit-log visibility (MPB §26.5): admin sees own actions, senior sees own + trust
// actions, super_admin sees everything.
export function auditScopeFor(role: AdminRole): AuditScope {
  if (role === 'super_admin') return 'all';
  if (role === 'senior_reviewer') return 'own_and_trust';
  return 'own';
}

// Actions that require a fresh TOTP step-up (≤ 10 minutes old), enforced by StepUpGuard
// via @RequireStepUp() on the route. Listed here so the policy is reviewable in one place.
export const STEP_UP_WINDOW_MS = 10 * 60 * 1000;
export const STEP_UP_ACTIONS = [
  'admin account create / role change / disable / enable / session revoke',
  'senior-reviewer capability (GHOR Verified authority) assignment',
  'TOTP reset of another admin',
  'recovery-code regeneration',
  'configuration change',
  'marketplace account suspension (ban / unban)',
  'bulk moderation decisions (up to 50 listings at once)',
  'audit export',
] as const;
