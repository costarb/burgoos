import { describe, expect, it } from "vitest";

import { BackgroundJobPolicy, type FairJobCandidate } from "./background-job-policy";

describe("BackgroundJobPolicy", () => {
  it("uses bounded exponential backoff", () => {
    const policy = new BackgroundJobPolicy(1_000, 5_000, 0);

    expect([1, 2, 3, 4, 5].map((attempt) => policy.retryDelayMs(attempt))).toEqual([
      1_000,
      2_000,
      4_000,
      5_000,
      5_000,
    ]);
  });

  it("applies deterministic bounded jitter", () => {
    const policy = new BackgroundJobPolicy(1_000, 10_000, 0.2);

    expect(policy.retryDelayMs(2, () => 0)).toBe(1_600);
    expect(policy.retryDelayMs(2, () => 0.5)).toBe(2_000);
    expect(policy.retryDelayMs(2, () => 1)).toBe(2_400);
  });

  it("stops retrying at max attempts", () => {
    const policy = new BackgroundJobPolicy();

    expect(policy.canRetry({ attempts: 4, maxAttempts: 5 })).toBe(true);
    expect(policy.canRetry({ attempts: 5, maxAttempts: 5 })).toBe(false);
  });

  it("orders higher priorities before lower priorities", () => {
    const policy = new BackgroundJobPolicy();
    const candidates = [
      candidate("low", "tenant-a", "LOW", 1),
      candidate("critical", "tenant-a", "CRITICAL", 2),
      candidate("normal", "tenant-a", "NORMAL", 0),
    ];

    expect(policy.orderFairly(candidates).map(({ id }) => id)).toEqual([
      "critical",
      "normal",
      "low",
    ]);
  });

  it("round-robins tenants while preserving each tenant queue order", () => {
    const policy = new BackgroundJobPolicy();
    const candidates = [
      candidate("a-1", "tenant-a", "NORMAL", 1),
      candidate("a-2", "tenant-a", "NORMAL", 2),
      candidate("a-3", "tenant-a", "NORMAL", 3),
      candidate("b-1", "tenant-b", "NORMAL", 4),
      candidate("b-2", "tenant-b", "NORMAL", 5),
    ];

    expect(policy.orderFairly(candidates).map(({ id }) => id)).toEqual([
      "a-1",
      "b-1",
      "a-2",
      "b-2",
      "a-3",
    ]);
  });

  it("does not group system jobs into one synthetic tenant", () => {
    const policy = new BackgroundJobPolicy();
    const candidates = [
      candidate("system-1", null, "NORMAL", 1),
      candidate("tenant-1", "tenant-a", "NORMAL", 2),
      candidate("system-2", null, "NORMAL", 3),
    ];

    expect(policy.orderFairly(candidates).map(({ id }) => id)).toEqual([
      "system-1",
      "tenant-1",
      "system-2",
    ]);
  });
});

function candidate(
  id: string,
  tenantId: string | null,
  priority: FairJobCandidate["priority"],
  createdOffset: number
): FairJobCandidate {
  return {
    id,
    tenantId,
    priority,
    availableAt: new Date("2026-08-07T12:00:00.000Z"),
    createdAt: new Date(Date.UTC(2026, 7, 7, 12, 0, createdOffset)),
  };
}
