import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Funnel events (root CLAUDE.md §14.13/§15.5): signup → listing_view → contact_tap →
// chat_started, plus listing_created. Recorded server-side wherever the server can see
// the action happen; only client-only actions (a Call/Chat tap, a share) come in through
// POST /events. This is what makes §7.8's "watch contact-rate, dial the ad down"
// actually measurable.
export type EventName =
  | 'signup'
  | 'listing_view'
  | 'contact_tap'
  | 'chat_started'
  | 'listing_created'
  | 'listing_shared';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  // Fire-and-forget: analytics must never block or fail the request it rides along on.
  record(
    userId: string | null,
    eventName: EventName,
    properties?: Record<string, unknown>,
  ) {
    this.prisma.event
      .create({
        data: {
          userId,
          eventName,
          properties: properties as Prisma.InputJsonValue | undefined,
        },
      })
      .catch(() => {});
  }
}
