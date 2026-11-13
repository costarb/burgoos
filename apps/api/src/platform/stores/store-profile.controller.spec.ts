import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { REQUIRED_PERMISSION_KEY } from "../../auth/guards/require-permission.decorator";
import { STORE_PROFILE_PERMISSION, StoreProfileController } from "./store-profile.controller";

describe("StoreProfileController", () => {
  const user = { id: "user-1", tenantId: "store-a", role: "ADMIN" } as never;

  it("always works on the store of the session and requires the store profile permission", async () => {
    const stores = { get: vi.fn(async () => ({ id: "store-a" })), updateOwnStore: vi.fn(async () => ({ id: "store-a" })) };
    const controller = new StoreProfileController(stores as never);

    await controller.get(user);
    await controller.update(user, { name: "Novo", slug: "x" } as never);

    expect(stores.get).toHaveBeenCalledWith("store-a");
    expect(stores.updateOwnStore).toHaveBeenCalledWith("store-a", { name: "Novo", slug: "x" }, "user-1");
    expect(Reflect.getMetadata(REQUIRED_PERMISSION_KEY, StoreProfileController)).toEqual([STORE_PROFILE_PERMISSION]);
  });
});
