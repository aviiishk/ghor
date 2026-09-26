import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { BrowseListingsDto } from './dto/browse-listings.dto';
import { BulkUpdateListingsDto } from './dto/bulk-update-listings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

// Every route here requires auth — root CLAUDE.md §2/§7.4: browsing requires login on
// both surfaces, no public listings endpoint exists.
@Controller('listings')
@UseGuards(JwtAuthGuard)
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateListingDto) {
    return this.listings.create(user.userId, dto);
  }

  // Owner's "My Listings" tab (root CLAUDE.md, mobile design.md) — all statuses, own
  // rows only. Registered before `:id` so "mine" isn't parsed as a listing id.
  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.listings.findMine(user.userId);
  }

  // Browse feed — approved-only, cursor-paginated, filterable.
  @Get()
  findApproved(@Query() query: BrowseListingsDto) {
    return this.listings.findApproved(query);
  }

  // Popular areas for the browse page — registered before `:id`.
  @Get('localities')
  popularLocalities(@Query('city') city?: string) {
    return this.listings.popularLocalities(city || 'Guwahati');
  }

  // Map view pins — same filters as the feed, whole filtered set, no pagination.
  // Registered before `:id` so "map" isn't parsed as a listing id.
  @Get('map')
  findMapPins(@Query() query: BrowseListingsDto) {
    return this.listings.findMapPins(query);
  }

  @Post('admin/geocode-backfill')
  @UseGuards(AdminGuard)
  backfillGeocoding() {
    return this.listings.backfillGeocoding();
  }

  // Admin moderation queue (root CLAUDE.md §14.10) — all `pending` listings across every
  // owner, oldest first. Distinct path shape from `:id` (two segments, not one), so this
  // doesn't need to be registered before it to avoid a route collision.
  @Get('admin/queue')
  @UseGuards(AdminGuard)
  findPendingQueue() {
    return this.listings.findPendingQueue();
  }

  @Post('admin/bulk-status')
  @UseGuards(AdminGuard)
  bulkStatus(@Body() dto: BulkUpdateListingsDto) {
    return this.listings.bulkSetStatus(dto.ids, dto.status);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.findOne(user.userId, user.role, id);
  }

  // Owner-only per-listing stats (404 for anyone else).
  @Get(':id/insights')
  getInsights(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.getInsights(user.userId, user.role, id);
  }

  @Get(':id/similar')
  findSimilar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.findSimilar(user.userId, user.role, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listings.update(user.userId, user.role, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.remove(user.userId, user.role, id);
  }
}
