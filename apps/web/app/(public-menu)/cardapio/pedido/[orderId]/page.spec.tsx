import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DomainOrderConfirmationPage from "./page";

describe("domain order confirmation", () => {
  it("keeps return navigation under cardapio", () => {
    const html = renderToStaticMarkup(
      <DomainOrderConfirmationPage
        params={{ orderId: "order-1" }}
        searchParams={{ total: "42.00", whatsappUrl: "https://wa.me/5511999999999" }}
      />
    );
    expect(html).toContain("Pedido order-1");
    expect(html).toContain('href="/cardapio"');
    expect(html).toContain("https://wa.me/5511999999999");
  });
});
