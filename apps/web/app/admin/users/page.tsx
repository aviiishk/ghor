'use client';

import { useAdminUsers, useSetUserRole } from '@/features/admin/hooks';

// Marketplace roles only. Admin roles, bans and unbans are managed in the new admin
// console (apps/admin), where they are step-up protected and audited.
const ROLES = ['seeker', 'owner'] as const;

export default function AdminUsersPage() {
  const { data: users, isLoading, isError } = useAdminUsers();
  const setRole = useSetUserRole();

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">Users</h1>

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : isError ? (
        <p className="text-muted">Couldn&apos;t load users.</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Listings</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id} className="border-t border-hairline">
                  <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">
                    {user.fullName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {user.phone ?? (user.hasGoogle ? 'Google' : '—')}
                  </td>
                  <td className="px-4 py-3">
                    {user.isAdmin || user.role === 'admin' ? (
                      <span className="text-sm capitalize text-muted">admin</span>
                    ) : (
                      <select
                        value={user.role}
                        onChange={(e) =>
                          setRole.mutate({ id: user.id, role: e.target.value as (typeof ROLES)[number] })
                        }
                        className="border border-hairline rounded-lg px-2 py-1 text-sm capitalize bg-white"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{user._count.listings}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    {user.banned ? (
                      <span className="bg-destructive-pale text-destructive-pressed text-xs font-bold rounded-full px-2.5 py-1">
                        Banned
                      </span>
                    ) : (
                      <span className="bg-success-pale text-success-deep text-xs font-bold rounded-full px-2.5 py-1">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                    Ban/unban in the admin console
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
