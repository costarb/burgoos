import React from "react";
import type { OperationState } from "@burgoos/types";
import { revalidatePath } from "next/cache";
import { OperationForm } from "../../../components/admin/operation-form";
import { SubmitButton } from "../../../components/admin/submit-button";
import {
  getAdminToken,
  getFinancialConfiguration,
  updateFinancialConfiguration,
} from "../../../lib/api";

export const dynamic = "force-dynamic";

function numberFromForm(formData: FormData, key: string): number {
  return Number(formData.get(key) ?? 0);
}

export default async function SettingsPage() {
  const configuration = await getFinancialConfiguration();

  async function saveSettings(
    _previousState: OperationState,
    formData: FormData,
  ): Promise<OperationState> {
    "use server";

    try {
      const token = await getAdminToken();
      await updateFinancialConfiguration(token, {
        taxRate: numberFromForm(formData, "taxRate"),
        cardFeeRate: numberFromForm(formData, "cardFeeRate"),
        operationalLossRate: numberFromForm(formData, "operationalLossRate"),
        desiredMarginRate: numberFromForm(formData, "desiredMarginRate"),
        averagePackagingCost: numberFromForm(formData, "averagePackagingCost"),
        monthlyFixedCost: numberFromForm(formData, "monthlyFixedCost"),
        monthlyRevenueGoal: numberFromForm(formData, "monthlyRevenueGoal"),
        cmvWarningRate: numberFromForm(formData, "cmvWarningRate"),
        netMarginGoalRate: numberFromForm(formData, "netMarginGoalRate"),
      });
      revalidatePath("/admin/settings");

      return { status: "success", message: "Parametros financeiros salvos com sucesso." };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel salvar os parametros.",
      };
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase text-tomato">Configuracoes</p>
        <h1 className="mt-1 text-3xl font-semibold">Parametros financeiros</h1>

        <OperationForm
          action={saveSettings}
          className="mt-8 grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2"
          feedbackClassName="mt-4"
        >
          <NumberField
            label="Impostos"
            name="taxRate"
            step="0.0001"
            value={configuration.taxRate}
          />
          <NumberField
            label="Taxa de cartao"
            name="cardFeeRate"
            step="0.0001"
            value={configuration.cardFeeRate}
          />
          <NumberField
            label="Perda operacional"
            name="operationalLossRate"
            step="0.0001"
            value={configuration.operationalLossRate}
          />
          <NumberField
            label="Margem desejada"
            name="desiredMarginRate"
            step="0.0001"
            value={configuration.desiredMarginRate}
          />
          <NumberField
            label="Embalagem media"
            name="averagePackagingCost"
            step="0.01"
            value={configuration.averagePackagingCost}
          />
          <NumberField
            label="Custo fixo mensal"
            name="monthlyFixedCost"
            step="0.01"
            value={configuration.monthlyFixedCost}
          />
          <NumberField
            label="Meta de receita mensal"
            name="monthlyRevenueGoal"
            step="0.01"
            value={configuration.monthlyRevenueGoal}
          />
          <NumberField
            label="Alerta de CMV"
            name="cmvWarningRate"
            step="0.0001"
            value={configuration.cmvWarningRate}
          />
          <NumberField
            label="Meta margem liquida"
            name="netMarginGoalRate"
            step="0.0001"
            value={configuration.netMarginGoalRate}
          />
          <SubmitButton className="md:col-span-2" pendingLabel="Salvando parametros...">
            Salvar parametros
          </SubmitButton>
        </OperationForm>
      </section>
    </main>
  );
}

function NumberField({
  label,
  name,
  step,
  value,
}: {
  label: string;
  name: string;
  step: string;
  value: number | string;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={value}
        min={0}
        name={name}
        required
        step={step}
        type="number"
      />
    </label>
  );
}
