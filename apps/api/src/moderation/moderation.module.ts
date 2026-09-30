import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { AdminListingsController } from './admin-listings.controller';
import { ReviewContextService } from './review-context.service';
import { ListingsModule } from '../listings/listings.module';

@Module({
  imports: [ListingsModule],
  controllers: [AdminListingsController],
  providers: [ModerationService, ReviewContextService],
  exports: [ModerationService],
})
export class ModerationModule {}
