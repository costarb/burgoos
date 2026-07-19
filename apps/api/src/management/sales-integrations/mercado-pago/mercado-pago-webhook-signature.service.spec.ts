/* eslint-disable @typescript-eslint/no-explicit-any */
import { UnauthorizedException } from "@nestjs/common";
import { createHmac } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { MercadoPagoWebhookSignatureService } from "./mercado-pago-webhook-signature.service";

describe("MercadoPagoWebhookSignatureService", () => {
  const secret = "fixture-secret";
  const ts = 1_784_419_200;
  const now = new Date(ts * 1000);
  const service = new MercadoPagoWebhookSignatureService({
    value: vi.fn().mockResolvedValue(secret),
  } as any);
  const signature = (id = "payment-1", requestId = "request-1") =>
    `ts=${ts},v1=${createHmac("sha256", secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest("hex")}`;
  it("validates the official manifest and derives a stable event key", async () => {
    const first = await service.verify({
      xSignature: signature(),
      xRequestId: "request-1",
      dataId: "payment-1",
      now,
    });
    const second = await service.verify({
      xSignature: signature(),
      xRequestId: "request-1",
      dataId: "payment-1",
      now,
    });
    expect(first.eventKey).toBe(second.eventKey);
    expect(first.timestamp).toEqual(now);
  });
  it("rejects tampering, stale timestamps and missing minimum fields", async () => {
    await expect(
      service.verify({ xSignature: signature(), xRequestId: "request-1", dataId: "other", now })
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.verify({
        xSignature: signature(),
        xRequestId: "request-1",
        dataId: "payment-1",
        now: new Date(now.getTime() + 600_000),
      })
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.verify({ xSignature: "", xRequestId: "", dataId: "", now })
    ).rejects.toThrow(UnauthorizedException);
  });
});
