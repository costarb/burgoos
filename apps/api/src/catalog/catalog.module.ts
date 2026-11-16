import { Module } from "@nestjs/common";
import { BrandingModule } from "../customer-experience/branding/branding.module";
import { AuthModule } from "../platform/auth/auth.module";
import { CatalogService } from "./catalog.service";
import { AdminCategoryController } from "./controllers/admin-category.controller";
import { AdminProductController } from "./controllers/admin-product.controller";
import { PublicMenuController } from "./controllers/public-menu.controller";
import { PublicDomainMenuController } from "./controllers/public-domain-menu.controller";
import { AdminProductComplementController } from "./controllers/admin-product-complement.controller";
import { ProductComplementService } from "./product-complement.service";
import { StorageModule } from "../common/storage/storage.module";
import { BackgroundJobsModule } from "../common/background-jobs/background-jobs.module";
import { AdminLegacyImageController } from "./controllers/admin-legacy-image.controller";
import { LegacyImageMigrationService } from "./legacy-image-migration.service";

@Module({
  imports: [AuthModule, BrandingModule, StorageModule, BackgroundJobsModule],
  controllers: [
    AdminCategoryController,
    AdminProductController,
    PublicMenuController,
    PublicDomainMenuController,
    AdminProductComplementController,
    AdminLegacyImageController,
  ],
  providers: [CatalogService, ProductComplementService, LegacyImageMigrationService],
  exports: [CatalogService, ProductComplementService],
})
export class CatalogModule {}
