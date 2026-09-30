import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { Clock } from '../common/clock';

const ISSUER = 'GHOR Admin';
const STEP_SECONDS = 30;

// RFC 6238 TOTP via otplib v12 (vetted, CommonJS; no hand-rolled HOTP/TOTP). 30-second
// steps, 6 digits, SHA-1 — Google Authenticator-compatible defaults — with ±1 step of
// tolerance for clock drift. otplib v13 was evaluated and rejected: its CommonJS entry
// requires ESM-only dependencies (@scure/base), which breaks Jest and any Node runtime
// without require(esm).
//
// Replay protection: callers pass the last accepted time step; a code whose matched step
// is not strictly later is rejected.
@Injectable()
export class TotpService {
  constructor(private readonly clock: Clock) {}

  generateSecret(): string {
    return authenticator.generateSecret(20); // 160 random bits, base32
  }

  uri(secret: string, label: string): string {
    return authenticator.keyuri(label, ISSUER, secret);
  }

  // Returns the accepted RFC 6238 time step, or null when the code is not valid now (or
  // is a replay of an already-used step).
  verify(
    secret: string,
    token: string,
    afterTimeStep: number | null,
  ): number | null {
    if (!/^\d{6}$/.test(token)) return null;
    const epoch = this.clock.now().getTime();
    const delta = authenticator
      .clone({ epoch, window: 1 })
      .checkDelta(token, secret);
    if (delta === null) return null;
    const step = Math.floor(epoch / 1000 / STEP_SECONDS) + delta;
    if (afterTimeStep !== null && step <= afterTimeStep) return null;
    return step;
  }
}
