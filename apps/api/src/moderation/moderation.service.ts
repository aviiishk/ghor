import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Prisma,
  type ListingStatus,
  type ModerationDecisionType,
  type NotificationType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../common/clock';
import {
  AuditService,
  maskPhone,
  SYSTEM_ACTOR,
  type AuditActor,
  type AuditContext,
  type Db,
} from '../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';
import { AppSettingsService } from '../app-config/app-settings.service';
import { assertPermission } from '../permissions/permission.guard';
import {
  actorProfileId,
  hasPermission,
  type Principal,
} from '../auth/principal';
import { CLEARED_REVIEW_STATE } from './listing-state';
import type { QueueQueryDto } from './moderation.dto';

export const MIN_PUBLISH_PHOTOS = 3;
// Normal job latency (15 s ticks, retries). Items overdue by more than this are "backlog"
// and are held while F-04 is unresolved — see autoApproveOne().
export const F04_UNRESOLVED_GRACE_SECONDS = 120;

type Decision = 'approve' | 'reject' | 'request_changes';

interface Who {
  actor: AuditActor;
  profileId: string | null;
  ctx: AuditContext;
}

const whoFrom = (principal: Principal, ctx: AuditContext): Who => ({
  actor: AuditService.actor(principal),
  profileId: actorProfileId(principal),
  ctx,
});

// Content snapshot per listing version (DB-06): evidence of exactly what was reviewed,
// kept even if the listing is later deleted (no FK). Idempotent per (listing, version).
export async function snapshotListing(
  db: Db,
  listingId: string,
  version: number,
): Promise<void> {
  const l = await db.listing.findUnique({
    where: { id: listingId },
    include: {
      images: { orderBy: { position: 'asc' }, select: { cloudinaryUrl: true } },
      institutions: { select: { institutionId: true } },
    },
  });
  if (!l) return;
  const content = {
    ownerId: l.ownerId,
    status: l.status,
    title: l.title,
    description: l.description,
    propertyType: l.propertyType,
    rent: l.rent,
    deposit: l.deposit,
    locality: l.locality,
    city: l.city,
    state: l.state,
    availableFrom: l.availableFrom,
    amenities: l.amenities,
    images: l.images.map((i) => i.cloudinaryUrl),
    institutionIds: l.institutions.map((i) => i.institutionId),
    pausedAt: l.pausedAt,
    heldAt: l.heldAt,
  };
  await db.listingSnapshot.createMany({
    data: [
      {
        listingId,
        version,
        content,
      },
    ],
    skipDuplicates: true,
  });
}

