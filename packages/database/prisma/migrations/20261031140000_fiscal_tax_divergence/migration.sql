-- AlterEnum
ALTER TYPE "FiscalDocumentEventType" ADD VALUE 'TAX_DIVERGENCE';
ALTER TYPE "FiscalDocumentEventType" ADD VALUE 'TAX_DIVERGENCE_REVIEWED';

-- AlterTable
ALTER TABLE "fiscal_documents" ADD COLUMN "tax_divergences" JSONB,
ADD COLUMN "tax_divergence_at" TIMESTAMP(3),
ADD COLUMN "tax_divergence_reviewed_at" TIMESTAMP(3);
