import { CONFIG_BY_KEY, CONFIG_REGISTRY } from './config-registry';

describe('config registry (allowlist + per-key validation)', () => {
  it('every default value passes its own validator', () => {
    for (const def of CONFIG_REGISTRY)
      expect(def.validate(def.defaultValue)).toBeNull();
  });

  it('report_threshold rejects 0, negatives, non-integers and strings', () => {
    const v = CONFIG_BY_KEY.get('report_threshold')!.validate;
    expect(v(3)).toBeNull();
    for (const bad of [0, -1, 1, 2.5, '3', null]) expect(v(bad)).not.toBeNull();
  });

  it('auto-approval is OFF by default and server-only', () => {
    const def = CONFIG_BY_KEY.get('auto_approval_enabled')!;
    expect(def.defaultValue).toBe(false);
    expect(def.public).toBe(false);
  });

  it('F-04 placeholder accepts null or a bounded integer', () => {
    const v = CONFIG_BY_KEY.get('auto_approval_max_overdue_seconds')!.validate;
    expect(v(null)).toBeNull();
    expect(v(600)).toBeNull();
    expect(v(-5)).not.toBeNull();
  });

  it('only client-read keys are public', () => {
    expect(
      CONFIG_REGISTRY.filter((d) => d.public)
        .map((d) => d.key)
        .sort(),
    ).toEqual(
      [
        'FAVORITES_ENABLED',
        'PHONE_OTP_ENABLED',
        'ad_frequency',
        'page_size',
        'report_threshold',
      ].sort(),
    );
  });
});
