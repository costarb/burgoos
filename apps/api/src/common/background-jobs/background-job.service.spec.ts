import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { BackgroundJobRepository } from "./background-job.repository";
import { BackgroundJobService } from "./background-job.service";

describe("BackgroundJobService", () => {
  it("requires tenant scope for tenant-owned handlers", () => {
    const service = serviceWithRepository();
    expect(() => service.enqueue({ type: "IFOOD_POLL", targetType: "DeliveryIntegration", targetId: "one" })).toThrow(BadRequestException);
  });

  it("rejects routing payloads above 16 KiB", () => {
    const service = serviceWithRepository();
    expect(() => service.enqueue({ type: "RETENTION", targetType: "Maintenance", targetId: "one", payload: { value: "x".repeat(17 * 1024) } })).toThrow("16 KiB");
  });

  it("hashes dedupe material and includes tenant and type", async () => {
    const repository = { enqueue: vi.fn().mockResolvedValue({ id: "job" }) } as unknown as BackgroundJobRepository;
    const service = new BackgroundJobService(repository);
    await service.enqueue({ tenantId: "tenant-a", type: "EXPORT", targetType: "ExportJob", targetId: "one", dedupeKey: "same filters" });
    expect(repository.enqueue).toHaveBeenCalledWith(expect.objectContaining({ activeKey: expect.stringMatching(/^tenant-a:EXPORT:[a-f0-9]{64}$/) }));
  });
});

function serviceWithRepository(): BackgroundJobService {
  return new BackgroundJobService({ enqueue: vi.fn() } as unknown as BackgroundJobRepository);
}
