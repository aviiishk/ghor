-- CreateEnum
CREATE TYPE "approval_source" AS ENUM ('manual', 'automatic_5min', 'automatic_verified');

-- CreateEnum
CREATE TYPE "post_review_status" AS ENUM ('pending', 'confirmed', 'escalated');

-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('admin', 'senior_reviewer', 'super_admin');

-- CreateEnum
CREATE TYPE "admin_user_status" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "admin_session_state" AS ENUM ('pending_mfa', 'reenroll_required', 'active');

-- CreateEnum
CREATE TYPE "moderation_decision_type" AS ENUM ('approve', 'reject', 'request_changes', 'hold', 'release_hold', 'pause', 'restore', 'post_review_confirm', 'post_review_reject', 'post_review_escalate', 'auto_approve', 'system_hold');

-- CreateEnum
CREATE TYPE "audit_category" AS ENUM ('admin_action', 'security', 'data_access', 'system', 'user_action');

-- CreateEnum
CREATE TYPE "audit_actor_type" AS ENUM ('admin', 'user', 'system', 'anonymous');

-- CreateEnum
CREATE TYPE "alert_severity" AS ENUM ('info', 'warning', 'critical');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type" ADD VALUE 'listing_paused';
ALTER TYPE "notification_type" ADD VALUE 'listing_restored';
ALTER TYPE "notification_type" ADD VALUE 'security_alert';

