import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PointChargePanel } from "./point-charge-panel";

describe("PointChargePanel", () => {
  it("renders terminal selection, synchronization and safe disabled charge action", () => {
    const html = renderToStaticMarkup(
      <PointChargePanel
        amount="25.00"
        targetId="5a019261-ed89-4085-a7b6-ae7868417f8f"
        targetType="ORDER"
      />,
    );
    expect(html).toContain("Cobrar no Mercado Pago Point");
    expect(html).toContain("Carregando maquininhas...");
    expect(html).toContain("Enviar R$ 25.00 para a Point");
    expect(html).toContain("Sincronizar");
    expect(html).toContain("disabled");
  });
});
