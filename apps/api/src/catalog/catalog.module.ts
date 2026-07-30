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

@Module({
  imports: [AuthModule, BrandingModule],
  controllers: [
    AdminCategoryController,
    AdminProductController,
    PublicMenuController,
    PublicDomainMenuController,
    AdminProductComplementController,
  ],
  providers: [CatalogService, ProductComplementService],
  exports: [CatalogService, ProductComplementService],
})
export class CatalogModule {}
