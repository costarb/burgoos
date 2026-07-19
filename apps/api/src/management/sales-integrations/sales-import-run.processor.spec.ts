import { describe, expect, it, vi } from "vitest";
import { SalesImportRunProcessor } from "./sales-import-run.processor";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("SalesImportRunProcessor", () => {
  it("retoma previews e confirmacoes interrompidas conforme o estado persistido", async () => {
    const prisma = {
      salesImportRun: {
        findMany: vi.fn().mockResolvedValue([
          { id: "pending", tenantId: "tenant", status: "PENDING" },
          { id: "fetching", tenantId: "tenant", status: "FETCHING" },
          { id: "importing", tenantId: "tenant", status: "IMPORTING" },
        ]),
        updateMany: vi.fn(),
      },
    };
    const preview = {
      process: vi
        .fn()
        .mockResolvedValue({ provider: "PAGBANK", status: "PREVIEW_READY", counts: {} }),
    };
    const confirmation = {
      confirm: vi.fn().mockResolvedValue({ provider: "PAGBANK", status: "COMPLETED", counts: {} }),
    };
    const processor = new SalesImportRunProcessor(
      prisma as never,
      preview as never,
      confirmation as never
    );

    await processor.onModuleInit();
    await flush();

    expect(preview.process).toHaveBeenCalledTimes(2);
    expect(confirmation.confirm).toHaveBeenCalledWith("tenant", "importing", true);
  });

  it("nao persiste nem registra a mensagem original de uma falha", async () => {
    const leaked = "TOKEN-super-secreto";
    const prisma = {
      salesImportRun: {
        findMany: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const preview = { process: vi.fn().mockRejectedValue(new Error(leaked)) };
    const processor = new SalesImportRunProcessor(
      prisma as never,
      preview as never,
      { confirm: vi.fn() } as never
    );
    const logError = vi
      .spyOn(
        (processor as unknown as { logger: { error: (message: string) => void } }).logger,
        "error"
      )
      .mockImplementation(() => undefined);

    processor.queuePreview("run", "tenant");
    await flush();

    expect(JSON.stringify(prisma.salesImportRun.updateMany.mock.calls)).not.toContain(leaked);
    expect(JSON.stringify(logError.mock.calls)).not.toContain(leaked);
    expect(prisma.salesImportRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorCode: "PROCESSING_FAILED",
          errorMessage: "Falha interna durante o processamento",
        }),
      })
    );
  });
});
