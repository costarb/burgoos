-- AlterTable
ALTER TABLE "sales_import_runs" ADD COLUMN     "requested_via" VARCHAR(80);

-- AlterTable
ALTER TABLE "financial_audits" ADD COLUMN     "channel" VARCHAR(80);

-- AlterTable
ALTER TABLE "store_mcp_configurations" ADD COLUMN     "actions_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "mcp_tool_calls" ADD COLUMN     "is_action" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "mcp_tool_calls_tenant_id_connection_id_is_action_occurred_a_idx" ON "mcp_tool_calls"("tenant_id", "connection_id", "is_action", "occurred_at");

