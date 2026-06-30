"use client";

import React, { useState } from "react";
import type { FinancialCategory, Payable, PayableInput, Supplier } from "@burgoos/types";
import { ModalShell } from "../../../../components/admin/modal-shell";
import { PayableForm } from "./payable-form";

interface PayableEditorDialogProps {
  mode: "create" | "edit";
  categories: FinancialCategory[];
  suppliers: Pick<Supplier, "id" | "name" | "active">[];
  payable?: Payable | null;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (payload: PayableInput) => Promise<void>;
}

export function PayableEditorDialog({
  mode,
  categories,
  suppliers,
  payable,
  busy = false,
  onClose,
  onSubmit,
}: PayableEditorDialogProps) {
  const [dirty, setDirty] = useState(false);

  function close() {
    if (dirty && !window.confirm("Descartar alteracoes nao salvas?")) {
      return;
    }

    onClose();
  }

  async function submit(payload: PayableInput) {
    await onSubmit(payload);
    setDirty(false);
  }

  return (
    <ModalShell
      busy={busy}
      description={
        mode === "create"
          ? "Inclua uma conta sem perder a consulta atual."
          : "Edite os dados permitidos mantendo o contexto da lista."
      }
      onClose={close}
      title={mode === "create" ? "Nova conta a pagar" : "Editar conta a pagar"}
    >
      <div onChange={() => setDirty(true)} onInput={() => setDirty(true)}>
        <PayableForm
          busy={busy}
          categories={categories}
          onCancel={close}
          onSubmit={submit}
          payable={payable}
          submitLabel={mode === "create" ? "Incluir conta" : "Salvar alteracoes"}
          suppliers={suppliers}
        />
      </div>
    </ModalShell>
  );
}
