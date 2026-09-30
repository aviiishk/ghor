import {
  applyDecorators,
  Body,
  CanActivate,
  Controller,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { StepUpGuard } from '../permissions/step-up.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RequirePermission, RequireStepUp } from '../permissions/decorators';
import { AuditService } from '../audit/audit.service';
import type { UserPrincipal } from '../auth/principal';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from '../listings/listings.service';
import { ADMIN_LISTING_INCLUDE } from '../listings/listing-shapes';
import { ModerationService } from '../moderation/moderation.service';
import { MAX_BULK_ITEMS } from '../moderation/moderation.dto';
import { ReportsService } from '../reports/reports.service';
import { ResolveReportDto } from '../reports/dto/resolve-report.dto';
import { ReviewsService } from '../reviews/reviews.service';
import {
  AdminListReviewsDto,
  SetReviewHiddenDto,
} from '../reviews/dto/admin-reviews.dto';
import { AppSettingsService } from '../app-config/app-settings.service';
import { UsersAdminService } from './users-admin.service';
import { AdminReadService } from './admin-read.service';
import { SetConfigValueDto, UsersQueryDto } from './admin.dto';

// Legacy web admin API (D-46): a temporary migration tool, not a production console — it
// has no authenticator (TOTP) step. FAIL CLOSED: every /legacy-admin/* route is a 404
// unless LEGACY_ADMIN_ENABLED is exactly "true". Unset, "false", or anything else = off.
export function legacyAdminEnabled(): boolean {
  return process.env.LEGACY_ADMIN_ENABLED === 'true';
}

@Injectable()
export class LegacyAdminEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!legacyAdminEnabled()) throw new NotFoundException();
    return true;
  }
}

function LegacyAdminApi() {
  return applyDecorators(
    Controller('legacy-admin'),
    UseGuards(
      LegacyAdminEnabledGuard,
      JwtAuthGuard,
      PermissionGuard,
      StepUpGuard,
      RateLimitGuard,
    ),
  );
}

class LegacyBulkStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_ITEMS)
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

class LegacyBanDto {
  @IsBoolean()
  banned!: boolean;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

class LegacyRoleDto {
  // Marketplace role only. Admin power is never granted from the legacy console.
  @IsIn(['seeker', 'owner'])
  role!: 'seeker' | 'owner';
}

class LegacyReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

type UserReq = Request & { user: UserPrincipal };
const ctx = (req: UserReq) => AuditService.context(req, req.user);

// The legacy apps/web /admin console, hardened (Phase 0, docs/GHOR-ADMIN-API-AUDIT.md §5):
//  - authorization comes from an ACTIVE admin_users row + the central permission map,
//    not profiles.role === 'admin';
//  - every mutation goes through the same services as the new console (preconditions,
//    audit rows in the same transaction, outbox notifications);
//  - sensitive actions (ban, configuration change) require a TOTP step-up, which a
//    user-token session cannot perform — they are available only in the new console;
//  - admin roles can no longer be granted from here.
// Legacy sessions have no TOTP (they are plain user sessions) — a known, documented gap
// that ends when this controller is retired.
@LegacyAdminApi()
export class LegacyAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: ListingsService,
    private readonly moderation: ModerationService,
    private readonly reports: ReportsService,
    private readonly reviews: ReviewsService,
    private readonly users: UsersAdminService,
    private readonly settings: AppSettingsService,
    private readonly read: AdminReadService,
  ) {}

  @Get('listings/queue')
  @RequirePermission('listings.review')
  queue() {
    return this.prisma.listing.findMany({
      where: { status: 'pending', deletedAt: null },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
      take: 100,
      include: ADMIN_LISTING_INCLUDE,
    });
  }

  @Post('listings/bulk-status')
  @HttpCode(200)
  @RequirePermission('listings.review')
  async bulkStatus(@Body() dto: LegacyBulkStatusDto, @Req() req: UserReq) {
    const approve = dto.status === 'approved';
    const result = await this.moderation.bulkDecide(
      req.user,
      {
        items: dto.ids.map((id) => ({ id })),
        decision: approve ? 'approve' : 'reject',
        reasonCodes: [
          approve ? 'legacy_console_approve' : 'legacy_console_reject',
        ],
        ownerMessage: approve ? undefined : dto.reason,
        internalNote: dto.reason,
      },
      ctx(req),
    );
    return { updated: result.succeeded, ...result };
  }

  @Post('listings/geocode-backfill')
  @HttpCode(200)
  @RequirePermission('configuration.manage')
  backfill(@Body() dto: LegacyReasonDto, @Req() req: UserReq) {
    return this.listings.backfillGeocoding(
      AuditService.actor(req.user),
      dto.reason,
      ctx(req),
    );
  }

  @Get('reports')
  @RequirePermission('reports.review')
  async reportsList() {
    return (await this.reports.listForAdmin({ status: 'pending', limit: 100 }))
      .items;
  }

  @Patch('reports/:id')
  @RequirePermission('reports.review')
  resolveReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
    @Req() req: UserReq,
  ) {
    return this.reports.resolve(req.user, id, dto, ctx(req));
  }

  @Get('reviews')
  @RequirePermission('reviews.moderate')
  async reviewsList(@Query() query: AdminListReviewsDto) {
    return (await this.reviews.adminList({ hidden: query.hidden, limit: 100 }))
      .items;
  }

  @Patch('reviews/:id')
  @RequirePermission('reviews.moderate')
  setReviewHidden(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetReviewHiddenDto,
    @Req() req: UserReq,
  ) {
    return this.reviews.setHidden(
      req.user,
      id,
      dto.hidden,
      dto.reason,
      ctx(req),
    );
  }

  @Get('users')
  @RequirePermission('users.view')
  async usersList(@Query() query: UsersQueryDto) {
    return (await this.users.list({ ...query, limit: query.limit ?? 100 }))
      .items;
  }

  // Suspension is a sensitive action (step-up) → unavailable from the legacy console.
  @Patch('users/:id/ban')
  @RequirePermission('users.suspend')
  @RequireStepUp()
  ban(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LegacyBanDto,
    @Req() req: UserReq,
  ) {
    return this.users.setBanned(req.user, id, dto, ctx(req));
  }

  @Patch('users/:id/role')
  @RequirePermission('users.restrict')
  setRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LegacyRoleDto,
    @Req() req: UserReq,
  ) {
    return this.users.setMarketplaceRole(req.user, id, dto, ctx(req));
  }

  @Get('config')
  @RequirePermission('configuration.manage')
  async config() {
    return (await this.settings.listForAdmin()).keys;
  }

  // Configuration changes are step-up protected → unavailable from the legacy console.
  @Patch('config/:key')
  @RequirePermission('configuration.manage')
  @RequireStepUp()
  setConfig(
    @Param('key') key: string,
    @Body() dto: SetConfigValueDto,
    @Req() req: UserReq,
  ) {
    return this.settings.set(
      { key, ...dto },
      AuditService.actor(req.user),
      ctx(req),
    );
  }

  @Get('analytics')
  @RequirePermission('users.view')
  analytics() {
    return this.read.analytics({});
  }
}
