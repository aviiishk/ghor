import {
  auditScopeFor,
  permissionsFor,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SENIOR_CAPABILITY,
} from './permissions';

describe('permission map (MPB §26.5, D-47)', () => {
  it('super_admin is NOT a superset: no GHOR Verified authority without the capability', () => {
    const superAdmin = permissionsFor('super_admin');
    for (const p of SENIOR_CAPABILITY) expect(superAdmin.has(p)).toBe(false);
    expect(superAdmin.has('admin.manage')).toBe(true);
    expect(superAdmin.has('configuration.manage')).toBe(true);
  });

  it('super_admin + senior capability gains exactly the verification/badge powers', () => {
    const plain = permissionsFor('super_admin');
    const withCap = permissionsFor('super_admin', true);
    const added = [...withCap].filter((p) => !plain.has(p)).sort();
    expect(added).toEqual([...SENIOR_CAPABILITY].sort());
  });

  it('senior_reviewer holds GHOR Verified authority but cannot manage admins or config', () => {
    const senior = permissionsFor('senior_reviewer');
    for (const p of SENIOR_CAPABILITY) expect(senior.has(p)).toBe(true);
    for (const p of [
      'admin.manage',
      'roles.manage',
      'configuration.manage',
      'audit.export',
    ] as const) {
      expect(senior.has(p)).toBe(false);
    }
  });

  it('admin can moderate but cannot suspend accounts, manage admins, verify, or export', () => {
    const admin = permissionsFor('admin');
    expect(admin.has('listings.approve')).toBe(true);
    expect(admin.has('listings.hold')).toBe(true);
    for (const p of [
      'users.suspend',
      'admin.manage',
      'roles.manage',
      'configuration.manage',
      'audit.export',
      ...SENIOR_CAPABILITY,
    ] as const) {
      expect(admin.has(p)).toBe(false);
    }
  });

  it('the capability flag is ignored for roles other than super_admin', () => {
    expect([...permissionsFor('admin', true)].sort()).toEqual(
      [...permissionsFor('admin')].sort(),
    );
  });

  it('no role holds every permission by itself (only super_admin + an explicit capability grant does)', () => {
    for (const role of Object.keys(
      ROLE_PERMISSIONS,
    ) as (keyof typeof ROLE_PERMISSIONS)[]) {
      expect(permissionsFor(role).size).toBeLessThan(PERMISSIONS.length);
    }
    expect(permissionsFor('super_admin', true).size).toBe(PERMISSIONS.length);
  });

  it('no role / null role grants nothing', () => {
    expect(permissionsFor(null).size).toBe(0);
  });

  it('audit visibility scopes', () => {
    expect(auditScopeFor('admin')).toBe('own');
    expect(auditScopeFor('senior_reviewer')).toBe('own_and_trust');
    expect(auditScopeFor('super_admin')).toBe('all');
  });
});
