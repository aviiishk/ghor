import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListReviewsDto } from './dto/list-reviews.dto';
import {
  AdminListReviewsDto,
  SetReviewHiddenDto,
} from './dto/admin-reviews.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

// Nested under listings/:listingId — two path segments after "listings", so it never
// collides with ListingsController's single-segment `:id` routes.
@Controller('listings/:listingId/reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // Also returns `viewer: { canReview, hasReviewed }` so clients know whether to render
  // the "Write a review" entry point without a second request.
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listingId') listingId: string,
    @Query() query: ListReviewsDto,
  ) {
    return this.reviews.list(
      user.userId,
      user.role,
      listingId,
      query.cursor,
      query.limit,
    );
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listingId') listingId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.create(user.userId, user.role, listingId, dto);
  }
}

@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Query() query: AdminListReviewsDto) {
    return this.reviews.adminList(query.hidden);
  }

  @Patch(':id')
  setHidden(@Param('id') id: string, @Body() dto: SetReviewHiddenDto) {
    return this.reviews.setHidden(id, dto.hidden);
  }
}