// The canonical moderation path (docs/GHOR-ADMIN-API-AUDIT.md §11–§14). Every state change:
//   1. is a conditional UPDATE on (id, expected version, expected state) that increments
//      `version` — a stale decision gets 409, never a silent overwrite;
//   2. writes a moderation_decisions row, a listing snapshot, an audit row and (when the
//      owner must be told) an outbox message — all in the SAME transaction.
@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly settings: AppSettingsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Decisions
  // ---------------------------------------------------------------------------

  async decide(
    principal: Principal,
    listingId: string,
    input: {
      expectedVersion?: number;
      decision: Decision;
      reasonCodes?: string[];
      ownerMessage?: string;
      internalNote?: string;
    },
    ctx: AuditContext,
  ) {
    assertPermission(
      principal,
      input.decision === 'approve' ? 'listings.approve' : 'listings.reject',
    );
    if (input.decision !== 'approve' && !input.reasonCodes?.length) {
      throw new BadRequestException({
        message: 'A reason code is required to reject or request changes',
        code: 'REASON_REQUIRED',
      });
    }
    const who = whoFrom(principal, ctx);
    return this.prisma.$transaction((tx) =>
      this.decideInTx(tx, who, listingId, input),
    );
  }

  private async decideInTx(
    tx: Prisma.TransactionClient,
    who: Who,
    listingId: string,
    input: {
      expectedVersion?: number;
      decision: Decision;
      reasonCodes?: string[];
      ownerMessage?: string;
      internalNote?: string;
    },
  ) {
    const listing = await tx.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        ownerId: true,
        title: true,
        status: true,
        version: true,
        deletedAt: true,
        _count: { select: { images: true } },
      },
    });
    if (!listing || listing.deletedAt) throw new NotFoundException('Listing not found');
    // Legacy bulk callers have no version; they get a state-only precondition.
    const expectedVersion = input.expectedVersion ?? listing.version;
    if (listing.version !== expectedVersion)
      throw this.versionConflict(listing.version, listing.status);
    if (listing.status !== 'pending')
      throw this.invalidState(
        listing.status,
        'Only listings awaiting review can be decided',
      );
    if (
      input.decision === 'approve' &&
      listing._count.images < MIN_PUBLISH_PHOTOS
    ) {
      throw new UnprocessableEntityException({
        message: `A listing needs at least ${MIN_PUBLISH_PHOTOS} photos to be approved`,
        code: 'PUBLISH_REQUIREMENTS_NOT_MET',
      });
    }

    const now = this.clock.now();
    const approve = input.decision === 'approve';
    const newVersion = await this.guardedUpdate(
      tx,
      listingId,
      expectedVersion,
      { status: 'pending' },
      {
        ...CLEARED_REVIEW_STATE,
        status: approve ? 'approved' : 'rejected',
        approvalSource: approve ? 'manual' : null,
        approvedAt: approve ? now : null,
        approvedById: approve ? who.profileId : null,
        postReviewStatus: null,
      },
    );
    const decisionType: ModerationDecisionType = input.decision;
    await this.recordDecision(
      tx,
      who,
      listingId,
      decisionType,
      expectedVersion,
      newVersion,
      input,
    );
    await snapshotListing(tx, listingId, newVersion);
    await this.audit.record(tx, {
      category: 'admin_action',
      action: approve
        ? 'listing.approved'
        : input.decision === 'reject'
          ? 'listing.rejected'
          : 'listing.changes_requested',
      actor: who.actor,
      target: { type: 'listing', id: listingId },
      reason: input.reasonCodes?.join(',') ?? null,
      before: { status: 'pending', version: expectedVersion },
      after: { status: approve ? 'approved' : 'rejected', version: newVersion },
      metadata: {
        ownerMessage: input.ownerMessage ?? null,
        internalNote: input.internalNote ?? null,
      },
      ctx: who.ctx,
    });
    await this.notifyOwner(
      tx,
      listing.ownerId,
      listingId,
      newVersion,
      approve
        ? 'approved'
        : input.decision === 'reject'
          ? 'rejected'
          : 'changes_requested',
      listing.title,
      {
        reasonCodes: input.reasonCodes ?? [],
        ownerMessage: input.ownerMessage ?? null,
      },
    );
    return {
      id: listingId,
      status: approve ? 'approved' : 'rejected',
      version: newVersion,
    };
  }

  // Each item is decided in its own transaction and reported individually; one stale or
  // invalid item never blocks or rolls back the others.
  async bulkDecide(
    principal: Principal,
    input: {
      items: { id: string; expectedVersion?: number }[];
      decision: Decision;
      reasonCodes: string[];
      ownerMessage?: string;
      internalNote?: string;
    },
    ctx: AuditContext,
  ) {
    assertPermission(
      principal,
      input.decision === 'approve' ? 'listings.approve' : 'listings.reject',
    );
    const who = whoFrom(principal, ctx);
    const results: {
      id: string;
      result: string;
      version?: number;
      currentVersion?: number;
      message?: string;
    }[] = [];
    for (const item of input.items) {
      try {
        const r = await this.prisma.$transaction((tx) =>
          this.decideInTx(tx, who, item.id, {
            expectedVersion: item.expectedVersion,
            decision: input.decision,
            reasonCodes: input.reasonCodes,
            ownerMessage: input.ownerMessage,
            internalNote: input.internalNote,
          }),
        );
        results.push({ id: item.id, result: 'ok', version: r.version });
      } catch (e) {
        const body = (e as { getResponse?: () => unknown }).getResponse?.() as
          | { code?: string; currentVersion?: number; message?: string }
          | undefined;
        const code = body?.code;
        results.push({
          id: item.id,
          result:
            e instanceof NotFoundException
              ? 'not_found'
              : code === 'LISTING_VERSION_CONFLICT'
                ? 'conflict'
                : code === 'PUBLISH_REQUIREMENTS_NOT_MET'
                  ? 'requirements_not_met'
                  : code === 'INVALID_STATE'
                    ? 'invalid_state'
                    : 'error',
          currentVersion: body?.currentVersion,
          message: typeof body?.message === 'string' ? body.message : undefined,
        });
        if (!(
          e instanceof ConflictException ||
          e instanceof NotFoundException ||
          e instanceof UnprocessableEntityException
        )) {
          // Unexpected failure: stop here rather than keep hammering a broken dependency.
          throw e;
        }
      }
    }
    return {
      decision: input.decision,
      succeeded: results.filter((r) => r.result === 'ok').length,
      failed: results.filter((r) => r.result !== 'ok').length,
      results,
    };
  }

  // ---------------------------------------------------------------------------
  // Hold / pause / restore / post-review
  // ---------------------------------------------------------------------------

  // Hold = "a human must decide": the only non-decision action that stops the 5-minute
  // auto-approval (D-47). Claiming does not.
  async hold(
    principal: Principal,
    listingId: string,
    input: { expectedVersion: number; reason: string },
    ctx: AuditContext,
  ) {
    const who = whoFrom(principal, ctx);
    return this.simpleTransition(who, listingId, input.expectedVersion, {
      where: { status: 'pending', heldAt: null },
      data: {
        heldAt: this.clock.now(),
        heldById: who.profileId,
        holdReason: input.reason,
      },
      decision: 'hold',
      action: 'listing.hold',
      reason: input.reason,
      invalidMessage: 'Only an unheld listing awaiting review can be held',
    });
  }

  async releaseHold(
    principal: Principal,
    listingId: string,
    input: { expectedVersion: number; reason: string },
    ctx: AuditContext,
  ) {
    const who = whoFrom(principal, ctx);
    const window = await this.settings.get<number>(
      'auto_approval_window_seconds',
    );
    // PROPOSED policy: releasing a hold restarts the review window rather than letting an
    // item that was held past its original deadline auto-approve instantly.
    return this.simpleTransition(who, listingId, input.expectedVersion, {
      where: { status: 'pending', heldAt: { not: null } },
      data: {
        heldAt: null,
        heldById: null,
        holdReason: null,
        autoApproveAt: new Date(this.clock.now().getTime() + window * 1000),
      },
      decision: 'release_hold',
      action: 'listing.hold_released',
      reason: input.reason,
      invalidMessage: 'This listing is not on hold',
    });
  }

  async pause(
    principal: Principal,
    listingId: string,
    input: { expectedVersion: number; reason: string },
    ctx: AuditContext,
  ) {
    const who = whoFrom(principal, ctx);
    return this.simpleTransition(who, listingId, input.expectedVersion, {
      where: { status: 'approved', pausedAt: null },
      data: {
        pausedAt: this.clock.now(),
        pausedById: who.profileId,
        pauseReason: input.reason,
      },
      decision: 'pause',
      action: 'listing.paused',
      reason: input.reason,
      notify: 'paused',
      invalidMessage: 'Only a live listing can be paused',
    });
  }

  async restore(
    principal: Principal,
    listingId: string,
    input: { expectedVersion: number; reason: string },
    ctx: AuditContext,
  ) {
    const who = whoFrom(principal, ctx);
    return this.simpleTransition(who, listingId, input.expectedVersion, {
      where: { pausedAt: { not: null } },
      data: { pausedAt: null, pausedById: null, pauseReason: null },
      decision: 'restore',
      action: 'listing.restored',
      reason: input.reason,
      notify: 'restored',
      invalidMessage: 'This listing is not paused',
    });
  }

  // Post-review of automatically approved listings (MPB §13.1/§13.2).
  async postReview(
    principal: Principal,
    listingId: string,
    input: {
      expectedVersion: number;
      outcome: 'confirm' | 'reject' | 'escalate';
      reasonCodes?: string[];
      ownerMessage?: string;
      internalNote?: string;
    },
    ctx: AuditContext,
  ) {
    assertPermission(
      principal,
      input.outcome === 'confirm'
        ? 'listings.approve'
        : input.outcome === 'reject'
          ? 'listings.reject'
          : 'listings.review',
    );
    if (input.outcome === 'reject' && !input.reasonCodes?.length) {
      throw new BadRequestException({
        message: 'A reason code is required to reject',
        code: 'REASON_REQUIRED',
      });
    }
    const who = whoFrom(principal, ctx);
    const data: Prisma.ListingUpdateManyMutationInput =
      input.outcome === 'confirm'
        ? { postReviewStatus: 'confirmed' }
        : input.outcome === 'escalate'
          ? { postReviewStatus: 'escalated' }
          : {
              status: 'rejected',
              postReviewStatus: null,
              approvalSource: null,
              approvedAt: null,
              approvedById: null,
            };
    return this.simpleTransition(who, listingId, input.expectedVersion, {
      where: {
        status: 'approved',
        postReviewStatus:
          input.outcome === 'confirm' || input.outcome === 'reject'
            ? { in: ['pending', 'escalated'] }
            : 'pending',
      },
      data,
      decision:
        input.outcome === 'confirm'
          ? 'post_review_confirm'
          : input.outcome === 'reject'
            ? 'post_review_reject'
            : 'post_review_escalate',
      action: `listing.post_review.${input.outcome}`,
      reason: input.reasonCodes?.join(',') ?? null,
      reasonCodes: input.reasonCodes,
      ownerMessage: input.ownerMessage,
      internalNote: input.internalNote,
      notify: input.outcome === 'reject' ? 'rejected' : undefined,
      invalidMessage: 'This listing is not awaiting post-review',
    });
  }

  // ---------------------------------------------------------------------------
  // Claims — assignment metadata only (D-47): never a status, never a version bump,
  // never touches autoApproveAt.
  // ---------------------------------------------------------------------------

  async claim(principal: Principal, listingId: string, ctx: AuditContext) {
    const me = actorProfileId(principal);
    const now = this.clock.now();
    const ttl = await this.settings.get<number>('moderation_claim_ttl_seconds');
    const expiresAt = new Date(now.getTime() + ttl * 1000);
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.listing.updateMany({
        where: {
          id: listingId,
          deletedAt: null,
          status: { in: ['pending', 'approved'] },
          OR: [
            { claimedById: null },
            { claimExpiresAt: { lt: now } },
            { claimedById: me },
          ],
        },
        data: { claimedById: me, claimedAt: now, claimExpiresAt: expiresAt },
      });
      if (res.count !== 1) {
        const current = await tx.listing.findUnique({
          where: { id: listingId },
          select: { status: true, claimedById: true, claimExpiresAt: true },
        });
        if (!current) throw new NotFoundException('Listing not found');
        if (
          current.claimedById &&
          current.claimExpiresAt &&
          current.claimExpiresAt >= now
        ) {
          throw new ConflictException({
            message: 'Another admin is already reviewing this listing',
            code: 'CLAIMED_BY_OTHER',
            claimedById: current.claimedById,
            claimExpiresAt: current.claimExpiresAt,
          });
        }
        throw this.invalidState(
          current.status,
          'This listing is not in a reviewable state',
        );
      }
      await this.audit.record(tx, {
        category: 'admin_action',
        action: 'listing.claimed',
        actor: AuditService.actor(principal),
        target: { type: 'listing', id: listingId },
        metadata: { claimExpiresAt: expiresAt },
        ctx,
      });
      return { id: listingId, claimedById: me, claimExpiresAt: expiresAt };
    });
  }

  async releaseClaim(
    principal: Principal,
    listingId: string,
    ctx: AuditContext,
  ) {
    const me = actorProfileId(principal);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.listing.findUnique({
        where: { id: listingId },
        select: { claimedById: true },
      });
      if (!current) throw new NotFoundException('Listing not found');
      if (!current.claimedById) return { id: listingId, released: false };
      const takeOver = current.claimedById !== me;
      if (takeOver && !hasPermission(principal, 'admin.manage')) {
        throw new ForbiddenException({
          message: 'Only the claiming admin can release this claim',
          code: 'NOT_CLAIM_HOLDER',
        });
      }
      await tx.listing.updateMany({
        where: { id: listingId, claimedById: current.claimedById },
        data: { claimedById: null, claimedAt: null, claimExpiresAt: null },
      });
      await this.audit.record(tx, {
        category: 'admin_action',
        action: takeOver ? 'listing.claim_revoked' : 'listing.claim_released',
        actor: AuditService.actor(principal),
        target: { type: 'listing', id: listingId },
        metadata: { previousHolder: current.claimedById },
        ctx,
      });
      return { id: listingId, released: true };
    });
  }

  async addNote(
    principal: Principal,
    listingId: string,
    body: string,
    ctx: AuditContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const exists = await tx.listing.findUnique({
        where: { id: listingId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Listing not found');
      const note = await tx.listingNote.create({
        data: { listingId, authorId: actorProfileId(principal), body },
      });
      await this.audit.record(tx, {
        category: 'admin_action',
        action: 'listing.note_added',
        actor: AuditService.actor(principal),
        target: { type: 'listing', id: listingId },
        metadata: { noteId: note.id },
        ctx,
      });
      return note;
    });
  }

  // ---------------------------------------------------------------------------
  // Trust holds triggered by reports (system or admin). Never resurrects a listing that
  // is rejected, rented, draft or paused (audit §18: "confirm forces pending whatever its
  // state" was a bug).
  // ---------------------------------------------------------------------------

  async holdForReports(
    tx: Prisma.TransactionClient,
    listingId: string,
    reason: string,
    actor: AuditActor,
    actorProfile: string | null,
    ctx?: AuditContext,
  ): Promise<{ changed: boolean; version?: number }> {
    const now = this.clock.now();
    const current = await tx.listing.findUnique({
      where: { id: listingId },
      select: { status: true, version: true, pausedAt: true, heldAt: true, deletedAt: true },
    });
    if (!current || current.deletedAt) return { changed: false };
    let res: Prisma.BatchPayload;
    let from: ListingStatus = current.status;
    if (current.status === 'approved' && !current.pausedAt) {
      res = await tx.listing.updateMany({
        where: {
          id: listingId,
          version: current.version,
          status: 'approved',
          pausedAt: null,
        },
        data: {
          status: 'pending',
          heldAt: now,
          heldById: actorProfile,
          holdReason: reason,
          autoApproveAt: null,
          version: { increment: 1 },
        },
      });
    } else if (current.status === 'pending' && !current.heldAt) {
      from = 'pending';
      res = await tx.listing.updateMany({
        where: {
          id: listingId,
          version: current.version,
          status: 'pending',
          heldAt: null,
        },
        data: {
          heldAt: now,
          heldById: actorProfile,
          holdReason: reason,
          version: { increment: 1 },
        },
      });
    } else {
      return { changed: false };
    }
    if (res.count !== 1) return { changed: false };
    const newVersion = current.version + 1;
    const who: Who = { actor, profileId: actorProfile, ctx: ctx ?? {} };
    await this.recordDecision(
      tx,
      who,
      listingId,
      actor.type === 'system' ? 'system_hold' : 'hold',
      current.version,
      newVersion,
      { reasonCodes: [reason] },
    );
    await snapshotListing(tx, listingId, newVersion);
    await this.audit.record(tx, {
      category: actor.type === 'system' ? 'system' : 'admin_action',
      action: 'listing.held_for_reports',
      actor,
      target: { type: 'listing', id: listingId },
      reason,
      before: { status: from, version: current.version },
      after: { status: 'pending', held: true, version: newVersion },
      ctx,
    });
    return { changed: true, version: newVersion };
  }

  // ---------------------------------------------------------------------------
  // Auto-approval of one due listing (called by AutoApprovalJob). Returns what happened.
  // ---------------------------------------------------------------------------

  async autoApproveOne(
    candidate: { id: string; version: number },
    now: Date,
    maxOverdueSeconds: number | null,
  ): Promise<'approved' | 'held' | 'skipped'> {
    return this.prisma.$transaction(async (tx) => {
      const l = await tx.listing.findUnique({
        where: { id: candidate.id },
        select: {
          id: true,
          ownerId: true,
          title: true,
          status: true,
          version: true,
          heldAt: true,
          pausedAt: true,
          deletedAt: true,
          autoApproveAt: true,
          owner: { select: { banned: true } },
          _count: { select: { images: true } },
        },
      });
      if (
        !l ||
        l.version !== candidate.version ||
        l.status !== 'pending' ||
        l.heldAt ||
        l.pausedAt ||
        l.deletedAt ||
        !l.autoApproveAt ||
        l.autoApproveAt > now
      ) {
        return 'skipped';
      }
      const system = SYSTEM_ACTOR('auto_approval');
      // Safeguards (MPB §13.3): an item that fails a check is held for a human, never
      // approved and never silently left looping.
      let holdReason: string | null = null;
      if (l.owner.banned) holdReason = 'owner_restricted';
      else if (l._count.images < MIN_PUBLISH_PHOTOS)
        holdReason = 'publish_requirements_not_met';
      else {
        // Overdue items (job was off, down, or behind). F-04 — what to do with them — is an
        // OPEN founder decision, so the fail-safe applies until it is made: while
        // auto_approval_max_overdue_seconds is null (unresolved), anything overdue by more
        // than normal job latency is HELD for a human, never approved. Switching the job on
        // can therefore never silently bulk-approve an old backlog. Setting a number (the
        // founder's F-04 decision) holds only items overdue by more than that.
        const overdueMs = now.getTime() - l.autoApproveAt.getTime();
        if (maxOverdueSeconds === null) {
          if (overdueMs > F04_UNRESOLVED_GRACE_SECONDS * 1000) {
            holdReason = 'overdue_f04_unresolved';
          }
        } else if (overdueMs > maxOverdueSeconds * 1000) {
          holdReason = 'overdue_after_outage';
        }
      }

      if (holdReason) {
        const res = await tx.listing.updateMany({
          where: {
            id: l.id,
            version: l.version,
            status: 'pending',
            heldAt: null,
          },
          data: {
            heldAt: now,
            heldById: null,
            holdReason,
            version: { increment: 1 },
          },
        });
        if (res.count !== 1) return 'skipped';
        await this.recordDecision(
          tx,
          { actor: system, profileId: null, ctx: {} },
          l.id,
          'system_hold',
          l.version,
          l.version + 1,
          { reasonCodes: [holdReason] },
        );
        await this.audit.record(tx, {
          category: 'system',
          action: 'listing.auto_approval.held',
          actor: system,
          target: { type: 'listing', id: l.id },
          reason: holdReason,
          before: { status: 'pending', version: l.version },
          after: { status: 'pending', held: true, version: l.version + 1 },
        });
        return 'held';
      }

      const res = await tx.listing.updateMany({
        where: {
          id: l.id,
          version: l.version,
          status: 'pending',
          heldAt: null,
          pausedAt: null,
          autoApproveAt: { lte: now },
        },
        data: {
          ...CLEARED_REVIEW_STATE,
          status: 'approved',
          approvalSource: 'automatic_5min',
          approvedAt: now,
          approvedById: null,
          postReviewStatus: 'pending',
          version: { increment: 1 },
        },
      });
      if (res.count !== 1) return 'skipped'; // an admin acted first — their decision wins
      const newVersion = l.version + 1;
      await this.recordDecision(
        tx,
        { actor: system, profileId: null, ctx: {} },
        l.id,
        'auto_approve',
        l.version,
        newVersion,
        {},
      );
      await snapshotListing(tx, l.id, newVersion);
      await this.audit.record(tx, {
        category: 'system',
        action: 'listing.auto_approved',
        actor: system,
        target: { type: 'listing', id: l.id },
        before: { status: 'pending', version: l.version },
        after: {
          status: 'approved',
          approvalSource: 'automatic_5min',
          version: newVersion,
        },
      });
      await this.notifyOwner(
        tx,
        l.ownerId,
        l.id,
        newVersion,
        'approved',
        l.title,
        { approvalSource: 'automatic_5min' },
      );
      return 'approved';
    });
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async queue(query: QueueQueryDto) {
    const track = query.track ?? 'pending';
    const limit = query.limit ?? 25;
    const trackWhere: Prisma.ListingWhereInput =
      track === 'pending'
        ? { status: 'pending', heldAt: null }
        : track === 'held'
          ? { status: 'pending', heldAt: { not: null } }
          : track === 'post_review'
            ? {
                status: 'approved',
                postReviewStatus: { in: ['pending', 'escalated'] },
              }
            : { pausedAt: { not: null } };
    // Archived (owner-deleted) listings never appear in a work queue.
    const where: Prisma.ListingWhereInput = { ...trackWhere, deletedAt: null };
    const orderBy: Prisma.ListingOrderByWithRelationInput[] =
      track === 'pending'
        ? [{ autoApproveAt: 'asc' }, { submittedAt: 'asc' }, { id: 'asc' }]
        : track === 'held'
          ? [{ heldAt: 'asc' }, { id: 'asc' }]
          : track === 'post_review'
            ? [{ approvedAt: 'asc' }, { id: 'asc' }]
            : [{ pausedAt: 'desc' }, { id: 'asc' }];

    const rows = await this.prisma.listing.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        ...QUEUE_SELECT,
        images: {
          orderBy: { position: 'asc' },
          take: 3,
          select: { cloudinaryUrl: true },
        },
        owner: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            createdAt: true,
            banned: true,
          },
        },
        _count: {
          select: { images: true, reports: { where: { status: 'pending' } } },
        },
      },
    });
    const now = this.clock.now();
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
      ...r,
      owner: { ...r.owner, phone: maskPhone(r.owner.phone) },
      secondsUntilAutoApproval:
        r.autoApproveAt && r.status === 'pending' && !r.heldAt
          ? Math.round((r.autoApproveAt.getTime() - now.getTime()) / 1000)
          : null,
      claimActive: !!(
        r.claimedById &&
        r.claimExpiresAt &&
        r.claimExpiresAt >= now
      ),
    }));
    return {
      track,
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async detail(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        images: { orderBy: { position: 'asc' } },
        institutions: { include: { institution: true } },
        owner: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            createdAt: true,
            banned: true,
            role: true,
            phoneVerified: true,
            idVerificationStatus: true,
            lastActiveAt: true,
            _count: { select: { listings: true } },
          },
        },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    const [decisions, notes, reports, snapshots] = await Promise.all([
      this.prisma.moderationDecision.findMany({
        where: { listingId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.listingNote.findMany({
        where: { listingId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.report.findMany({
        where: { listingId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          reasonCategory: true,
          reason: true,
          status: true,
          createdAt: true,
          reporter: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.listingSnapshot.findMany({
        where: { listingId },
        orderBy: { version: 'desc' },
        take: 20,
        select: { version: true, createdAt: true },
      }),
    ]);
    const now = this.clock.now();
    return {
      ...listing,
      owner: { ...listing.owner, phone: maskPhone(listing.owner.phone) },
      claimActive: !!(
        listing.claimedById &&
        listing.claimExpiresAt &&
        listing.claimExpiresAt >= now
      ),
      secondsUntilAutoApproval:
        listing.autoApproveAt && listing.status === 'pending' && !listing.heldAt
          ? Math.round((listing.autoApproveAt.getTime() - now.getTime()) / 1000)
          : null,
      decisions,
      notes,
      reports,
      snapshotVersions: snapshots,
    };
  }

  async snapshotAt(listingId: string, version: number) {
    const snap = await this.prisma.listingSnapshot.findUnique({
      where: { listingId_version: { listingId, version } },
    });
    if (!snap) throw new NotFoundException('Snapshot not found');
    return snap;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async simpleTransition(
    who: Who,
    listingId: string,
    expectedVersion: number,
    spec: {
      where: Prisma.ListingWhereInput;
      data: Prisma.ListingUpdateManyMutationInput;
      decision: ModerationDecisionType;
      action: string;
      reason: string | null;
      reasonCodes?: string[];
      ownerMessage?: string;
      internalNote?: string;
      notify?: OwnerNotice;
      invalidMessage: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.listing.findUnique({
        where: { id: listingId },
        select: {
          status: true,
          version: true,
          ownerId: true,
          title: true,
          heldAt: true,
          pausedAt: true,
          postReviewStatus: true,
        },
      });
      if (!before) throw new NotFoundException('Listing not found');
      if (before.version !== expectedVersion)
        throw this.versionConflict(before.version, before.status);
      const newVersion = await this.guardedUpdate(
        tx,
        listingId,
        expectedVersion,
        spec.where,
        spec.data,
        spec.invalidMessage,
      );
      const after = await tx.listing.findUniqueOrThrow({
        where: { id: listingId },
        select: {
          status: true,
          heldAt: true,
          pausedAt: true,
          postReviewStatus: true,
        },
      });
      await this.recordDecision(
        tx,
        who,
        listingId,
        spec.decision,
        expectedVersion,
        newVersion,
        {
          reasonCodes: spec.reasonCodes ?? [],
          ownerMessage: spec.ownerMessage,
          internalNote: spec.internalNote ?? spec.reason ?? undefined,
        },
      );
      await snapshotListing(tx, listingId, newVersion);
      await this.audit.record(tx, {
        category: 'admin_action',
        action: spec.action,
        actor: who.actor,
        target: { type: 'listing', id: listingId },
        reason: spec.reason,
        before: {
          status: before.status,
          heldAt: before.heldAt,
          pausedAt: before.pausedAt,
          postReviewStatus: before.postReviewStatus,
          version: expectedVersion,
        },
        after: { ...after, version: newVersion },
        ctx: who.ctx,
      });
      if (spec.notify) {
        await this.notifyOwner(
          tx,
          before.ownerId,
          listingId,
          newVersion,
          spec.notify,
          before.title,
          {
            reasonCodes: spec.reasonCodes ?? [],
            ownerMessage: spec.ownerMessage ?? null,
          },
        );
      }
      return { id: listingId, version: newVersion, ...after };
    });
  }

  private async guardedUpdate(
    tx: Prisma.TransactionClient,
    listingId: string,
    expectedVersion: number,
    where: Prisma.ListingWhereInput,
    data: Prisma.ListingUpdateManyMutationInput,
    invalidMessage = 'This action is not allowed in the listing’s current state',
  ): Promise<number> {
    const res = await tx.listing.updateMany({
      where: { ...where, id: listingId, version: expectedVersion, deletedAt: null },
      data: { ...data, version: { increment: 1 } },
    });
    if (res.count === 1) return expectedVersion + 1;
    const current = await tx.listing.findUnique({
      where: { id: listingId },
      select: { version: true, status: true },
    });
    if (!current) throw new NotFoundException('Listing not found');
    if (current.version !== expectedVersion)
      throw this.versionConflict(current.version, current.status);
    throw this.invalidState(current.status, invalidMessage);
  }

  private async recordDecision(
    tx: Db,
    who: Who,
    listingId: string,
    decision: ModerationDecisionType,
    listingVersion: number,
    resultingVersion: number,
    input: {
      reasonCodes?: string[];
      ownerMessage?: string;
      internalNote?: string;
    },
  ) {
    await tx.moderationDecision.create({
      data: {
        listingId,
        decision,
        listingVersion,
        resultingVersion,
        reasonCodes: input.reasonCodes ?? [],
        ownerMessage: input.ownerMessage ?? null,
        internalNote: input.internalNote ?? null,
        actorType: who.actor.type,
        actorId: who.profileId,
      },
    });
  }

  private async notifyOwner(
    tx: Db,
    ownerId: string,
    listingId: string,
    version: number,
    notice: OwnerNotice,
    listingTitle: string,
    extra: Record<string, unknown>,
  ) {
    const n = OWNER_NOTICES[notice];
    await this.outbox.enqueue(
      tx,
      `listing:${listingId}:v${version}:${notice}`,
      {
        topic: 'notify.user',
        payload: {
          userId: ownerId,
          type: n.type,
          payload: { listingId, listingTitle, decision: notice, ...extra },
          push: {
            title: n.title,
            body: n.body,
            data: { type: n.type, listingId },
          },
        },
      },
    );
  }

  private versionConflict(
    currentVersion: number,
    currentStatus: ListingStatus,
  ) {
    return new ConflictException({
      message:
        'This listing changed since you opened it — reload before acting',
      code: 'LISTING_VERSION_CONFLICT',
      currentVersion,
      currentStatus,
    });
  }

  private invalidState(currentStatus: ListingStatus, message: string) {
    return new ConflictException({
      message,
      code: 'INVALID_STATE',
      currentStatus,
    });
  }
}

type OwnerNotice =
  'approved' | 'rejected' | 'changes_requested' | 'paused' | 'restored';

const OWNER_NOTICES: Record<
  OwnerNotice,
  { type: NotificationType; title: string; body: string }
> = {
  approved: {
    type: 'listing_approved',
    title: 'Listing approved',
    body: 'Your listing is now live and visible to seekers.',
  },
  rejected: {
    type: 'listing_rejected',
    title: 'Listing rejected',
    body: 'Your listing was rejected — check it and resubmit.',
  },
  changes_requested: {
    type: 'listing_rejected',
    title: 'Changes requested',
    body: 'GHOR asked for changes to your listing — edit it and resubmit.',
  },
  paused: {
    type: 'listing_paused',
    title: 'Listing paused',
    body: 'Your listing is temporarily hidden while GHOR reviews it.',
  },
  restored: {
    type: 'listing_restored',
    title: 'Listing restored',
    body: 'Your listing is visible to seekers again.',
  },
};

const QUEUE_SELECT = {
  id: true,
  title: true,
  status: true,
  version: true,
  rent: true,
  locality: true,
  city: true,
  propertyType: true,
  createdAt: true,
  submittedAt: true,
  autoApproveAt: true,
  heldAt: true,
  holdReason: true,
  pausedAt: true,
  pauseReason: true,
  approvalSource: true,
  approvedAt: true,
  postReviewStatus: true,
  claimedById: true,
  claimExpiresAt: true,
} satisfies Prisma.ListingSelect;
