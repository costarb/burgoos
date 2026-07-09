"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type {
  HistoricalOrderImportLayout,
  HistoricalOrderImportResult,
  HistoricalOrderImportStrategy,
  PaymentInstitution,
  PaymentInstitutionConfiguration,
  PaymentMethod,
} from "@burgoos/types";
import { useRouter } from "next/navigation";
import { OperationFeedback } from "../../../../components/admin/operation-feedback";
import type { AdminProduct } from "../../../../lib/api";
import { importHistoricalOrders } from "../../../../lib/api";

interface OrderImportClientProps {
  token: string;
  products: AdminProduct[];
  institutions: PaymentInstitutionConfiguration[];
}

export function OrderImportClient({ token, products, institutions }: OrderImportClientProps) {
  const router = useRouter();
  const [layout, setLayout] = useState<HistoricalOrderImportLayout>("SIMPLE");
  const [strategy, setStrategy] = useState<HistoricalOrderImportStrategy>("PRICE_WEIGHTED");
  const [paymentInstitutionId, setPaymentInstitutionId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HistoricalOrderImportResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setResult(null);
    setStatusMessage(null);

    const formData = new FormData(event.currentTarget);
    const csvText = String(formData.get("csvText") ?? "");
    const fixedProductId = String(formData.get("fixedProductId") ?? "");
    const orderPlatformName = String(formData.get("orderPlatformName") ?? "FOOD_TRUCK");
    const candidateRows =
      csvText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean).length - 1;

    setIsImporting(true);
    setStatusMessage(
      candidateRows > 0
        ? `Processando ${candidateRows} linhas do arquivo.`
        : "Validando arquivo informado."
    );

    try {
      const importResult = await importHistoricalOrders(token, {
        csvText,
        layout,
        strategy,
        fixedProductId: strategy === "FIXED_PRODUCT" ? fixedProductId : undefined,
        orderPlatformName,
        paymentInstitutionId: paymentInstitutionId || undefined,
        paymentMethod: paymentMethod || undefined,
      });

      setResult(importResult);
      setStatusMessage(
        `Importacao concluida: ${importResult.importedCount} pedidos importados e ${importResult.skippedCount} ignorados.`
      );
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao importar pedidos.");
      setStatusMessage(null);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">Pedidos</p>
            <h1 className="mt-1 text-3xl font-semibold">Importar vendas historicas</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Importe o CSV simples ou o extrato original da instituicao. Para PagBank e Mercado
              Pago, o sistema usa data, ID, valor bruto, taxa, liquido e meio de pagamento do
              arquivo.
            </p>
          </div>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin/orders"
          >
            Voltar para pedidos
          </a>
        </div>

        <form
          className="mt-8 grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={submit}
        >
          <fieldset className="grid gap-4 disabled:opacity-70" disabled={isImporting}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Layout
                <select
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal"
                  value={layout}
                  onChange={(event) =>
                    setLayout(event.currentTarget.value as HistoricalOrderImportLayout)
                  }
                >
                  <option value="SIMPLE">Simples</option>
                  <option value="MERCADO_PAGO">Mercado Pago</option>
                  <option value="PAGBANK">PagBank</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Origem
                <input
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal"
                  defaultValue="FOOD_TRUCK"
                  maxLength={80}
                  name="orderPlatformName"
                />
              </label>
              {layout === "SIMPLE" ? (
                <>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Instituicao padrao
                    <select
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal"
                      value={paymentInstitutionId}
                      onChange={(event) => setPaymentInstitutionId(event.currentTarget.value)}
                    >
                      <option value="">Usar arquivo ou vazio</option>
                      {institutions.map((institution) => (
                        <option key={institution.id} value={institution.id}>
                          {institution.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Meio padrao
                    <select
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal"
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(event.currentTarget.value as PaymentMethod | "")
                      }
                    >
                      <option value="">Usar arquivo ou PIX atual</option>
                      <option value="DEBIT_CARD">Debito</option>
                      <option value="CREDIT_CARD">Credito</option>
                      <option value="VOUCHER">Voucher</option>
                      <option value="PIX">Pix</option>
                      <option value="CASH">Dinheiro</option>
                    </select>
                  </label>
                </>
              ) : null}
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Atribuicao
                <select
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal"
                  name="strategy"
                  value={strategy}
                  onChange={(event) =>
                    setStrategy(event.currentTarget.value as HistoricalOrderImportStrategy)
                  }
                >
                  <option value="PRICE_WEIGHTED">Automatica por valor</option>
                  <option value="FIXED_PRODUCT">Produto fixo</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Produto fixo
                <select
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal disabled:bg-slate-100"
                  disabled={strategy !== "FIXED_PRODUCT"}
                  name="fixedProductId"
                  required={strategy === "FIXED_PRODUCT"}
                >
                  <option value="">Selecione</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - R$ {product.price}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <textarea
              className="min-h-[320px] rounded-md border border-slate-200 px-3 py-2 font-mono text-sm"
              name="csvText"
              placeholder={placeholderForLayout(layout)}
              required
            />
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={isImporting || products.length === 0}
              type="submit"
            >
              {isImporting ? "Importando..." : "Importar pedidos"}
            </button>
            {products.length === 0 ? (
              <p className="text-sm text-red-700">Cadastre produtos ativos antes de importar.</p>
            ) : null}
          </div>
        </form>

        <OperationFeedback
          className="mt-4"
          state={{
            status: error ? "error" : result ? "success" : isImporting ? "pending" : "idle",
            message: error ?? statusMessage ?? undefined,
            result: result
              ? {
                  processed: result.parsedRows,
                  completed: result.importedCount,
                  skipped: result.skippedCount,
                }
              : undefined,
          }}
        />

        {result ? (
          <section className="mt-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryItem label="Linhas validas" value={result.parsedRows} />
              <SummaryItem label="Importados" value={result.importedCount} />
              <SummaryItem label="Ignorados" value={result.skippedCount} />
            </div>
            <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Linha</th>
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 font-semibold">Valor</th>
                    <th className="px-4 py-3 font-semibold">Produto atribuido</th>
                    <th className="px-4 py-3 font-semibold">Pagamento</th>
                    <th className="px-4 py-3 font-semibold">Conciliação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {result.imported.slice(0, 30).map((item) => (
                    <tr key={item.orderId}>
                      <td className="px-4 py-3">{item.rowNumber}</td>
                      <td className="px-4 py-3">
                        {new Date(item.date).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">R$ {item.amount}</td>
                      <td className="px-4 py-3">{item.productName}</td>
                      <td className="px-4 py-3">
                        {item.paymentInstitutionName ??
                          paymentInstitutionLabel(item.paymentInstitution)}{" "}
                        / {paymentMethodLabel(item.paymentMethod)}
                      </td>
                      <td className="px-4 py-3">
                        {item.externalPaymentId ?? "-"}
                        <span className="block text-xs text-slate-500">
                          Taxa {item.feeAmount ? `R$ ${item.feeAmount}` : "-"} / Liquido{" "}
                          {item.netAmount ? `R$ ${item.netAmount}` : "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-md border border-slate-200 p-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </article>
  );
}

function placeholderForLayout(layout: HistoricalOrderImportLayout): string {
  if (layout === "MERCADO_PAGO") {
    return [
      "OPERATION_DATETIME;RELEASE_DATETIME;MOVEMENT_TYPE;PAYMENT_ID;LOCAL;CHARGE_METHOD;PAYMENT_METHOD_DETAIL;PAYMENT_METHOD;GROSS_VALUE;SALES_DISCOUNTS;NET",
      "30-05-2026 18:31:52;30-05-2026 18:31:48;Pagamento;161753244614;Dogao;Point;Cartao de credito;Visa;46,00;-0,34;45,66",
    ].join("\n");
  }

  if (layout === "PAGBANK") {
    return [
      "Codigo da Transacao;Data da Transacao;Bandeira;Forma de Pagamento;Valor Bruto;Valor Taxa;Valor Liquido;Status",
      "55668285-BEB6-4A1B-A002-BFE919A587E9;30/05/2026 17:10;Mastercard;Debito;15,00;0,09;14,91;Aprovada",
    ].join("\n");
  }

  return [
    "Data;Valor",
    "30/05/2026;20,00",
    "",
    "Data;Instituicao;Meio;Valor",
    "30/05/2026;PagBank;Debito;20,00",
  ].join("\n");
}

function paymentInstitutionLabel(value: PaymentInstitution | null): string {
  const labels: Record<PaymentInstitution, string> = {
    PAGBANK: "PagBank",
    MERCADO_PAGO: "Mercado Pago",
    DINHEIRO: "Dinheiro",
    CAIXA_LOCAL: "Caixa local",
  };

  return value ? labels[value] : "Nao informado";
}

function paymentMethodLabel(value: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    CASH: "Dinheiro",
    PIX_MANUAL: "PIX",
    CARD_ON_DELIVERY: "Cartao",
    DEBIT_CARD: "Debito",
    CREDIT_CARD: "Credito",
    VOUCHER: "Voucher",
    PIX: "Pix",
  };

  return labels[value];
}
