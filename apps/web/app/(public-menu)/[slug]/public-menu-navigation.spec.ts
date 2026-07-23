import { describe, expect, it } from "vitest";
import { orderConfirmationPath } from "./public-menu-client";

const order = { id: "order-1", total: "42.00", whatsappUrl: "https://wa.me/55?text=pedido" } as never;

describe("public menu navigation", () => {
  it("supports legacy and domain bases", () => {
    expect(orderConfirmationPath("/piloto", order)).toContain("/piloto/pedido/order-1");
    expect(orderConfirmationPath("/cardapio", order)).toContain("/cardapio/pedido/order-1");
  });
});
