import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaymentExceptionsClient } from "./payment-exceptions-client";

describe("PaymentExceptionsClient", () => {
  it("renders exception filters and an open anomaly", () => {
    const html = renderToStaticMarkup(
      <PaymentExceptionsClient
        initialExceptions={[{
          id: "exception-1",
          chargeId: "charge-1",
          paymentId: "payment-1",
          type: "POSSIBLE_DUPLICATE",
          status: "OPEN",
          description: "Duas aprovações para o mesmo saldo.",
          resolution: null,
          openedAt: "2026-07-30T12:00:00.000Z",
          resolvedAt: null,
          charge: {
            id: "charge-1",
            status: "APPROVED",
            amount: "41.00",
          },
        }]}
      />,
    );
    expect(html).toContain("Exceções de pagamento");
    expect(html).toContain("Possível duplicidade");
    expect(html).toContain("R$ 41.00");
    expect(html).toContain("Resolvidas");
    expect(html).toContain("Descartadas");
  });

  it("renders detail timeline and manager resolution actions", () => {
    const detail = {
      id: "exception-1",
      chargeId: "charge-1",
      paymentId: null,
      type: "UNKNOWN_RESULT" as const,
      status: "OPEN" as const,
      description: "Resultado não confirmado.",
      resolution: null,
      openedAt: "2026-07-30T12:00:00.000Z",
      resolvedAt: null,
      timeline: [{
        id: "event-1",
        type: "PAYMENT_EXCEPTION_OPENED",
        source: "SYSTEM" as const,
        reason: "Timeout da adquirente",
        occurredAt: "2026-07-30T12:00:00.000Z",
      }],
    };
    const html = renderToStaticMarkup(
      <PaymentExceptionsClient initialExceptions={[detail]} initialSelected={detail} />,
    );
    expect(html).toContain("Histórico");
    expect(html).toContain("Timeout da adquirente");
    expect(html).toContain("Marcar resolvida");
    expect(html).toContain("Descartar");
  });
});
