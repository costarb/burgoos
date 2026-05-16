"use client";

import type { OrderPlatform, ProductPricing } from "@burgoos/types";
import { useRouter } from "next/navigation";

interface PricingClientProps {
  orderPlatforms: OrderPlatform[];
  selectedPlatformId: string;
  products: ProductPricing[];
}

export function PricingClient({
  orderPlatforms,
  selectedPlatformId,
  products,
}: PricingClientProps) {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">Precificacao</p>
            <h1 className="mt-1 text-3xl font-semibold">Analise por CMV e canal</h1>
            <p className="mt-2 text-slate-600">
              Preco ideal combina ficha tecnica, parametros financeiros e taxas da plataforma.
            </p>
          </div>
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            onChange={(event) => router.push(`/admin/pricing?platformId=${event.target.value}`)}
            value={selectedPlatformId}
          >
            {orderPlatforms.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-8 overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-[780px] border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Produto</th>
                <th className="px-4 py-3 font-semibold">Preco atual</th>
                <th className="px-4 py-3 font-semibold">CMV</th>
                <th className="px-4 py-3 font-semibold">% CMV</th>
                <th className="px-4 py-3 font-semibold">Preco ideal</th>
                <th className="px-4 py-3 font-semibold">Lucro est.</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {products.map((product) => (
                <tr key={product.productId}>
                  <td className="px-4 py-3 font-medium">{product.productName}</td>
                  <td className="px-4 py-3">R$ {product.currentPrice}</td>
                  <td className="px-4 py-3">R$ {product.totalCmv}</td>
                  <td className="px-4 py-3">{(product.cmvRate * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 font-semibold">R$ {product.idealPrice}</td>
                  <td className="px-4 py-3">R$ {product.estimatedProfit}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        product.status === "OK"
                          ? "rounded-md bg-green-50 px-3 py-1 text-xs font-semibold text-green-800"
                          : product.status === "REVIEW_PRICE"
                            ? "rounded-md bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                            : "rounded-md bg-red-50 px-3 py-1 text-xs font-semibold text-red-800"
                      }
                    >
                      {product.status === "OK"
                        ? "OK"
                        : product.status === "REVIEW_PRICE"
                          ? "Rever preco"
                          : "Sem ficha"}
                    </span>
                  </td>
                </tr>
              ))}
              {products.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={7}>
                    Nenhum produto cadastrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
