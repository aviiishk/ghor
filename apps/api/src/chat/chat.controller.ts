import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

// REST surface for chat — the primary real-time path is ChatGateway (Socket.io), but
// every mutation here goes through the same ChatService methods the gateway calls, so
// a client that loads a thread over plain HTTP (initial history fetch, or a client that
// hasn't connected a socket yet) sees identical behavior. Root CLAUDE.md §14.5.
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  // Seeker-initiated only — an owner never "starts" a conversation on their own
  // listing, they only ever reply in one a seeker already opened.
  @Post()
  getOrCreate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateConversationDto) {
    return this.chat.getOrCreateConversation(user.userId, dto.listingId);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.chat.listConversations(user.userId);
  }

  @Get(':id/messages')
  getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.chat.getMessages(user.userId, id, query);
  }

  @Post(':id/messages')
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.sendMessage(user.userId, id, dto.body);
  }
}