-- AlterTable
ALTER TABLE "app_config" ADD COLUMN     "updated_by_id" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "approval_source" "approval_source",
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" TEXT,
ADD COLUMN     "auto_approve_at" TIMESTAMP(3),
ADD COLUMN     "claim_expires_at" TIMESTAMP(3),
ADD COLUMN     "claimed_at" TIMESTAMP(3),
ADD COLUMN     "claimed_by_id" TEXT,
ADD COLUMN     "held_at" TIMESTAMP(3),
ADD COLUMN     "held_by_id" TEXT,
ADD COLUMN     "hold_reason" TEXT,
ADD COLUMN     "pause_reason" TEXT,
ADD COLUMN     "paused_at" TIMESTAMP(3),
ADD COLUMN     "paused_by_id" TEXT,
ADD COLUMN     "post_review_status" "post_review_status",
ADD COLUMN     "submitted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "resolution_note" TEXT,
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "resolved_by_id" TEXT;

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "role" "admin_role" NOT NULL,
    "senior_capability" BOOLEAN NOT NULL DEFAULT false,
    "status" "admin_user_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "disabled_at" TIMESTAMP(3),
    "totp_secret_ciphertext" TEXT,
    "totp_enrolled_at" TIMESTAMP(3),
    "totp_last_time_step" INTEGER,
    "pending_totp_secret_ciphertext" TEXT,
    "pending_totp_created_at" TIMESTAMP(3),
    "totp_failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "totp_locked_until" TIMESTAMP(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "state" "admin_session_state" NOT NULL,
    "method" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "idle_expires_at" TIMESTAMP(3) NOT NULL,
    "absolute_expires_at" TIMESTAMP(3) NOT NULL,
    "mfa_verified_at" TIMESTAMP(3),
    "step_up_at" TIMESTAMP(3),
    "refresh_token_hash" TEXT,
    "previous_refresh_token_hash" TEXT,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_recovery_codes" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "admin_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "audit_category" NOT NULL,
    "action" TEXT NOT NULL,
    "actor_type" "audit_actor_type" NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "target_type" TEXT,
    "target_id" TEXT,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "session_id" TEXT,
    "request_id" TEXT,
    "ip_hash" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_decisions" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "decision" "moderation_decision_type" NOT NULL,
    "listing_version" INTEGER NOT NULL,
    "resulting_version" INTEGER NOT NULL,
    "reason_codes" TEXT[],
    "owner_message" TEXT,
    "internal_note" TEXT,
    "actor_type" "audit_actor_type" NOT NULL,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_snapshots" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_notes" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_state" (
    "name" TEXT NOT NULL,
    "lease_holder" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_error" TEXT,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "job_state_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_alerts" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" "alert_severity" NOT NULL,
    "message" TEXT NOT NULL,
    "dedupe_key" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by_id" TEXT,
    "ack_note" TEXT,

    CONSTRAINT "system_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "window_ends_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_profile_id_key" ON "admin_users"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_refresh_token_hash_key" ON "admin_sessions"("refresh_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_previous_refresh_token_hash_key" ON "admin_sessions"("previous_refresh_token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_user_id_idx" ON "admin_sessions"("admin_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_recovery_codes_code_hash_key" ON "admin_recovery_codes"("code_hash");

-- CreateIndex
CREATE INDEX "admin_recovery_codes_admin_user_id_idx" ON "admin_recovery_codes"("admin_user_id");

-- CreateIndex
CREATE INDEX "audit_log_target_type_target_id_created_at_idx" ON "audit_log"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_created_at_idx" ON "audit_log"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_category_created_at_idx" ON "audit_log"("category", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "moderation_decisions_listing_id_created_at_idx" ON "moderation_decisions"("listing_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "listing_snapshots_listing_id_version_key" ON "listing_snapshots"("listing_id", "version");

-- CreateIndex
CREATE INDEX "listing_notes_listing_id_created_at_idx" ON "listing_notes"("listing_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_dedupe_key_key" ON "outbox_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "outbox_events_processed_at_next_attempt_at_idx" ON "outbox_events"("processed_at", "next_attempt_at");

-- CreateIndex
CREATE INDEX "job_runs_job_name_started_at_idx" ON "job_runs"("job_name", "started_at");

-- CreateIndex
CREATE INDEX "system_alerts_acknowledged_at_created_at_idx" ON "system_alerts"("acknowledged_at", "created_at");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_window_ends_at_idx" ON "rate_limit_buckets"("window_ends_at");

-- CreateIndex
CREATE INDEX "events_event_name_created_at_idx" ON "events"("event_name", "created_at");

-- CreateIndex
CREATE INDEX "listings_status_auto_approve_at_idx" ON "listings"("status", "auto_approve_at");

-- CreateIndex
CREATE INDEX "listings_status_submitted_at_idx" ON "listings"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_recovery_codes" ADD CONSTRAINT "admin_recovery_codes_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- =============================================================================
-- Hand-written additions (not expressible in schema.prisma)
-- =============================================================================

-- Audit log is append-only at the database level: any UPDATE or DELETE raises. The
-- application has no update/delete path either; this is the backstop against a bug or a
-- compromised API process rewriting history. (TRUNCATE remains a database-owner operation.)
CREATE OR REPLACE FUNCTION audit_log_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (% blocked)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();

-- At most one OPEN (unacknowledged) alert per dedupe key.
CREATE UNIQUE INDEX "system_alerts_open_dedupe_key"
  ON "system_alerts"("dedupe_key")
  WHERE "acknowledged_at" IS NULL AND "dedupe_key" IS NOT NULL;

-- One open report per reporter per listing, enforced atomically (the service-level check
-- alone is racy under concurrent submits).
CREATE UNIQUE INDEX "reports_one_open_per_reporter"
  ON "reports"("listing_id", "reporter_id")
  WHERE "status" = 'pending';

-- Existing listings: every approved listing so far was approved by a human.
UPDATE "listings" SET "approval_source" = 'manual', "approved_at" = "updated_at"
  WHERE "status" IN ('approved', 'rented');
UPDATE "listings" SET "submitted_at" = "updated_at" WHERE "status" = 'pending';

-- Existing admins (profiles.role = 'admin') become AdminUser rows with the LEAST-privileged
-- admin role. Promotion to senior_reviewer / super_admin is a founder decision (audit F-01)
-- done through the console (roles.manage + step-up) or the ADMIN_PHONES break-glass path.
-- No one receives super_admin implicitly. Everyone must enroll TOTP on first console login.
INSERT INTO "admin_users" ("id", "profile_id", "role", "status", "created_at")
SELECT gen_random_uuid()::text, "id", 'admin', 'active', now()
FROM "profiles" WHERE "role" = 'admin'
ON CONFLICT ("profile_id") DO NOTHING;
