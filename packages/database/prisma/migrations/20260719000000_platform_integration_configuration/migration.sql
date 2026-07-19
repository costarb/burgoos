CREATE TABLE "platform_integration_configurations" (
    "id" UUID NOT NULL,
    "provider" "SalesProvider" NOT NULL,
    "configuration_ciphertext" TEXT NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_integration_configurations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_integration_configurations_provider_key"
ON "platform_integration_configurations"("provider");
