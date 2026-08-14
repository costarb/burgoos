import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { MemoryPressureService } from "../src/common/observability/memory-pressure.service";

describe("resource admission", () => {
  it("keeps critical operational work admissible under high RSS", async () => {
    const module = await Test.createTestingModule({
      providers: [
        MemoryPressureService,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            MEMORY_WARNING_RSS_MB: 400,
            MEMORY_HIGH_RSS_MB: 440,
            MEMORY_PEAK_RSS_MB: 460,
            MEMORY_PRESSURE_CONSECUTIVE_SAMPLES: 2,
          }),
        },
      ],
    }).compile();
    const pressure = module.get(MemoryPressureService);
    pressure.observe(450 * 1024 * 1024);
    pressure.observe(450 * 1024 * 1024);

    expect(pressure.canAdmit("CRITICAL")).toBe(true);
    expect(pressure.canAdmit("NORMAL")).toBe(false);
    expect(pressure.canAdmit("LOW")).toBe(false);
    await module.close();
  });
});
