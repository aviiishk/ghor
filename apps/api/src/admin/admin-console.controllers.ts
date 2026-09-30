import {
  Body,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminApi } from '../admin-auth/admin-api.decorator';
import { RequirePermission, RequireStepUp } from '../permissions/decorators';
import { AuditService } from '../audit/audit.service';
import type { AdminPrincipal } from '../auth/principal';
import { AppSettingsService } from '../app-config/app-settings.service';
import { ReportsService } from '../reports/reports.service';
import { ReviewsService } from '../reviews/reviews.service';
import { ListingsService } from '../listings/listings.service';
import {
  AdminListReviewsDto,
  AdminSetReviewHiddenDto,
} from '../reviews/dto/admin-reviews.dto';
import { AdminAccountsService } from './admin-accounts.service';
import { UsersAdminService } from './users-admin.service';
import { AdminReadService } from './admin-read.service';
import {
  AckAlertDto,
  AdminResolveReportDto,
  AdminStatusDto,
  AuditExportDto,
  AuditQueryDto,
  ChangeAdminRoleDto,
  CreateAdminUserDto,
  PageQueryDto,
  RangeQueryDto,
  ReportsQueryDto,
  RequiredReasonDto,
  SeniorCapabilityDto,
  SetConfigValueDto,
  TrendsQueryDto,
  UsersQueryDto,
} from './admin.dto';

type AdminReq = Request & { user: AdminPrincipal };
const ctx = (req: AdminReq) => AuditService.context(req, req.user);

// ---------------------------------------------------------------------------
// Dashboard + analytics
// ---------------------------------------------------------------------------

@AdminApi('')
export class AdminDashboardController {
  constructor(private readonly read: AdminReadService) {}

  @Get('dashboard')
  @RequirePermission('listings.review')
  dashboard() {
    return this.read.dashboard();
  }

  @Get('analytics')
  @RequirePermission('users.view')
  analytics(@Query() query: RangeQueryDto) {
    return this.read.analytics(query);
  }

  // Daily moderation/report trends for the analytics charts (7–90 days, IST days).
  @Get('analytics/trends')
  @RequirePermission('listings.review')
  trends(@Query() query: TrendsQueryDto) {
    return this.read.trends(query.days ?? 30);
  }
}

// ---------------------------------------------------------------------------
// Admin accounts (super_admin: admin.manage / roles.manage, always step-up)
// ---------------------------------------------------------------------------

@AdminApi('admin-users')
export class AdminUsersController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @Get()
  @RequirePermission('admin.manage')
  list() {
    return this.accounts.list();
  }

  @Post()
  @RequirePermission('admin.manage', 'roles.manage')
  @RequireStepUp()
  create(@Body() dto: CreateAdminUserDto, @Req() req: AdminReq) {
    return this.accounts.create(req.user, dto, ctx(req));
  }

  @Put(':id/role')
  @RequirePermission('roles.manage')
  @RequireStepUp()
  changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeAdminRoleDto,
    @Req() req: AdminReq,
  ) {
    return this.accounts.changeRole(req.user, id, dto, ctx(req));
  }

  // Assigning GHOR Verified authority to a super_admin (D-47): authorized (roles.manage),
  // re-authenticated (step-up) and audited.
  @Put(':id/senior-capability')
  @RequirePermission('roles.manage')
  @RequireStepUp()
  seniorCapability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SeniorCapabilityDto,
    @Req() req: AdminReq,
  ) {
    return this.accounts.setSeniorCapability(req.user, id, dto, ctx(req));
  }

  @Put(':id/status')
  @RequirePermission('admin.manage')
  @RequireStepUp()
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminStatusDto,
    @Req() req: AdminReq,
  ) {
    return this.accounts.setStatus(req.user, id, dto, ctx(req));
  }

  @Post(':id/totp-reset')
  @HttpCode(200)
  @RequirePermission('admin.manage')
  @RequireStepUp()
  resetTotp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequiredReasonDto,
    @Req() req: AdminReq,
  ) {
    return this.accounts.resetTotp(req.user, id, dto, ctx(req));
  }

  @Post(':id/sessions/revoke-all')
  @HttpCode(200)
  @RequirePermission('admin.manage')
  @RequireStepUp()
  revokeSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequiredReasonDto,
    @Req() req: AdminReq,
  ) {
    return this.accounts.revokeSessions(req.user, id, dto, ctx(req));
  }
}

// ---------------------------------------------------------------------------
// Marketplace users
// ---------------------------------------------------------------------------

@AdminApi('users')
export class AdminMarketplaceUsersController {
  constructor(private readonly users: UsersAdminService) {}

