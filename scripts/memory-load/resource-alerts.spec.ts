import { describe, expect, it } from "vitest";
import { resourceAlerts } from "./resource-alerts";

describe("resource alerts", () => {
  it("requires sustained pressure but escalates peak RSS immediately with safe correlation", () => {
    const mib = 1024 * 1024;
    const alerts = resourceAlerts([
      { role: "worker", rss: 405 * mib, level: "WARNING", activeHandler: "EXPORT", correlationId: "job-1" },
      { role: "worker", rss: 410 * mib, level: "WARNING", activeHandler: "EXPORT", correlationId: "job-1" },
      { role: "api", rss: 461 * mib, level: "HIGH" },
    ], 460 * mib);
    expect(alerts).toEqual([
      { severity: "warning", role: "worker", handler: "EXPORT", correlationId: "job-1" },
      { severity: "critical", role: "api", handler: undefined, correlationId: undefined },
    ]);
  });
});
