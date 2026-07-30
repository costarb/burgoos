import {
  Body,
  Controller,
  INestApplication,
  Post,
  UseInterceptors,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdempotencyInterceptor } from "../src/common/idempotency/idempotency.interceptor";
import { IdempotencyService } from "../src/common/idempotency/idempotency.service";
import { CreateCounterOrderDto } from "../src/ordering/counter-sales/dto/create-counter-order.dto";

const createOrder = vi.fn();

@Controller("admin/pos")
class TestCounterController {
  @Post("orders")
  @UseInterceptors(IdempotencyInterceptor)
  create(
    @Body(new ValidationPipe({ transform: true, expectedType: CreateCounterOrderDto }))
    dto: CreateCounterOrderDto,
  ) {
    return createOrder(dto);
  }
}

describe("counter order contract and retry integration", () => {
  let app: INestApplication;
  const completed = new Map<string, { statusCode: number; body: unknown }>();

  beforeEach(async () => {
    createOrder.mockReset();
    createOrder.mockResolvedValue({
      id: "order-1",
      publicCode: "123",
      source: "COUNTER",
      status: "PENDING",
      paymentStatus: "UNPAID",
      fulfillmentMethod: "PICKUP",
      total: "24.50",
      version: 0,
      items: [],
    });
    completed.clear();

    const idempotency = {
      claim: vi.fn(async ({ tenantId, scope, key }: Record<string, string>) => {
        const composite = `${tenantId}:${scope}:${key}`;
        const replay = completed.get(composite);
        return replay
          ? { kind: "replay" as const, ...replay }
          : { kind: "claimed" as const, recordId: composite };
      }),
      complete: vi.fn(async (recordId: string, statusCode: number, body: unknown) => {
        completed.set(recordId, { statusCode, body });
      }),
      fail: vi.fn(async () => undefined),
    };
    const module = await Test.createTestingModule({
      controllers: [TestCounterController],
      providers: [
        IdempotencyInterceptor,
        { provide: IdempotencyService, useValue: idempotency },
      ],
    }).compile();

    app = module.createNestApplication();
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = { id: "user-1", tenantId: "tenant-1" };
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates once and replays the same contract for an idempotent retry", async () => {
    const body = {
      fulfillmentMethod: "PICKUP",
      items: [{ productId: "d572f792-e46b-4d44-8ca7-29c1797b4d7a", quantity: 1 }],
    };
    const first = await request(app.getHttpServer())
      .post("/admin/pos/orders")
      .set("Idempotency-Key", "counter-retry-0001")
      .send(body)
      .expect(201);
    const retry = await request(app.getHttpServer())
      .post("/admin/pos/orders")
      .set("Idempotency-Key", "counter-retry-0001")
      .send(body)
      .expect(201);

    expect(retry.body).toEqual(first.body);
    expect(retry.headers["idempotency-replayed"]).toBe("true");
    expect(createOrder).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid counter order before calling the domain service", async () => {
    await request(app.getHttpServer())
      .post("/admin/pos/orders")
      .set("Idempotency-Key", "counter-invalid-01")
      .send({ fulfillmentMethod: "PICKUP", items: [] })
      .expect(400);

    expect(createOrder).not.toHaveBeenCalled();
  });
});
