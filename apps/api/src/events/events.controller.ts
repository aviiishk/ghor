import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  // userId always comes from the JWT (root CLAUDE.md §6: `user_id` = self).
  @Post()
  @HttpCode(204)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEventDto) {
    const properties: Record<string, unknown> = {};
    if (dto.listingId) properties.listingId = dto.listingId;
    if (dto.channel) properties.channel = dto.channel;
    this.events.record(user.userId, dto.eventName, properties);
  }
}
