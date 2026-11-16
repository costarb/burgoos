import { describe, expect, it, vi } from "vitest";
import { decodeLegacyImage, normalizeImageReference, resolveImageUrl } from "./image-values";

const tenantId = "11111111-1111-4111-8111-111111111111";
const key = `images/${tenantId}/product/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`;
const legacyKey = `tenants/${tenantId}/images/product_image/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`;

describe("image values (spec 030, US4)", () => {
  it("accepts keys of the store, http URLs and empty values", () => {
    const options = { tenantId, label: "Imagem" };
    expect(normalizeImageReference(undefined, options)).toBeUndefined();
    expect(normalizeImageReference("  ", options)).toBeNull();
    expect(normalizeImageReference(key, options)).toBe(key);
    expect(normalizeImageReference(legacyKey, options)).toBe(legacyKey);
    expect(normalizeImageReference("https://cdn.example/a.png", options)).toBe("https://cdn.example/a.png");
  });

  it("refuses new base64, keys of another store and anything else", () => {
    const options = { tenantId, label: "Imagem", current: ["data:image/png;base64,AAAA"] };
    expect(normalizeImageReference("data:image/png;base64,AAAA", options)).toBe("data:image/png;base64,AAAA");
    expect(() => normalizeImageReference("data:image/png;base64,BBBB", options)).toThrow("Envie a imagem pelo upload");
    expect(() => normalizeImageReference(key.replace(tenantId, "99999999-9999-4999-8999-999999999999"), options)).toThrow(
      "imagem de outra loja"
    );
    expect(() => normalizeImageReference("javascript:alert(1)", options)).toThrow("deve ser uma URL");
  });

  it("resolves keys to signed URLs and keeps other values", async () => {
    const storage = { createReadUrl: vi.fn(async () => "https://signed.example/x") };
    expect(await resolveImageUrl(storage as never, key)).toBe("https://signed.example/x");
    expect(storage.createReadUrl).toHaveBeenCalledWith(key, 3600);
    expect(await resolveImageUrl(storage as never, "https://cdn.example/a.png")).toBe("https://cdn.example/a.png");
    expect(await resolveImageUrl(storage as never, null)).toBeNull();
    expect(await resolveImageUrl(undefined, key)).toBeNull();
  });

  it("decodes legacy base64 checking format and size", () => {
    const value = `data:image/jpeg;base64,${Buffer.from("jpeg-bytes").toString("base64")}`;
    expect(decodeLegacyImage(value, 1024)).toMatchObject({ contentType: "image/jpeg", extension: "jpg" });
    expect(decodeLegacyImage(value, 1024).body.toString()).toBe("jpeg-bytes");
    expect(() => decodeLegacyImage(value, 4)).toThrow("Imagem acima do limite");
    expect(() => decodeLegacyImage("data:image/gif;base64,R0lGOD", 1024)).toThrow("Formato de imagem nao suportado");
    expect(() => decodeLegacyImage("data:image/png;base64,***", 1024)).toThrow("Base64 invalido");
  });
});
