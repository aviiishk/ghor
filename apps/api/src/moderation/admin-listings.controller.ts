import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminApi } from '../admin-auth/admin-api.decorator';
import { RequirePermission, RequireStepUp } from '../permissions/decorators';
import { AuditService } from '../audit/audit.service';
import type { AdminPrincipal } from '../auth/principal';
import { ModerationService } from './moderation.service';
import { ReviewContextService } from './review-context.service';
import {
  BulkDecisionDto,
  DecisionDto,
  NoteDto,
  PostReviewDto,
  QueueQueryDto,
  VersionedReasonDto,
} from './moderation.dto';

type AdminReq = Request & { user: AdminPrincipal };
const ctx = (req: AdminReq) => AuditService.context(req, req.user);

// The canonical moderation API for the new admin console (replaces the legacy
// /listings/admin/* routes). Route permissions are the baseline; decision-dependent
// permissions (approve vs reject) are asserted again in ModerationService.
@AdminApi('listings')
export class AdminListingsController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly reviewContext: ReviewContextService,
  ) {}

  @Get('queue')
  @RequirePermission('listings.review')
  queue(@Query() query: QueueQueryDto) {
    return this.moderation.queue(query);
  }

  // Bulk decisions (≤ 50, per-item version + result) change many listings in one action,
  // so they require a fresh TOTP step-up (D-47 sensitive actions).
  @Post('bulk-decision')
  @HttpCode(200)
  @RequirePermission('listings.review')
  @RequireStepUp()
  bulkDecision(@Body() dto: BulkDecisionDto, @Req() req: AdminReq) {
    return this.moderation.bulkDecide(req.user, dto, ctx(req));
  }

  @Get(':id')
  @RequirePermission('listings.review')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const listing = await this.moderation.detail(id);
    return { ...listing, context: await this.reviewContext.build(listing) };
}

  @Get(':id/snapshots/:version')
  @RequirePermission('listings.review')
  snapshot(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.moderation.snapshotAt(id, version);
  }

  @Post(':id/claim')
  @HttpCode(200)
  @RequirePermission('listings.review')
  claim(@Param('id', ParseUUIDPipe) id: string, @Req() req: AdminReq) {
    return this.moderation.claim(req.user, id, ctx(req));
  }

  @Delete(':id/claim')
  @RequirePermission('listings.review')
  releaseClaim(@Param('id', ParseUUIDPipe) id: string, @Req() req: AdminReq) {
    return this.moderation.releaseClaim(req.user, id, ctx(req));
  }

  @Post(':id/decision')
  @HttpCode(200)
  @RequirePermission('listings.review')
  decision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
    @Req() req: AdminReq,
  ) {
    return this.moderation.decide(req.user, id, dto, ctx(req));
  }

  @Post(':id/hold')
  @HttpCode(200)
  @RequirePermission('listings.hold')
  hold(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedReasonDto,
    @Req() req: AdminReq,
  ) {
    return this.moderation.hold(req.user, id, dto, ctx(req));
  }

  @Delete(':id/hold')
  @RequirePermission('listings.hold')
  releaseHold(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedReasonDto,
    @Req() req: AdminReq,
  ) {
    return this.moderation.releaseHold(req.user, id, dto, ctx(req));
  }

  @Post(':id/pause')
  @HttpCode(200)
  @RequirePermission('listings.pause')
  pause(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedReasonDto,
    @Req() req: AdminReq,
  ) {
    return this.moderation.pause(req.user, id, dto, ctx(req));
  }

  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermission('listings.restore')
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedReasonDto,
    @Req() req: AdminReq,
  ) {
    return this.moderation.restore(req.user, id, dto, ctx(req));
  }

  @Post(':id/post-review')
  @HttpCode(200)
  @RequirePermission('listings.review')
  postReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PostReviewDto,
    @Req() req: AdminReq,
  ) {
    return this.moderation.postReview(req.user, id, dto, ctx(req));
  }

  @Post(':id/note')
  @HttpCode(201)
  @RequirePermission('listings.review')
  note(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NoteDto,
    @Req() req: AdminReq,
  ) {
    return this.moderation.addNote(req.user, id, dto.body, ctx(req));
  }
}
