import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicOrderQueue } from "@burgoos/types";
import { PublicOrderQueueClient } from "./public-order-queue";

describe("PublicOrderQueueClient", () => {
  it("renders TV/mobile queue columns, oldest active first and newest completed first", () => {
    const html = renderToStaticMarkup(
      <PublicOrderQueueClient
        initialQueue={queue}
        source={{ slug: "loja-a" }}
      />,
    );

    expect(html).toContain("Acompanhe seu pedido");
    expect(html).toContain("Recebidos");
    expect(html).toContain("Em preparo");
    expect(html).toContain("Prontos");
    expect(html.indexOf("#001")).toBeLessThan(html.indexOf("#002"));
    expect(html.indexOf("#010")).toBeLessThan(html.indexOf("#009"));
    expect(html).not.toMatch(/telefone|pagamento|R\\$/i);
    expect(html).toContain("Fila atualizada");
  });
});

const queue: PublicOrderQueue = {
  storeName: "Loja A",
  generatedAt: "2026-07-30T12:00:00.000Z",
  staleAfterSeconds: 15,
  active: [
    { publicCode: "001", displayName: null, status: "PENDING", enteredAt: "2026-07-30T10:00:00Z" },
    { publicCode: "002", displayName: null, status: "PENDING", enteredAt: "2026-07-30T10:05:00Z" },
    { publicCode: "003", displayName: null, status: "PREPARING", enteredAt: "2026-07-30T10:06:00Z" },
  ],
  completed: [
    { publicCode: "010", displayName: null, status: "DELIVERED", enteredAt: "2026-07-30T10:10:00Z" },
    { publicCode: "009", displayName: null, status: "DELIVERED", enteredAt: "2026-07-30T10:09:00Z" },
  ],
};
