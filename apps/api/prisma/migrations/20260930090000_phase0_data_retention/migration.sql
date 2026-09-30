-- P0-10 data retention (2026-09-30). Additive only.
-- Account deletion now anonymises the profile (profiles.deleted_at) and an owner "deleting"
-- a listing archives it (listings.deleted_at), so conversations, messages, reports,
-- reviews, moderation decisions, snapshots and audit rows are never destroyed by a user
-- action. The ON DELETE CASCADE foreign keys remain but no application path hard-deletes
-- profiles or listings any more.

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "deleted_at" TIMESTAMP(3);

