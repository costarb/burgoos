import { describe, expect, it } from "vitest";
import { appVersion } from "./app-version";

describe("appVersion", () => {
  it("uses the short Render commit and branch", () => {
    const version = appVersion({ RENDER_GIT_COMMIT: "6d79320f79e5be5ad031a49855752e66f58cc1ef", RENDER_GIT_BRANCH: "main" });
    expect(version).toMatchObject({ commit: "6d79320", branch: "main" });
    expect(new Date(version.startedAt).toString()).not.toBe("Invalid Date");
  });

  it("falls back to GIT_COMMIT and then to dev", () => {
    expect(appVersion({ GIT_COMMIT: "abcdef123456" }).commit).toBe("abcdef1");
    expect(appVersion({})).toMatchObject({ commit: "dev", branch: null });
  });
});
