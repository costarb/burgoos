-- CreateEnum
CREATE TYPE "McpDataArea" AS ENUM ('SALES', 'FINANCIAL', 'MENU', 'CASH', 'PAYABLES', 'INVENTORY');

-- CreateEnum
CREATE TYPE "McpToolCallResult" AS ENUM ('SUCCESS', 'ERROR', 'DENIED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccessAuditEventType" ADD VALUE 'MCP_CONFIGURATION_CHANGED';
ALTER TYPE "AccessAuditEventType" ADD VALUE 'MCP_TOKEN_CREATED';
ALTER TYPE "AccessAuditEventType" ADD VALUE 'MCP_TOKEN_REVOKED';

-- CreateTable
CREATE TABLE "store_mcp_configurations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabled_areas" "McpDataArea"[] DEFAULT ARRAY['SALES', 'FINANCIAL', 'MENU', 'CASH', 'PAYABLES', 'INVENTORY']::"McpDataArea"[],
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_mcp_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_mcp_tokens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "token_prefix" VARCHAR(16) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_by_user_id" UUID,
    "last_used_at" TIMESTAMP(3),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_mcp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_tool_calls" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "token_id" UUID,
    "method" VARCHAR(40) NOT NULL,
    "target" VARCHAR(80),
    "arguments" JSONB,
    "result" "McpToolCallResult" NOT NULL,
    "error_code" VARCHAR(40),
    "duration_ms" INTEGER NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_mcp_configurations_tenant_id_key" ON "store_mcp_configurations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_mcp_tokens_token_hash_key" ON "store_mcp_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "store_mcp_tokens_tenant_id_revoked_at_idx" ON "store_mcp_tokens"("tenant_id", "revoked_at");

-- CreateIndex
CREATE INDEX "mcp_tool_calls_tenant_id_occurred_at_idx" ON "mcp_tool_calls"("tenant_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "mcp_tool_calls_tenant_id_token_id_occurred_at_idx" ON "mcp_tool_calls"("tenant_id", "token_id", "occurred_at");

-- CreateIndex
CREATE INDEX "mcp_tool_calls_occurred_at_idx" ON "mcp_tool_calls"("occurred_at");

-- AddForeignKey
ALTER TABLE "store_mcp_configurations" ADD CONSTRAINT "store_mcp_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_mcp_configurations" ADD CONSTRAINT "store_mcp_configurations_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_mcp_tokens" ADD CONSTRAINT "store_mcp_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_mcp_tokens" ADD CONSTRAINT "store_mcp_tokens_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_mcp_tokens" ADD CONSTRAINT "store_mcp_tokens_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "store_mcp_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

