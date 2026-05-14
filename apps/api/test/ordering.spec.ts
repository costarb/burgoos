import { FulfillmentMethod, OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateOrderTotals } from "../src/ordering/order-calculator";
import { canTransitionOrderStatus } from "../src/ordering/order-status";
import { ReportsService } from "../src/management/reports.service";
import { buildWhatsAppOrderLink } from "../src/ordering/whatsapp-link";

describe("ordering rules", () => {
  it("calculates order totals from current product prices", () => {
    const order = calculateOrderTotals([
      {
        productId: "product-1",
        productName: "Burgo Classico",
        quantity: 2,
        unitPrice: new Prisma.Decimal("29.90")
      },
      {
        productId: "product-2",
        productName: "Batata",
        quantity: 1,
        unitPrice: new Prisma.Decimal("12.00")
      }
    ]);

    expect(order.total.toFixed(2)).toBe("71.80");
    expect(order.items).toMatchObject([
      {
        productNameSnapshot: "Burgo Classico",
        quantity: 2
      },
      {
        productNameSnapshot: "Batata",
        quantity: 1
      }
    ]);
    expect(order.items[0]?.total.toFixed(2)).toBe("59.80");
  });

  it("generates a WhatsApp deep link with the order summary", () => {
    const order = calculateOrderTotals([
      {
        productId: "product-1",
        productName: "Burgo Classico",
        quantity: 1,
        unitPrice: new Prisma.Decimal("29.90")
      }
    ]);

    const link = buildWhatsAppOrderLink({
      tenantPhone: "5500000000000",
      customerName: "Cliente Teste",
      customerPhone: "11999999999",
      fulfillmentMethod: FulfillmentMethod.DELIVERY,
      paymentMethod: PaymentMethod.PIX_MANUAL,
      order,
      notes: "Sem cebola"
    });

    expect(link).toContain("https://wa.me/5500000000000?text=");
    expect(decodeURIComponent(link)).toContain("1x Burgo Classico - R$ 29.90");
    expect(decodeURIComponent(link)).toContain("Total: R$ 29.90");
    expect(decodeURIComponent(link)).toContain("Observacoes: Sem cebola");
  });

  it("allows only operational order status transitions", () => {
    expect(canTransitionOrderStatus(OrderStatus.PENDING, OrderStatus.PREPARING)).toBe(true);
    expect(canTransitionOrderStatus(OrderStatus.PREPARING, OrderStatus.DELIVERED)).toBe(true);
    expect(canTransitionOrderStatus(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toBe(false);
    expect(canTransitionOrderStatus(OrderStatus.PENDING, OrderStatus.DELIVERED)).toBe(false);
  });

  it("calculates daily summary from delivered orders only", async () => {
    const service = new ReportsService({
      order: {
        findMany: () => [
          {
            total: new Prisma.Decimal("29.90")
          },
          {
            total: new Prisma.Decimal("12.00")
          }
        ]
      }
    } as never);

    const summary = await service.getDailySummary(
      "11111111-1111-4111-8111-111111111111",
      new Date("2026-05-13T12:00:00.000Z")
    );

    expect(summary).toEqual({
      date: "2026-05-13",
      orderCount: 2,
      grossRevenue: "41.90"
    });
  });
});
