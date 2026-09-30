import { Logger, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { BaseWsExceptionFilter } from '@nestjs/websockets';
import { webCorsOrigin } from '../common/cors';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';

// Same cap as SendMessageDto on the REST path — the socket path skipped DTO validation.
const MAX_MESSAGE_LENGTH = 4000;

interface SocketData {
  userId: string;
  role: string;
  // Access-token expiry (unix seconds). A socket outlives the token it connected with,
  // so every event re-checks this — see assertActive().
  exp: number;
}

function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

// One Socket.io room per conversation, not a single global channel — root CLAUDE.md
// §14.5, so a client's subscriptions stay proportional to their own active chats. No
// separate namespace at MVP; permissive CORS here matches main.ts's app.enableCors()
// (also unrestricted) — tighten both together if that ever changes.
@UseFilters(BaseWsExceptionFilter)
// Browser (web chat) connections are allowed only from the marketplace origins in
// CORS_ALLOWED_ORIGINS (never '*'); native mobile clients send no Origin. Authentication is
// still the access token checked in handleConnection.
@WebSocketGateway({ cors: { origin: webCorsOrigin, credentials: false } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chat: ChatService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // Code review 2026-09-26: the socket was only authenticated at connect time, so a
  // banned or deleted user's open socket kept sending after the ban and after the
  // 15-minute token expiry. Re-check both on every event; the client reconnects with a
  // fresh token when this disconnects it (same as any other dropped connection).
  private async assertActive(client: Socket): Promise<string> {
    const data = client.data as Partial<SocketData>;
    if (!data.userId) throw new WsException('Not authenticated');
    if (!data.exp || data.exp * 1000 <= Date.now()) {
      client.disconnect(true);
      throw new WsException('Session expired');
    }
    const active = await this.prisma.profile.count({
      where: { id: data.userId, banned: false, deletedAt: null },
    });
    if (!active) {
      client.disconnect(true);
      throw new WsException('Not authenticated');
    }
    return data.userId;
  }

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth as { token?: string } | undefined)?.token ??
      client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwt.verify<{
        sub: string;
        role: string;
        exp: number;
        aud?: string;
      }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      // Only marketplace (user-audience) tokens may open a chat socket.
      if (payload.aud !== undefined && payload.aud !== 'user') throw new Error('wrong audience');
      (client.data as SocketData).userId = payload.sub;
      (client.data as SocketData).role = payload.role;
      (client.data as SocketData).exp = payload.exp;
      // Same liveness rule as JwtStrategy on the REST side: deleted/banned → no socket.
      await this.assertActive(client);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    // Rooms a socket joined are left automatically by Socket.io on disconnect — no
    // manual cleanup needed here, just logging for now.
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('conversation:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const userId = await this.assertActive(client);
    if (!body?.conversationId)
      throw new WsException('conversationId is required');

    await this.chat.assertParticipant(userId, body.conversationId);
    await client.join(conversationRoom(body.conversationId));
    return { joined: body.conversationId };
  }

  @SubscribeMessage('conversation:leave')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    if (body?.conversationId) {
      client.leave(conversationRoom(body.conversationId));
    }
  }

  @SubscribeMessage('message:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string; body?: string },
  ) {
    const userId = await this.assertActive(client);
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!body?.conversationId || !text) {
      throw new WsException('conversationId and body are required');
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      throw new WsException(
        `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`,
      );
    }

    const message = await this.chat.sendMessage(
      userId,
      body.conversationId,
      text,
    );
    // Broadcast to everyone in the room, including the sender's other tabs/devices —
    // clients render optimistically but reconcile off this event, same convention
    // apps/mobile's chat send flow is documented to use (root CLAUDE.md §14.3).
    this.server
      .to(conversationRoom(body.conversationId))
      .emit('message:new', message);
    return message;
  }
}
