import { IsIn, IsOptional, IsUUID } from 'class-validator';

// Only events the server can't observe itself. Everything else (signup, listing_view,
// chat_started, listing_created) is recorded server-side and rejected here, so a client
// can't inflate those numbers.
export const CLIENT_EVENTS = ['contact_tap', 'listing_shared'] as const;

export class CreateEventDto {
  @IsIn(CLIENT_EVENTS)
  eventName!: (typeof CLIENT_EVENTS)[number];

  @IsOptional()
  @IsUUID()
  listingId?: string;

  // contact_tap only: which contact action.
  @IsOptional()
  @IsIn(['chat', 'call'])
  channel?: 'chat' | 'call';
}
