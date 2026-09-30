'use client';

import { useOpenReports, useResolveReport } from '@/features/admin/hooks';

const CATEGORY_LABEL: Record<string, string> = {
  spam: 'Spam',
  fake: 'Fake',
  inappropriate: 'Inappropriate',
  other: 'Other',
};

export default function AdminReportsPage() {
  const { data: reports, isLoading, isError } = useOpenReports();
  const resolve = useResolveReport();

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">Reports</h1>

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : isError ? (
        <p className="text-muted">Couldn&apos;t load reports.</p>
      ) : reports && reports.length > 0 ? (
        <div className="flex flex-col gap-3">
          {reports.map((report) => (
            <div key={report.id} className="bg-white rounded-2xl p-4 shadow-card">
              <div className="flex items-center justify-between mb-2">
                <span className="bg-primary-light text-primary text-xs font-bold rounded-full px-2.5 py-1">
                  {CATEGORY_LABEL[report.reasonCategory] ?? report.reasonCategory}
                </span>
                <span className="text-muted-soft text-xs">
                  {new Date(report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <p className="text-ink font-semibold mb-1">{report.listing.title}</p>
              <p className="text-muted text-sm mb-3">{report.reason}</p>
              <p className="text-muted-soft text-xs mb-3">
                Reported by {report.reporter.fullName ?? 'a user'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => resolve.mutate({ id: report.id, action: 'dismiss' })}
                  className="border border-hairline text-ink text-sm font-semibold rounded-full px-4 py-2"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => resolve.mutate({ id: report.id, action: 'confirm' })}
                  className="bg-destructive-pressed text-white text-sm font-semibold rounded-full px-4 py-2"
                >
                  Confirm (revert to pending)
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted">No open reports.</p>
      )}
    </div>
  );
}
