import type { IfoodFinancialOrderDetail } from "@rrfive/types";
import React from "react";

export function IfoodFinancialDetails({ detail }: { detail: IfoodFinancialOrderDetail }) {
  return (
    <details className="mt-2 min-w-64 text-xs">
      <summary className="cursor-pointer font-semibold text-red-700">Detalhes financeiros iFood</summary>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded bg-red-50 p-2">
        <dt>Cesta bruta</dt><dd>R$ {detail.bagAmount}</dd>
        <dt>Entrega</dt><dd>R$ {detail.deliveryFeeAmount}</dd>
        <dt>Taxa de servico</dt><dd>R$ {detail.serviceFeeAmount}</dd>
        <dt>Beneficios</dt><dd>R$ {detail.benefitsAmount}</dd>
        <dt>Pago pelo cliente</dt><dd>R$ {detail.customerPaidAmount}</dd>
        <dt>Saldo da venda</dt><dd>R$ {detail.saleBalanceAmount}</dd>
        <dt>Recebivel iFood</dt><dd>R$ {detail.ifoodReceivableAmount}</dd>
        <dt>Recebido pela loja</dt><dd>R$ {detail.storeReceivedAmount}</dd>
      </dl>
      <ul className="mt-2 space-y-1">
        {detail.payments.map((payment, index) => (
          <li key={`${payment.providerMethod}-${index}`} className="rounded border p-2">
            <strong>{payment.mappedMethod ?? `Revisar: ${payment.providerMethod}`}</strong>
            {` · R$ ${payment.amount} · recebedor ${payment.liability}`}
            {payment.brand ? ` · ${payment.brand}` : ""}
            {payment.installments.length ? (
              <ul className="mt-1 pl-3">
                {payment.installments.map((installment) => (
                  <li key={installment.reference}>
                    Parcela {installment.reference}: R$ {installment.amount}
                    {installment.expectedPaymentDate
                      ? ` · ${new Date(installment.expectedPaymentDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`
                      : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
