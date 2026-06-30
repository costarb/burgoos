-- CreateEnum
CREATE TYPE "AccessUserStatus" AS ENUM ('INVITED', 'ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "AccessProfileStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AccessProfileScope" AS ENUM ('GLOBAL', 'STORE');

-- CreateEnum
CREATE TYPE "AccessPermissionAction" AS ENUM ('VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'MANAGE');

-- CreateEnum
CREATE TYPE "SessionTokenStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PasswordResetPurpose" AS ENUM ('FIRST_ACCESS', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "PasswordResetTokenStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AccessAuditEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'USER_CREATED', 'USER_UPDATED', 'USER_STATUS_CHANGED', 'PROFILE_CREATED', 'PROFILE_UPDATED', 'PERMISSIONS_CHANGED', 'STORE_ASSIGNMENT_CHANGED', 'ACCESS_DENIED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_CHANGED');

-- CreateEnum
CREATE TYPE "AccessAuditResult" AS ENUM ('SUCCESS', 'DENIED', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "status" "AccessUserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN "is_master" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "access_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "AccessProfileScope" NOT NULL DEFAULT 'STORE',
    "status" "AccessProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "screen" TEXT NOT NULL,
    "action" "AccessPermissionAction" NOT NULL,
    "description" TEXT NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_profile_permissions" (
    "profile_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_profile_permissions_pkey" PRIMARY KEY ("profile_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_store_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "can_manage_store_access" BOOLEAN NOT NULL DEFAULT false,
    "status" "AccessProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_store_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "active_tenant_id" UUID,
    "refresh_token_hash" TEXT NOT NULL,
    "status" "SessionTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "session_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "PasswordResetPurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "PasswordResetTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_audit_events" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "target_user_id" UUID,
    "store_id" UUID,
    "event_type" "AccessAuditEventType" NOT NULL,
    "result" "AccessAuditResult" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_is_master_idx" ON "users"("is_master");

-- CreateIndex
CREATE UNIQUE INDEX "access_profiles_tenant_id_name_key" ON "access_profiles"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "access_profiles_tenant_id_status_idx" ON "access_profiles"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "access_profiles_scope_status_idx" ON "access_profiles"("scope", "status");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_area_screen_idx" ON "permissions"("area", "screen");

-- CreateIndex
CREATE INDEX "access_profile_permissions_permission_id_idx" ON "access_profile_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_store_assignments_user_id_tenant_id_key" ON "user_store_assignments"("user_id", "tenant_id");

-- CreateIndex
CREATE INDEX "user_store_assignments_tenant_id_status_idx" ON "user_store_assignments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "user_store_assignments_profile_id_idx" ON "user_store_assignments"("profile_id");

-- CreateIndex
CREATE INDEX "session_tokens_user_id_status_idx" ON "session_tokens"("user_id", "status");

-- CreateIndex
CREATE INDEX "session_tokens_active_tenant_id_idx" ON "session_tokens"("active_tenant_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_status_idx" ON "password_reset_tokens"("user_id", "status");

-- CreateIndex
CREATE INDEX "access_audit_events_store_id_event_type_occurred_at_idx" ON "access_audit_events"("store_id", "event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "access_audit_events_actor_user_id_occurred_at_idx" ON "access_audit_events"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "access_audit_events_target_user_id_occurred_at_idx" ON "access_audit_events"("target_user_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "access_profiles" ADD CONSTRAINT "access_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_profiles" ADD CONSTRAINT "access_profiles_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_profiles" ADD CONSTRAINT "access_profiles_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_profile_permissions" ADD CONSTRAINT "access_profile_permissions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "access_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_profile_permissions" ADD CONSTRAINT "access_profile_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_store_assignments" ADD CONSTRAINT "user_store_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_store_assignments" ADD CONSTRAINT "user_store_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_store_assignments" ADD CONSTRAINT "user_store_assignments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "access_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_tokens" ADD CONSTRAINT "session_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_tokens" ADD CONSTRAINT "session_tokens_active_tenant_id_fkey" FOREIGN KEY ("active_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_audit_events" ADD CONSTRAINT "access_audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_audit_events" ADD CONSTRAINT "access_audit_events_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_audit_events" ADD CONSTRAINT "access_audit_events_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
