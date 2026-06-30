import { APIRequestContext, expect, test } from "@playwright/test";

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3001";
const masterEmail = process.env.E2E_MASTER_EMAIL ?? "admin@burgoos.local";
const masterPassword = process.env.E2E_MASTER_PASSWORD ?? "admin123";
const storeAdminEmail = process.env.E2E_STORE_ADMIN_EMAIL ?? "loja.admin@burgoos.local";
const storeAdminPassword = process.env.E2E_STORE_ADMIN_PASSWORD ?? "admin123";

test.describe("store admin access management", () => {
  test("creates Store A users and denies Store B assignment", async ({ request }) => {
    const login = await request.post(`${apiUrl}/api/auth/login`, {
      data: { email: storeAdminEmail, password: storeAdminPassword },
    });
    expect(login.ok()).toBeTruthy();

    const session = (await login.json()) as {
      accessToken: string;
      allowedStores: Array<{ id: string; name: string }>;
    };
    const storeA = session.allowedStores[0];
    expect(storeA?.id).toBeTruthy();
    const storeB = await resolveStoreOutsideAdminScope(request, storeA.id);

    const options = await request.get(`${apiUrl}/api/admin/access/users/options`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(options.ok()).toBeTruthy();

    const optionsBody = (await options.json()) as {
      stores: Array<{ id: string; name: string }>;
      profiles: Array<{ id: string; storeId: string | null; status: string }>;
    };
    expect(optionsBody.stores.map((store) => store.id)).toEqual([storeA.id]);

    const localProfile = optionsBody.profiles.find(
      (profile) =>
        profile.status === "ACTIVE" && (!profile.storeId || profile.storeId === storeA.id)
    );
    expect(localProfile?.id).toBeTruthy();

    const unique = Date.now();
    const created = await request.post(`${apiUrl}/api/admin/access/users`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: {
        login: `e2e.local.${unique}@example.com`,
        name: "E2E Usuario Local",
        email: `e2e.local.${unique}@example.com`,
        isMaster: false,
        assignments: [
          {
            storeId: storeA.id,
            profileId: localProfile!.id,
            canManageStoreAccess: false,
            status: "ACTIVE",
          },
        ],
      },
    });
    expect(created.status()).toBe(201);

    const forbidden = await request.post(`${apiUrl}/api/admin/access/users`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: {
        login: `e2e.cross.${unique}@example.com`,
        name: "E2E Usuario Cross Tenant",
        email: `e2e.cross.${unique}@example.com`,
        isMaster: false,
        assignments: [
          {
            storeId: storeB.id,
            profileId: localProfile!.id,
            canManageStoreAccess: false,
            status: "ACTIVE",
          },
        ],
      },
    });
    expect(forbidden.status()).toBe(403);
  });
});

async function resolveStoreOutsideAdminScope(request: APIRequestContext, storeAId: string) {
  const masterLogin = await request.post(`${apiUrl}/api/auth/login`, {
    data: { email: masterEmail, password: masterPassword },
  });
  expect(masterLogin.ok()).toBeTruthy();

  const masterSession = (await masterLogin.json()) as {
    allowedStores: Array<{ id: string; name: string }>;
  };
  const store = masterSession.allowedStores.find((candidate) => candidate.id !== storeAId);
  expect(store?.id).toBeTruthy();

  return store!;
}
