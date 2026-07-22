import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PAGBANK_PAGE_1,
  PAGBANK_PAGE_2,
} from "../../../../test/fixtures/pagbank-edi/pagination-and-errors";
import { PagBankEdiClient } from "./pagbank-edi.client";

describe("PagBankEdiClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses Basic USER:TOKEN, reads every page and requires VALIDADO=true", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(PAGBANK_PAGE_1), { status: 200, headers: { VALIDADO: "TRUE" } })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(PAGBANK_PAGE_2), { status: 200, headers: { VALIDADO: "TRUE" } })
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await new PagBankEdiClient().fetchDay({
      date: "2026-07-15",
      merchantId: "user",
      credential: "token",
    });
    expect(result).toMatchObject({ validated: true, pagesFetched: 2, totalElements: 2 });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      `Basic ${Buffer.from("user:token").toString("base64")}`
    );
  });

  it.each([
    [401, "AUTHENTICATION"],
    [429, "RATE_LIMIT"],
    [503, "UNAVAILABLE"],
  ] as const)("maps HTTP %s safely", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));
    await expect(
      new PagBankEdiClient().fetchDay({
        date: "2026-07-15",
        merchantId: "user",
        credential: "token",
      })
    ).rejects.toMatchObject({ code });
  });

  it("blocks responses without an affirmative VALIDADO header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...PAGBANK_PAGE_1,
            pagination: { ...PAGBANK_PAGE_1.pagination, totalPages: 1 },
          }),
          { status: 200 }
        )
      )
    );
    await expect(
      new PagBankEdiClient().fetchDay({
        date: "2026-07-15",
        merchantId: "user",
        credential: "token",
      })
    ).resolves.toMatchObject({ validated: false });
  });

  it("uses the platform-configured API base URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...PAGBANK_PAGE_1,
          pagination: { ...PAGBANK_PAGE_1.pagination, totalPages: 1 },
        }),
        { status: 200, headers: { VALIDADO: "TRUE" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new PagBankEdiClient({
      apiBaseUrl: vi.fn().mockResolvedValue("https://pagbank.test/"),
    } as never);
    await client.fetchDay({ date: "2026-07-21", merchantId: "user", credential: "token" });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "https://pagbank.test/movement/v3.00/transactional/2026-07-21"
    );
  });
});
