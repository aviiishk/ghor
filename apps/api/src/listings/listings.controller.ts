import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { BrowseListingsDto } from './dto/browse-listings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { hasPermission } from '../auth/principal';
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

  // Create-listing location step: resolves a locality exactly as saving would (same
  // geocoder, cache and rate limit), so the owner previews the approximate area renters
  // will see. Read-only; returns { point: { latitude, longitude } | null } (wrapped so
  // the body is always JSON — a bare null serializes as an empty body). Before `:id`.
  @Get('geocode-preview')
  async geocodePreview(@Query('locality') locality?: string) {
    return {
      point: await this.listings.geocodePreview(
        (locality ?? '').trim().slice(0, 100),
      ),
    };
  }

  // Map view pins — same filters as the feed, whole filtered set, no pagination.
  // Registered before `:id` so "map" isn't parsed as a listing id.
  @Get('map')
  findMapPins(@Query() query: BrowseListingsDto) {
    return this.listings.findMapPins(query);
  }

  // Admin moderation routes moved to /admin/listings/* (console) and /legacy-admin/*
  // (legacy web admin) — Phase 0, 2026-09-29. Everything below is owner/seeker-facing;
  // `staff` only widens READ visibility for people holding listings.review.
  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.findOne(user.userId, hasPermission(user, 'listings.review'), id);
  }

  // Owner-only per-listing stats (404 for anyone else).
  @Get(':id/insights')
  getInsights(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.getInsights(user.userId, hasPermission(user, 'listings.review'), id);
  }

  @Get(':id/similar')
  findSimilar(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.findSimilar(user.userId, hasPermission(user, 'listings.review'), id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listings.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.remove(user, id);
  }
}
