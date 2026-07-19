/* eslint-disable @typescript-eslint/no-explicit-any */
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createHmac } from "crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MercadoPagoWebhookController } from "../src/management/sales-integrations/mercado-pago/mercado-pago-webhook.controller";
import { MercadoPagoWebhookSignatureService } from "../src/management/sales-integrations/mercado-pago/mercado-pago-webhook-signature.service";
import { MercadoPagoWebhookService } from "../src/management/sales-integrations/mercado-pago/mercado-pago-webhook.service";

describe("Mercado Pago public webhook", () => {
  let app: INestApplication;
  const secret = "webhook-test-secret";
  const accept = vi.fn().mockResolvedValue({ accepted: true, duplicate: false });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MercadoPagoWebhookController],
      providers: [
        {
          provide: MercadoPagoWebhookSignatureService,
          useValue: new MercadoPagoWebhookSignatureService({
            get: vi.fn().mockReturnValue(secret),
          } as any),
        },
        { provide: MercadoPagoWebhookService, useValue: { accept } },
        { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue(secret) } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });
  afterAll(() => app.close());
  function headers(dataId: string, requestId: string) {
    const ts = Math.floor(Date.now() / 1000);
    const v1 = createHmac("sha256", secret)
      .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
      .digest("hex");
    return { "x-request-id": requestId, "x-signature": `ts=${ts},v1=${v1}` };
  }
  it("rejects invalid signatures without dispatching financial processing", async () => {
    const before = accept.mock.calls.length;
    await request(app.getHttpServer())
      .post("/api/webhooks/mercadopago?data.id=1")
      .set("x-request-id", "bad")
      .set("x-signature", "ts=1,v1=deadbeef")
      .send({ type: "payment", user_id: 123, data: { id: 1 } })
      .expect(401);
    expect(accept.mock.calls.length).toBe(before);
  });
  it("accepts at least 99 of 100 valid isolated account notifications in under two seconds each", async () => {
    const started = performance.now();
    const responses = [];
    for (let batch = 0; batch < 10; batch += 1)
      responses.push(
        ...(await Promise.all(
          Array.from({ length: 10 }, (_, offset) => {
            const index = batch * 10 + offset;
            const id = String(10_000 + index);
            return request(app.getHttpServer())
              .post(`/api/webhooks/mercadopago?data.id=${id}`)
              .set(headers(id, `request-${index}`))
              .send({ type: "payment", user_id: index % 2 ? 123 : 456, data: { id } });
          })
        ))
      );
    expect(responses.filter((response) => response.status === 201).length).toBeGreaterThanOrEqual(
      99
    );
    expect((performance.now() - started) / 100).toBeLessThan(2_000);
    expect(accept).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ user_id: 123 }) })
    );
    expect(accept).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ user_id: 456 }) })
    );
  });
});
