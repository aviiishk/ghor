import { Injectable } from '@nestjs/common';
import { createHmac, randomInt, randomUUID } from 'crypto';
import type { Db } from '../audit/audit.service';
import { Clock } from '../common/clock';
import { AdminAuthConfig } from './admin-auth.config';

export const RECOVERY_CODE_COUNT = 10;
// Crockford-style base32 without I, L, O, U: unambiguous when read off paper.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_CHARS = 10; // 10 × 5 bits = 50 bits of entropy per code

// D-47 recovery codes: 10 single-use codes, CSPRNG, shown exactly once, stored as a keyed
// hash, and every regeneration revokes all previous codes.
@Injectable()
export class RecoveryCodesService {
  constructor(
    private readonly config: AdminAuthConfig,
    private readonly clock: Clock,
  ) {}

  static normalize(code: string): string {
    return code.toUpperCase().replace(/[^0-9A-Z]/g, '');
  }

  hash(code: string): string {
    const pepper = this.config.recoveryPepper;
    if (!pepper)
      throw new Error('ADMIN_RECOVERY_CODE_PEPPER is not configured');
    return createHmac('sha256', pepper)
      .update(RecoveryCodesService.normalize(code))
      .digest('hex');
  }

  // Revokes every unused code for the admin and creates a fresh batch. Returns the
  // plaintext codes — the only time they ever exist outside the user's hands.
  async regenerate(db: Db, adminUserId: string): Promise<string[]> {
    const now = this.clock.now();
    await db.adminRecoveryCode.updateMany({
      where: { adminUserId, usedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    const batchId = randomUUID();
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      this.generateOne(),
    );
    await db.adminRecoveryCode.createMany({
      data: codes.map((code) => ({
        adminUserId,
        batchId,
        codeHash: this.hash(code),
        createdAt: now,
      })),
    });
    return codes;
  }

  async revokeAll(db: Db, adminUserId: string): Promise<void> {
    await db.adminRecoveryCode.updateMany({
      where: { adminUserId, usedAt: null, revokedAt: null },
      data: { revokedAt: this.clock.now() },
    });
  }

  async remaining(db: Db, adminUserId: string): Promise<number> {
    return db.adminRecoveryCode.count({
      where: { adminUserId, usedAt: null, revokedAt: null },
    });
  }

  private generateOne(): string {
    let raw = '';
    for (let i = 0; i < CODE_CHARS; i++)
      raw += ALPHABET[randomInt(ALPHABET.length)];
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  }
}
