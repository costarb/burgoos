CREATE TYPE "OrderMaintenanceAction" AS ENUM ('EDIT', 'DELETE');

ALTER TABLE "orders"
ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by_user_id" UUID,
ADD COLUMN "deletion_reason" TEXT;

CREATE TABLE "order_maintenances" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "action" "OrderMaintenanceAction" NOT NULL,
  "reason" TEXT NOT NULL,
  "expected_updated_at" TIMESTAMP(3) NOT NULL,
  "before_snapshot" JSONB NOT NULL,
  "after_snapshot" JSONB,
  "impact_summary" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_maintenances_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "orders" ADD CONSTRAINT "orders_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_maintenances" ADD CONSTRAINT "order_maintenances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_maintenances" ADD CONSTRAINT "order_maintenances_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_maintenances" ADD CONSTRAINT "order_maintenances_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "orders_tenant_id_deleted_at_idx" ON "orders"("tenant_id", "deleted_at");
CREATE INDEX "orders_deleted_by_user_id_idx" ON "orders"("deleted_by_user_id");
CREATE INDEX "order_maintenances_tenant_id_order_id_created_at_idx" ON "order_maintenances"("tenant_id", "order_id", "created_at");
CREATE INDEX "order_maintenances_tenant_id_actor_user_id_created_at_idx" ON "order_maintenances"("tenant_id", "actor_user_id", "created_at");
CREATE INDEX "order_maintenances_tenant_id_action_created_at_idx" ON "order_maintenances"("tenant_id", "action", "created_at");
