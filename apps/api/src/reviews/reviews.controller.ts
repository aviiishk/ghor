import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListReviewsDto } from './dto/list-reviews.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { hasPermission } from '../auth/principal';

// Nested under listings/:listingId — two path segments after "listings", so it never
// collides with ListingsController's single-segment `:id` routes. Admin review moderation
// lives at /admin/reviews (console) and /legacy-admin/reviews (legacy web admin).
@Controller('listings/:listingId/reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // Also returns `viewer: { canReview, hasReviewed }` so clients know whether to render
  // the "Write a review" entry point without a second request.
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Query() query: ListReviewsDto,
  ) {
    return this.reviews.list(
      user.userId,
      hasPermission(user, 'listings.review'),
      listingId,
      query.cursor,
      query.limit,
    );
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.create(user.userId, hasPermission(user, 'listings.review'), listingId, dto);
  }
}
