import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

// Admin-console authentication settings, read once at boot. In production every value is
// mandatory and validated by assertProductionConfig() (main.ts); outside production a
// missing value disables admin sign-in (503) instead of silently using a weak default —
// except the access-token secret, which falls back to a random per-process value so a
// misconfigured dev server can never accept a forged or stale token.
@Injectable()
export class AdminAuthConfig {
  private readonly logger = new Logger(AdminAuthConfig.name);
  readonly accessSecret: string;
  readonly totpKey: Buffer | null;
  readonly recoveryPepper: string | null;

  constructor() {
    const secret = process.env.JWT_ADMIN_ACCESS_SECRET;
    if (secret && secret.length >= 32) {
      this.accessSecret = secret;
    } else {
      this.accessSecret = randomBytes(48).toString('base64');
      if (process.env.NODE_ENV !== 'test') {
        this.logger.warn(
          'JWT_ADMIN_ACCESS_SECRET is not set: admin tokens use an ephemeral secret',
        );
      }
    }
    const key = process.env.ADMIN_TOTP_ENCRYPTION_KEY
      ? Buffer.from(process.env.ADMIN_TOTP_ENCRYPTION_KEY, 'base64')
      : null;
    this.totpKey = key && key.length === 32 ? key : null;
    const pepper = process.env.ADMIN_RECOVERY_CODE_PEPPER;
    this.recoveryPepper = pepper && pepper.length >= 32 ? pepper : null;
  }

  get configured(): boolean {
    return this.totpKey !== null && this.recoveryPepper !== null;
  }

  // Deployment-level break-glass list (D-47). Read on every use so an infrastructure
  // change takes effect without a redeploy timed exactly right.
  adminPhones(): string[] {
    return (process.env.ADMIN_PHONES ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  }
}
