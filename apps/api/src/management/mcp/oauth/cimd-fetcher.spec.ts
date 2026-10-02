import { describe, expect, it, vi } from "vitest";
import { CimdFetcher, isPrivateAddress } from "./cimd-fetcher";

const URL_ID = "https://client.example.com/oauth/client.json";

function fetcherWith(response: Response | (() => Promise<Response>), address = "93.184.216.34") {
  const fetcher = new CimdFetcher();
  fetcher.lookupImpl = vi.fn(async () => [{ address, family: 4 }]);
  fetcher.fetchImpl = vi.fn(async () => (typeof response === "function" ? response() : response)) as never;
  return fetcher;
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

describe("CimdFetcher", () => {
  it("returns the validated client metadata", async () => {
    const fetcher = fetcherWith(
      json({ client_id: URL_ID, client_name: " Claude ", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] })
    );
    await expect(fetcher.fetch(URL_ID)).resolves.toEqual({
      clientId: URL_ID,
      clientName: "Claude",
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
    });
    expect(fetcher.fetchImpl).toHaveBeenCalledWith(URL_ID, expect.objectContaining({ redirect: "manual" }));
  });

  it.each([
    "http://client.example.com/client.json",
    "https://client.example.com/",
    "https://user:pass@client.example.com/client.json",
    "nao-e-url",
  ])("rejects the client_id %s", async (clientId) => {
    await expect(fetcherWith(json({})).fetch(clientId)).rejects.toThrow();
  });

  it("refuses hosts resolving to private addresses", async () => {
    await expect(fetcherWith(json({}), "10.0.0.5").fetch(URL_ID)).rejects.toThrow("nao permitido");
    await expect(fetcherWith(json({}), "127.0.0.1").fetch(URL_ID)).rejects.toThrow("nao permitido");
  });

  it("refuses redirects, errors, oversized and invalid documents", async () => {
    await expect(fetcherWith(new Response(null, { status: 302, headers: { location: "https://x" } })).fetch(URL_ID)).rejects.toThrow("302");
    await expect(fetcherWith(new Response("x", { status: 500 })).fetch(URL_ID)).rejects.toThrow("500");
    await expect(fetcherWith(json({ pad: "x".repeat(70_000) })).fetch(URL_ID)).rejects.toThrow("muito grande");
    await expect(fetcherWith(new Response("{", { status: 200 })).fetch(URL_ID)).rejects.toThrow("invalida");
    await expect(
      fetcherWith(json({ client_id: "https://other.example.com/c.json", redirect_uris: ["https://a.com/cb"] })).fetch(URL_ID)
    ).rejects.toThrow("nao corresponde");
    await expect(fetcherWith(json({ client_id: URL_ID, redirect_uris: [] })).fetch(URL_ID)).rejects.toThrow("retorno");
    await expect(
      fetcherWith(json({ client_id: URL_ID, redirect_uris: ["http://evil.example.com/cb"] })).fetch(URL_ID)
    ).rejects.toThrow("retorno");
  });

  it("aborts slow responses", async () => {
    vi.useFakeTimers();
    const fetcher = new CimdFetcher();
    fetcher.lookupImpl = async () => [{ address: "93.184.216.34", family: 4 }];
    fetcher.fetchImpl = ((_input: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as never;
    const pending = fetcher.fetch(URL_ID);
    const assertion = expect(pending).rejects.toThrow("Nao foi possivel");
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    vi.useRealTimers();
  });
});

describe("isPrivateAddress", () => {
  it.each(["10.1.2.3", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])(
    "flags %s",
    (address) => expect(isPrivateAddress(address)).toBe(true)
  );

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::1111"])("allows %s", (address) =>
    expect(isPrivateAddress(address)).toBe(false)
  );
});
