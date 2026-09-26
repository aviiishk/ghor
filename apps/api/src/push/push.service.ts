import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Sends via Expo's push API directly — no SDK dependency needed, it's a plain HTTPS POST.
// EXPO_ACCESS_TOKEN is optional: Expo's push service accepts unauthenticated requests for
// basic sending; the token only buys enhanced delivery receipts/reliability at higher
// volume, not a hard requirement to send at all — so this works today, unlike SMS/email,
// without waiting on the founder for credentials.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Fire-and-forget, same posture as every other notification write in this codebase
  // (chat's Notification row, the listing-view event) — must never block or fail the
  // request it's riding along on. A user with no registered device (the overwhelmingly
  // common case right now, since no client has ever called POST /push-tokens before this
  // pass) silently no-ops rather than erroring.
  async sendToUser(userId: string, notification: PushNotification): Promise<void> {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { expoPushToken: true },
    });
    if (!tokens.length) return;

    const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');
    const messages = tokens.map((t) => ({
      to: t.expoPushToken,
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {},
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push send failed: ${res.status} ${await res.text()}`);
        return;
      }

      // Expo returns 200 for the batch call itself even when individual tokens are bad
      // — errors are per-ticket inside the body (e.g. a stale/uninstalled-app token), not
      // an HTTP status. Not auto-pruning invalid tokens yet (that's a real "not built"
      // gap, see STATUS.md) — just surfacing it so it's visible during testing instead of
      // silently swallowed.
      const result = (await res.json()) as {
        data?: { status: string; message?: string; details?: { error?: string } }[];
      };
      result.data
        ?.filter((ticket) => ticket.status === 'error')
        .forEach((ticket) => {
          this.logger.warn(
            `Expo push ticket error for user ${userId}: ${ticket.details?.error ?? ticket.message}`,
          );
        });
    } catch (err) {
      this.logger.warn(`Expo push send error: ${err instanceof Error ? err.message : err}`);
    }
  }
}
