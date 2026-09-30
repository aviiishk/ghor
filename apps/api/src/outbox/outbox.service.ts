import { Injectable } from '@nestjs/common';
import { Prisma, type NotificationType } from '@prisma/client';
import type { Db } from '../audit/audit.service';

export interface NotifyUserPayload {
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  push?: { title: string; body: string; data?: Record<string, unknown> };
}

export type OutboxMessage = {
  topic: 'notify.user';
  payload: NotifyUserPayload;
};

// Transactional outbox (docs/GHOR-ADMIN-API-AUDIT.md §15 rule 2). enqueue() MUST be called
// with the same transaction client as the state change it describes, so the message exists
// iff the change committed. OutboxWorker delivers it afterwards. dedupeKey makes enqueueing
// idempotent: re-running the same logical event never produces a second message.
@Injectable()
export class OutboxService {
  async enqueue(
    db: Db,
    dedupeKey: string,
    message: OutboxMessage,
  ): Promise<void> {
    await db.outboxEvent.createMany({
      data: [
        {
          topic: message.topic,
          dedupeKey,
          payload: message.payload as unknown as Prisma.InputJsonValue,
        },
      ],
      skipDuplicates: true,
    });
  }
}
