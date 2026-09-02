import { describe, expect, it } from "vitest";
import { normalizeQueryValues } from "./cash-flow.controller";

describe("normalizeQueryValues", () => {
  it("keeps legacy singular values", () => {
    expect(normalizeQueryValues("account-1")).toEqual(["account-1"]);
  });

  it("deduplicates repeated query values and removes empty items", () => {
    expect(normalizeQueryValues(["account-1", " ", "account-2", "account-1"])).toEqual([
      "account-1",
      "account-2",
    ]);
  });

  it("treats an absent query as all accounts", () => {
    expect(normalizeQueryValues()).toEqual([]);
  });
});
