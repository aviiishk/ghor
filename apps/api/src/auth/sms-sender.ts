import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export const SMS_SENDER = Symbol('SMS_SENDER');

export interface SmsSender {
  // Throws ServiceUnavailableException when codes cannot be delivered.
  sendOtp(phone: string, code: string): Promise<void>;
}

// The only SmsSender today. Production SMS delivery is NOT implemented (no DLT-registered
// provider has been chosen — audit F-02 / CLAUDE.md §5), so:
//  - production without SMS_API_URL → 503 (never log codes in production);
//  - SMS_API_URL set → 503 "not implemented" (don't build against a guessed provider API);
//  - development → the code is logged server-side, never returned in a response.
// Replace this provider with a real implementation once the provider exists; tests
// override SMS_SENDER with a capturing fake.
@Injectable()
export class DevLogSmsSender implements SmsSender {
  private readonly logger = new Logger('SMS');

  sendOtp(phone: string, code: string): Promise<void> {
    if (process.env.SMS_API_URL) {
      throw new ServiceUnavailableException(
        'SMS delivery is not implemented yet',
      );
    }
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Phone login is temporarily unavailable',
      );
    }
    // Browser (Playwright) e2e tests: write the code to a file instead of the log.
    // Test-only; main.ts refuses to start in production when this variable is set.
    const sinkDir = process.env.SMS_TEST_SINK_DIR;
    if (sinkDir) {
      mkdirSync(sinkDir, { recursive: true });
      writeFileSync(join(sinkDir, `${phone.replace(/[^0-9]/g, '')}.txt`), code);
      return Promise.resolve();
    }
    this.logger.warn(`[DEV-ONLY, no SMS provider] OTP for ${phone}: ${code}`);
    return Promise.resolve();
  }
}
