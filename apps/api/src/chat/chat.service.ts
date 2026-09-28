import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { EventsService } from '../events/events.service';
import { ListMessagesDto } from './dto/list-messages.dto';

const PARTY_SELECT = {
  id: true,
  fullName: true,
  phoneVerified: true,
} satisfies Prisma.ProfileSelect;

const CONVERSATION_INCLUDE = {
  // Cover photo included (2026-09-26) so chat screens can show which listing a thread is
  // about — the single most important piece of context in a rental conversation.
  listing: {
    select: {
      id: true,
      title: true,
      rent: true,
      city: true,
      locality: true,
      images: { orderBy: { position: 'asc' }, take: 1, select: { cloudinaryUrl: true } },
    },
  },
  seeker: { select: PARTY_SELECT },
  owner: { select: PARTY_SELECT },
} satisfies Prisma.ConversationInclude;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly events: EventsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Get-or-create — root CLAUDE.md §6: unique on (listingId, seekerId), so
  // re-contacting the same listing always reuses the same thread.
  // ---------------------------------------------------------------------------

  async getOrCreateConversation(seekerId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, ownerId: true, status: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.ownerId === seekerId) {
      throw new BadRequestException('You cannot start a conversation on your own listing');
    }

    const existing = await this.prisma.conversation.findUnique({
      where: { listingId_seekerId: { listingId, seekerId } },
      include: CONVERSATION_INCLUDE,
    });
    // An existing thread stays reachable whatever the listing's status now (a seeker can
    // still talk to the owner after it's marked rented) ...
    if (existing) return existing;

    // ... but a NEW conversation needs a live listing (code review 2026-09-26): before,
    // anyone holding a draft/pending/rejected listing's id could open a thread — which
    // returns the listing's details — and message its owner. 404, not 403, like findOne().
    if (listing.status !== 'approved') throw new NotFoundException('Listing not found');

    return this.prisma.conversation.create({
      data: { listingId, seekerId, ownerId: listing.ownerId },
      include: CONVERSATION_INCLUDE,
    });
  }

  // ---------------------------------------------------------------------------
  // List — every conversation the caller participates in, either side.
  // ---------------------------------------------------------------------------

  async listConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ seekerId: userId }, { ownerId: userId }] },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      include: {
        ...CONVERSATION_INCLUDE,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        // Unread = messages from the OTHER participant not yet read (readAt is set when
        // the recipient opens the thread — see getMessages()).
        _count: { select: { messages: { where: { readAt: null, senderId: { not: userId } } } } },
      },
    });
    return conversations.map(({ messages, _count, ...rest }) => ({
      ...rest,
      lastMessage: messages[0] ?? null,
      unreadCount: _count.messages,
    }));
  }

  // ---------------------------------------------------------------------------
  // Messages — cursor-paginated, newest-first (client reverses for display), same
  // pattern as ListingsService.findApproved (root CLAUDE.md §14.3/§14.4).
  // ---------------------------------------------------------------------------

  async getMessages(userId: string, conversationId: string, query: ListMessagesDto) {
    await this.assertParticipant(userId, conversationId);
    const limit = query.limit ?? 30;

    // Opening the thread (first page) marks the other side's messages as read — the
    // minimal read state behind the unread badges. Not read *receipts* (root CLAUDE.md §3
    // defers those); nothing is shown to the sender.
    if (!query.cursor) {
      await this.prisma.message.updateMany({
        where: { conversationId, senderId: { not: userId }, readAt: null },
        data: { readAt: new Date() },
      });
    }

    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
  }

  // ---------------------------------------------------------------------------
  // Send — persists the message, bumps lastMessageAt, and writes a Notification
  // for the recipient. Called from both the REST controller (fallback/initial
  // send) and ChatGateway's 'message:send' handler, so this is the one place the
  // side effects live — root CLAUDE.md §14.5: "server-side, in the same request
  // that persists the message," not a client-triggered notify.
  // ---------------------------------------------------------------------------

  async sendMessage(userId: string, conversationId: string, body: string) {
    const conversation = await this.assertParticipant(userId, conversationId);
    const recipientId =
      conversation.seekerId === userId ? conversation.ownerId : conversation.seekerId;

    // chat_started = the seeker's first message in this thread (a conversation row alone
    // is created on the "Chat with Owner" tap, before anything is said).
    const isFirstSeekerMessage =
      userId === conversation.seekerId &&
      !(await this.prisma.message.findFirst({
        where: { conversationId, senderId: userId },
        select: { id: true },
      }));

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId: userId, body },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    // Fire-and-forget, same pattern as the listing-view event — must never block or
    // fail the send it's riding along on. This is the durable in-app record root
    // CLAUDE.md's notifications table describes.
    // The payload names the sender and the home so the notification centre can say who
    // wrote about what (RC QA 2026-09-28) — payload is JSON, so no schema change.
    Promise.all([
      this.prisma.profile.findUnique({
        where: { id: userId },
        select: { fullName: true },
      }),
      this.prisma.listing.findUnique({
        where: { id: conversation.listingId },
        select: { title: true },
      }),
    ])
      .then(([sender, listing]) =>
        this.prisma.notification.create({
          data: {
            userId: recipientId,
            type: 'new_message',
            payload: {
              conversationId,
              listingId: conversation.listingId,
              senderName: sender?.fullName ?? null,
              listingTitle: listing?.title ?? null,
            },
          },
        }),
      )
      .catch(() => {});

    // Root CLAUDE.md §7.7: "reliable Expo push on every message... critical now that
    // WhatsApp is gone" — the actual delivery half, on top of the in-app record above.
    // No-ops silently if the recipient has no registered device (still true for almost
    // everyone until apps/mobile actually calls POST /push-tokens).
    this.push
      .sendToUser(recipientId, {
        title: 'New message',
        body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
        data: { type: 'new_message', conversationId },
      })
      .catch(() => {});

    if (isFirstSeekerMessage) {
      this.events.record(userId, 'chat_started', {
        listingId: conversation.listingId,
        conversationId,
      });
    }

    return message;
  }

  async assertParticipant(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.seekerId !== userId && conversation.ownerId !== userId) {
      throw new ForbiddenException('Not a participant in this conversation');
    }
    return conversation;
  }
}
