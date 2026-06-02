-- CreateEnum
CREATE TYPE "PlatformUserRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "VisualConfigurationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NeutralTheme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM_DEFAULT');

-- CreateEnum
CREATE TYPE "LayoutPresetSurface" AS ENUM ('PUBLIC_MENU', 'ADMIN_CUE', 'BOTH');

-- CreateTable
CREATE TABLE "platform_users" (
    "id" UUID NOT NULL,
    "role" "PlatformUserRole" NOT NULL DEFAULT 'SUPPORT',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layout_presets" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "target_surface" "LayoutPresetSurface" NOT NULL DEFAULT 'PUBLIC_MENU',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "layout_presets_pkey" PRIMARY KEY ("key")
);

-- Seed required default before adding the tenant foreign key.
INSERT INTO "layout_presets" ("key", "name", "description", "target_surface", "active", "updated_at")
VALUES ('classic', 'Classico', 'Menu familiar com categorias em destaque.', 'PUBLIC_MENU', true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- AlterTable
ALTER TABLE "tenants"
ADD COLUMN     "setup_completed_at" TIMESTAMP(3),
ADD COLUMN     "deactivated_at" TIMESTAMP(3),
ADD COLUMN     "created_by_platform_user_id" UUID,
ADD COLUMN     "default_layout_preset_key" TEXT NOT NULL DEFAULT 'classic';

-- CreateTable
CREATE TABLE "store_visual_configurations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" "VisualConfigurationStatus" NOT NULL DEFAULT 'DRAFT',
    "logo_url" TEXT,
    "primary_color" TEXT NOT NULL,
    "accent_color" TEXT NOT NULL,
    "neutral_theme" "NeutralTheme" NOT NULL DEFAULT 'LIGHT',
    "layout_preset_key" TEXT NOT NULL,
    "created_by_user_id" UUID,
    "published_by_user_id" UUID,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_visual_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

-- CreateIndex
CREATE INDEX "tenants_created_by_platform_user_id_idx" ON "tenants"("created_by_platform_user_id");

-- CreateIndex
CREATE INDEX "tenants_default_layout_preset_key_idx" ON "tenants"("default_layout_preset_key");

-- CreateIndex
CREATE INDEX "store_visual_configurations_tenant_id_status_idx" ON "store_visual_configurations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "store_visual_configurations_layout_preset_key_idx" ON "store_visual_configurations"("layout_preset_key");

-- CreateIndex
CREATE INDEX "store_visual_configurations_created_by_user_id_idx" ON "store_visual_configurations"("created_by_user_id");

-- CreateIndex
CREATE INDEX "store_visual_configurations_published_by_user_id_idx" ON "store_visual_configurations"("published_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_visual_configurations_one_published_per_tenant_idx"
ON "store_visual_configurations"("tenant_id")
WHERE "status" = 'PUBLISHED';

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_created_by_platform_user_id_fkey" FOREIGN KEY ("created_by_platform_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_default_layout_preset_key_fkey" FOREIGN KEY ("default_layout_preset_key") REFERENCES "layout_presets"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_visual_configurations" ADD CONSTRAINT "store_visual_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_visual_configurations" ADD CONSTRAINT "store_visual_configurations_layout_preset_key_fkey" FOREIGN KEY ("layout_preset_key") REFERENCES "layout_presets"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_visual_configurations" ADD CONSTRAINT "store_visual_configurations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_visual_configurations" ADD CONSTRAINT "store_visual_configurations_published_by_user_id_fkey" FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
