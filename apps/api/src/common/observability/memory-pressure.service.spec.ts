import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import { MemoryPressureService } from "./memory-pressure.service";

describe("MemoryPressureService", () => {
  it("requires two consecutive samples to enter warning and high pressure", () => {
    const pressure = service();
    expect(pressure.observe(mb(401))).toBe("NORMAL");
    expect(pressure.observe(mb(401))).toBe("WARNING");
    expect(pressure.observe(mb(441))).toBe("WARNING");
    expect(pressure.observe(mb(441))).toBe("HIGH");
  });

  it("jumps directly to high only after two high samples", () => {
    const pressure = service();
    expect(pressure.observe(mb(450))).toBe("NORMAL");
    expect(pressure.observe(mb(450))).toBe("HIGH");
  });

  it("uses two-sample recovery hysteresis", () => {
    const pressure = service();
    pressure.observe(mb(450));
    pressure.observe(mb(450));
    expect(pressure.observe(mb(430))).toBe("HIGH");
    expect(pressure.observe(mb(430))).toBe("WARNING");
    expect(pressure.observe(mb(390))).toBe("WARNING");
    expect(pressure.observe(mb(390))).toBe("NORMAL");
  });

  it("resets a transition candidate when samples stop being consecutive", () => {
    const pressure = service();
    pressure.observe(mb(410));
    pressure.observe(mb(390));
    expect(pressure.observe(mb(410))).toBe("NORMAL");
  });

  it("admits only high/critical work during high pressure", () => {
    const pressure = service();
    pressure.observe(mb(450));
    pressure.observe(mb(450));
    expect(pressure.canAdmit("LOW")).toBe(false);
    expect(pressure.canAdmit("NORMAL")).toBe(false);
    expect(pressure.canAdmit("HIGH")).toBe(true);
    expect(pressure.canAdmit("CRITICAL")).toBe(true);
  });
});

function service(): MemoryPressureService {
  return new MemoryPressureService(
    new ConfigService({
      MEMORY_WARNING_RSS_MB: 400,
      MEMORY_HIGH_RSS_MB: 440,
      MEMORY_PEAK_RSS_MB: 460,
      MEMORY_PRESSURE_CONSECUTIVE_SAMPLES: 2,
    })
  );
}

function mb(value: number): number {
  return value * 1024 * 1024;
}
