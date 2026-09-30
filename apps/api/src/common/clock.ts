import { Injectable } from '@nestjs/common';

// Single source of "now" for everything time-sensitive in the admin/moderation code paths
// (session idle/absolute expiry, step-up windows, TOTP, auto-approval, claims, rate-limit
// windows). Injected rather than calling `new Date()` inline so tests can move time
// deterministically; production uses the real clock.
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
