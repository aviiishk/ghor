// Remote tunables from apps/api's GET /config (root CLAUDE.md §14.6) — ad frequency,
// page size, feature flags — so they change without an app-store release. Rewritten
// 2026-09-25 from a leftover Supabase-direct read. Falls back to defaults on any error,
// so a config outage never blocks the app.
import { apiRequest } from './apiClient';

interface AppConfig {
  ad_frequency: number;
  page_size: number;
  report_threshold: number;
  PHONE_OTP_ENABLED: boolean;
  FAVORITES_ENABLED: boolean;
}

const defaults: AppConfig = {
  ad_frequency: 1,
  page_size: 20,
  report_threshold: 5,
  PHONE_OTP_ENABLED: true,
  FAVORITES_ENABLED: false,
};

let cache: AppConfig | null = null;

export async function getAppConfig(): Promise<AppConfig> {
  if (cache) return cache;
  try {
    const remote = await apiRequest<Partial<AppConfig>>('/config', { auth: true });
    cache = { ...defaults, ...remote };
    return cache;
  } catch {
    return defaults;
  }
}

export function clearConfigCache(): void {
  cache = null;
}