  @Get()
  @RequirePermission('users.view')
  list(@Query() query: UsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @RequirePermission('users.view')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.detail(id);
  }

  @Post(':id/ban')
  @HttpCode(200)
  @RequirePermission('users.suspend')
  @RequireStepUp()
  ban(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequiredReasonDto,
    @Req() req: AdminReq,
  ) {
    return this.users.setBanned(
      req.user,
      id,
      { banned: true, reason: dto.reason },
      ctx(req),
    );
  }

  @Post(':id/unban')
  @HttpCode(200)
  @RequirePermission('users.suspend')
  @RequireStepUp()
  unban(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequiredReasonDto,
    @Req() req: AdminReq,
  ) {
    return this.users.setBanned(
      req.user,
      id,
      { banned: false, reason: dto.reason },
      ctx(req),
    );
  }
}

// ---------------------------------------------------------------------------
// Reports + reviews
// ---------------------------------------------------------------------------

@AdminApi('reports')
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @RequirePermission('reports.review')
  list(@Query() query: ReportsQueryDto) {
    return this.reports.listForAdmin(query);
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @RequirePermission('reports.review')
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminResolveReportDto,
    @Req() req: AdminReq,
  ) {
    return this.reports.resolve(req.user, id, dto, ctx(req));
  }
}

@AdminApi('reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @RequirePermission('reviews.moderate')
  list(@Query() query: AdminListReviewsDto) {
    return this.reviews.adminList(query);
  }

  @Patch(':id')
  @RequirePermission('reviews.moderate')
  setHidden(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminSetReviewHiddenDto,
    @Req() req: AdminReq,
  ) {
    return this.reviews.setHidden(
      req.user,
      id,
      dto.hidden,
      dto.reason,
      ctx(req),
    );
  }
}

// ---------------------------------------------------------------------------
// Configuration (super_admin + step-up)
// ---------------------------------------------------------------------------

@AdminApi('config')
export class AdminConfigController {
  constructor(private readonly settings: AppSettingsService) {}

  @Get()
  @RequirePermission('configuration.manage')
  list() {
    return this.settings.listForAdmin();
  }

  @Patch(':key')
  @RequirePermission('configuration.manage')
  @RequireStepUp()
  set(
    @Param('key') key: string,
    @Body() dto: SetConfigValueDto,
    @Req() req: AdminReq,
  ) {
    return this.settings.set(
      { key, ...dto },
      AuditService.actor(req.user),
      ctx(req),
    );
  }
}

// ---------------------------------------------------------------------------
// Audit log (read-only; there is no update or delete endpoint by design)
// ---------------------------------------------------------------------------

@AdminApi('audit')
export class AdminAuditController {
  constructor(private readonly read: AdminReadService) {}

  @Get()
  @RequirePermission('audit.view')
  list(@Query() query: AuditQueryDto, @Req() req: AdminReq) {
    return this.read.auditLog(req.user, query);
  }

  @Post('export')
  @HttpCode(200)
  @RequirePermission('audit.export')
  @RequireStepUp()
  export(@Body() dto: AuditExportDto, @Req() req: AdminReq) {
    return this.read.exportAudit(req.user, dto, ctx(req));
  }
}

// ---------------------------------------------------------------------------
// System health
// ---------------------------------------------------------------------------

@AdminApi('system')
export class AdminSystemController {
  constructor(
    private readonly read: AdminReadService,
    private readonly listings: ListingsService,
  ) {}

  @Get('health')
  @RequirePermission('system.health.view')
  health() {
    return this.read.systemHealth();
  }

  @Post('alerts/:id/ack')
  @HttpCode(200)
  @RequirePermission('system.health.ack')
  ack(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AckAlertDto,
    @Req() req: AdminReq,
  ) {
    return this.read.acknowledgeAlert(req.user, id, dto.note, ctx(req));
  }

  @Post('geocode-backfill')
  @HttpCode(200)
  @RequirePermission('configuration.manage')
  backfill(@Body() dto: RequiredReasonDto, @Req() req: AdminReq) {
    return this.listings.backfillGeocoding(
      AuditService.actor(req.user),
      dto.reason,
      ctx(req),
    );
  }
}

// ---------------------------------------------------------------------------
// Trust — verification STATUS (GHOR Verified authority: senior-reviewer capability).
// No documents or evidence are exposed in Phase 0.
// ---------------------------------------------------------------------------

@AdminApi('trust')
export class AdminTrustController {
  constructor(private readonly read: AdminReadService) {}

  @Get('verification-statuses')
  @RequirePermission('verification.view')
  verificationStatuses(@Query() query: PageQueryDto) {
    return this.read.verificationStatuses(query);
  }
}
