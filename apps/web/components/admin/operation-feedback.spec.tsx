import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConfirmationDialog } from "./confirmation-dialog";
import { OperationFeedback } from "./operation-feedback";

describe("admin operation feedback", () => {
  it("renders pending state and progress", () => {
    const html = renderToStaticMarkup(
      <OperationFeedback
        state={{
          status: "pending",
          message: "Importando pedidos.",
          progress: { current: 5, total: 10 },
        }}
      />,
    );

    expect(html).toContain("Processando");
    expect(html).toContain("Importando pedidos.");
    expect(html).toContain("50%");
  });

  it("renders result counts after success", () => {
    const html = renderToStaticMarkup(
      <OperationFeedback
        state={{
          status: "success",
          message: "Importacao concluida.",
          result: { processed: 10, completed: 8, skipped: 2, failed: 0 },
        }}
      />,
    );

    expect(html).toContain("Concluido");
    expect(html).toContain("Processados");
    expect(html).toContain("Ignorados");
  });

  it("renders a clear financial confirmation", () => {
    const html = renderToStaticMarkup(
      <ConfirmationDialog
        confirmLabel="Estornar pagamento"
        description="O saldo sera recalculado."
        onCancel={() => undefined}
        onConfirm={() => undefined}
        open
        title="Confirmar estorno"
      />,
    );

    expect(html).toContain("Confirmar estorno");
    expect(html).toContain("O saldo sera recalculado.");
    expect(html).toContain("Estornar pagamento");
  });
});
