// Allowlist of app_config keys (docs/GHOR-ADMIN-API-AUDIT.md T-21, API-03). Anything not
// listed here cannot be written through the API, and only `public: true` keys are ever
// served by the user-facing GET /config. Adding a key is a code change + review, on purpose.

export interface ConfigKeyDefinition {
  key: string;
  public: boolean;
  defaultValue: unknown;
  description: string;
  // Returns an error message, or null when the value is valid.
  validate: (value: unknown) => string | null;
}

const int =
  (min: number, max: number) =>
  (v: unknown): string | null =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
      ? null
      : `must be an integer between ${min} and ${max}`;

const bool = (v: unknown): string | null =>
  typeof v === 'boolean' ? null : 'must be true or false';

const intOrNull =
  (min: number, max: number) =>
  (v: unknown): string | null =>
    v === null ? null : int(min, max)(v);

export const CONFIG_REGISTRY: readonly ConfigKeyDefinition[] = [
  // --- read by clients (apps/mobile src/lib/config.ts) ---
  {
    key: 'ad_frequency',
    public: true,
    defaultValue: 1,
    description:
      'Interstitial ad frequency before contact actions (CLAUDE.md §7.8)',
    validate: int(0, 20),
  },
  {
    key: 'page_size',
    public: true,
    defaultValue: 20,
    description: 'Browse feed page size',
    validate: int(5, 50),
  },
  {
    key: 'report_threshold',
    public: true,
    defaultValue: 3,
    description:
      'Distinct open reports that return a live listing to review (held for a human)',
    validate: int(2, 50),
  },
  {
    key: 'PHONE_OTP_ENABLED',
    public: true,
    defaultValue: true,
    description: 'Client feature flag',
    validate: bool,
  },
  {
    key: 'FAVORITES_ENABLED',
    public: true,
    defaultValue: false,
    description: 'Client feature flag',
    validate: bool,
  },

  // --- server-only moderation settings ---
  {
    key: 'auto_approval_enabled',
    public: false,
    // OFF by default: D-17 decides 5-minute auto-approval, but it stays off until the
    // founder decides F-04 (overdue backlog) and switches it on deliberately. MPB §13.4
    // (never present an automatic approval as a human review) is met by the P0-11 labels
    // in apps/web and apps/mobile: "Automatically approved by GHOR" vs "Approved by GHOR".
    // Kill switch as well.
    defaultValue: false,
    description: 'Kill switch for the 5-minute auto-approval job (D-17)',
    validate: bool,
  },
  {
    key: 'auto_approval_window_seconds',
    public: false,
    defaultValue: 300,
    description:
      'Seconds from submission until auto-approval (D-17: 5 minutes)',
    validate: int(60, 3600),
  },
  {
    key: 'auto_approval_max_overdue_seconds',
    public: false,
    // Setting for OPEN founder decision F-04 (what happens to items that became due while
    // the job was off or down). null = UNRESOLVED → fail-safe: anything more than 2 minutes
    // overdue is held for a human (never auto-approved). A number = the founder's decision:
    // items overdue by more than N seconds are held; the rest are auto-approved.
    defaultValue: null,
    description:
      'F-04 (open): null = unresolved, overdue backlog is held for a human (fail-safe); N = hold items overdue by more than N seconds',
    validate: intOrNull(60, 86400),
  },
  {
    key: 'moderation_claim_ttl_seconds',
    public: false,
    defaultValue: 600,
    description:
      'Soft-lock duration of a moderation claim (MPB §26.6: 10 minutes)',
    validate: int(60, 3600),
  },
];

export const CONFIG_BY_KEY = new Map(CONFIG_REGISTRY.map((d) => [d.key, d]));
