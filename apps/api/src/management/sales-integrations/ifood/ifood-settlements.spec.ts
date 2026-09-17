import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ifoodReconciliationFileFixture,
  ifoodSettlementsFixture,
} from "./__fixtures__/ifood-financial.fixtures";
import { IfoodFinancialClient } from "./ifood-financial.client";
import { mapIfoodSettlements } from "./ifood-financial-reconciliation.mapper";

afterEach(() => vi.unstubAllGlobals());
const client = () =>
  new IfoodFinancialClient({
    get: vi.fn((key: string) =>
      key === "IFOOD_FINANCIAL_BASE_URL" ? "https://financial.example" : 50
    ),
  } as never);

describe("iFood Settlements and Reconciliation On Demand", () => {
  it.each(["REPASSE", "BOLETO", "REGISTRO_RECEBIVEIS", "RENEGOCIADA"])(
    "maps closing title %s with status and dates",
    (type) => {
      const payload = structuredClone(ifoodSettlementsFixture) as unknown as {
        settlements: Array<{ closingItems: Array<Record<string, unknown>> }>;
      };
      payload.settlements[0]!.closingItems[0]!.type = type;
      const mapped = mapIfoodSettlements(payload.settlements as never)[0]!;
      expect(mapped).toMatchObject({ type, status: "SUCCEED", netAmount: 42 });
      expect(mapped.expectedPaymentDate?.toISOString()).toBe("2026-09-09T00:00:00.000Z");
    }
  );

  it("requests an asynchronous file and refreshes its temporary URL", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify(ifoodReconciliationFileFixture), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const requested = await client().requestReconciliationFile({
      accessToken: "token",
      merchantId: "merchant",
      competence: "2026-09",
    });
    const refreshed = await client().getReconciliationFile({
      accessToken: "token",
      requestId: requested.requestId,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      merchantId: "merchant",
      competencia: "2026-09",
    });
    expect(fetchMock.mock.calls[1]?.[0].toString()).toContain(
      "/v3/reconciliation-on-demand/reconciliation-request-1"
    );
    expect(refreshed.downloadUrl).toContain("reconciliation.csv.gz");
  });
});
