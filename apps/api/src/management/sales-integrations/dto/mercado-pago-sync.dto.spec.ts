import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { MercadoPagoSyncDto } from "./sales-integration.dto";

describe("MercadoPagoSyncDto", () => {
  it("accepts a sync body without integrationId because it is supplied by the route", async () => {
    const dto = plainToInstance(MercadoPagoSyncDto, {
      startDate: "2026-07-01",
      endDate: "2026-07-18",
      strategy: "PRICE_WEIGHTED",
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toEqual([]);
    expect(dto).not.toHaveProperty("integrationId");
  });
});
