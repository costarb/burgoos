import { Module } from "@nestjs/common";
import { AuthModule } from "../platform/auth/auth.module";
import { CatalogService } from "./catalog.service";
import { AdminCategoryController } from "./controllers/admin-category.controller";
import { AdminProductController } from "./controllers/admin-product.controller";
import { PublicMenuController } from "./controllers/public-menu.controller";

@Module({
  imports: [AuthModule],
  controllers: [AdminCategoryController, AdminProductController, PublicMenuController],
  providers: [CatalogService],
  exports: [CatalogService]
})
export class CatalogModule {}
