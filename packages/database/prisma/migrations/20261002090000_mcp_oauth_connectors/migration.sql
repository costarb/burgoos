-- CreateEnum
CREATE TYPE "McpOAuthClientKind" AS ENUM ('CIMD', 'DCR');

-- CreateEnum
CREATE TYPE "McpOAuthRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CONSUMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "McpOAuthTokenKind" AS ENUM ('ACCESS', 'REFRESH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccessAuditEventType" ADD VALUE 'MCP_CONNECTION_AUTHORIZED';
ALTER TYPE "AccessAuditEventType" ADD VALUE 'MCP_CONNECTION_DENIED';
ALTER TYPE "AccessAuditEventType" ADD VALUE 'MCP_CONNECTION_REVOKED';
ALTER TYPE "AccessAuditEventType" ADD VALUE 'MCP_CLIENT_REJECTED';

-- AlterTable
ALTER TABLE "mcp_tool_calls" ADD COLUMN     "connection_id" UUID;

-- CreateTable
CREATE TABLE "mcp_oauth_clients" (
    "id" UUID NOT NULL,
    "client_id" VARCHAR(512) NOT NULL,
    "kind" "McpOAuthClientKind" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "redirect_uris" TEXT[],
    "metadata_fetched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_oauth_authorization_requests" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "redirect_uri" VARCHAR(2048) NOT NULL,
    "state" VARCHAR(512),
    "code_challenge" VARCHAR(128) NOT NULL,
    "scope" VARCHAR(200) NOT NULL,
    "resource" VARCHAR(512) NOT NULL,
    "status" "McpOAuthRequestStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "user_id" UUID,
    "tenant_id" UUID,
    "connection_id" UUID,
    "code_hash" CHAR(64),
    "code_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_oauth_authorization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_oauth_connections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "scope" VARCHAR(200) NOT NULL,
    "resource" VARCHAR(512) NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_by_user_id" UUID,
    "revoked_reason" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_oauth_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_oauth_tokens" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "kind" "McpOAuthTokenKind" NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "rotated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_oauth_clients_client_id_key" ON "mcp_oauth_clients"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_oauth_authorization_requests_code_hash_key" ON "mcp_oauth_authorization_requests"("code_hash");

-- CreateIndex
CREATE INDEX "mcp_oauth_authorization_requests_expires_at_idx" ON "mcp_oauth_authorization_requests"("expires_at");

-- CreateIndex
CREATE INDEX "mcp_oauth_connections_tenant_id_revoked_at_idx" ON "mcp_oauth_connections"("tenant_id", "revoked_at");

-- CreateIndex
CREATE INDEX "mcp_oauth_connections_user_id_idx" ON "mcp_oauth_connections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_oauth_tokens_token_hash_key" ON "mcp_oauth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "mcp_oauth_tokens_connection_id_kind_idx" ON "mcp_oauth_tokens"("connection_id", "kind");

-- CreateIndex
CREATE INDEX "mcp_oauth_tokens_expires_at_idx" ON "mcp_oauth_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "mcp_tool_calls_tenant_id_connection_id_occurred_at_idx" ON "mcp_tool_calls"("tenant_id", "connection_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "mcp_oauth_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_oauth_authorization_requests" ADD CONSTRAINT "mcp_oauth_authorization_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "mcp_oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_oauth_authorization_requests" ADD CONSTRAINT "mcp_oauth_authorization_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_oauth_authorization_requests" ADD CONSTRAINT "mcp_oauth_authorization_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_oauth_authorization_requests" ADD CONSTRAINT "mcp_oauth_authorization_requests_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "mcp_oauth_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_oauth_connections" ADD CONSTRAINT "mcp_oauth_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_oauth_connections" ADD CONSTRAINT "mcp_oauth_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_oauth_connections" ADD CONSTRAINT "mcp_oauth_connections_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_oauth_connections" ADD CONSTRAINT "mcp_oauth_connections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "mcp_oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_oauth_tokens" ADD CONSTRAINT "mcp_oauth_tokens_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "mcp_oauth_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

