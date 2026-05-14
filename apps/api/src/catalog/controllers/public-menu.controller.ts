import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CatalogService } from "../catalog.service";

@ApiTags("public menu")
@Controller("public/tenants")
export class PublicMenuController {
  constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  @Get(":slug/menu")
  getMenu(@Param("slug") slug: string) {
    return this.catalogService.getPublicMenu(slug);
  }
}
