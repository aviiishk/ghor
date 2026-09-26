// Single source for the contact/entity details the legal pages print. These are NOT
// confirmed yet — the founder must set real values (and ideally have a lawyer read both
// pages) before Play Store submission. Kept in one place so that's a one-file change.
export const LEGAL = {
  lastUpdated: '25 September 2026',
  // TODO(founder): confirm this mailbox exists before launch.
  contactEmail: 'support@ghor.co.in',
  // IT Rules 2021 / DPDP Act 2023 expect a named grievance officer. TODO(founder).
  grievanceOfficer: 'To be named before public launch',
  // TODO(founder): replace with the registered entity once one exists (root CLAUDE.md §7.2).
  operator: 'GHOR, Guwahati, Assam, India',
};
