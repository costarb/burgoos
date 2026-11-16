-- Spec 030: fiscal file recovery and legacy image migration jobs
ALTER TYPE "BackgroundJobType" ADD VALUE 'FISCAL_FILE_RECOVERY';
ALTER TYPE "BackgroundJobType" ADD VALUE 'LEGACY_IMAGE_MIGRATION';

-- AlterTable
ALTER TABLE "fiscal_documents" ADD COLUMN "files_missing_at" TIMESTAMP(3),
ADD COLUMN "files_missing_reason" VARCHAR(500);
