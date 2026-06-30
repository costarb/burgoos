import { Injectable } from "@nestjs/common";
import { ACCESS_PERMISSIONS, groupAccessPermissions } from "./permission-catalog";

@Injectable()
export class PermissionsService {
  listGrouped() {
    return groupAccessPermissions();
  }

  listCatalog() {
    return ACCESS_PERMISSIONS;
  }
}
