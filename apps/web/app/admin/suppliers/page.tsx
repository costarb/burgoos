import type { OperationState } from "@burgoos/types";
import { revalidatePath } from "next/cache";
import { OperationForm } from "../../../components/admin/operation-form";
import { SubmitButton } from "../../../components/admin/submit-button";
import { createSupplier, getAdminToken, getSuppliers, updateSupplier } from "../../../lib/api";

export const dynamic = "force-dynamic";

function optionalText(formData: FormData, key: string): string | undefined {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}

export default async function SuppliersPage() {
  const { suppliers } = await getSuppliers();

  async function create(_previousState: OperationState, formData: FormData): Promise<OperationState> {
    "use server";

    try {
      await createSupplier(await getAdminToken(), {
        name: String(formData.get("name") ?? ""),
        category: String(formData.get("category") ?? ""),
        contactName: optionalText(formData, "contactName"),
        phone: optionalText(formData, "phone"),
        email: optionalText(formData, "email"),
        notes: optionalText(formData, "notes"),
        active: formData.get("active") === "on",
      });
      revalidatePath("/admin/suppliers");
      return { status: "success", message: "Fornecedor criado com sucesso." };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel criar o fornecedor.",
      };
    }
  }

  async function update(_previousState: OperationState, formData: FormData): Promise<OperationState> {
    "use server";

    try {
      await updateSupplier(await getAdminToken(), String(formData.get("id") ?? ""), {
        name: String(formData.get("name") ?? ""),
        category: String(formData.get("category") ?? ""),
        contactName: optionalText(formData, "contactName"),
        phone: optionalText(formData, "phone"),
        email: optionalText(formData, "email"),
        notes: optionalText(formData, "notes"),
        active: formData.get("active") === "on",
      });
      revalidatePath("/admin/suppliers");
      return { status: "success", message: "Fornecedor salvo com sucesso." };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel salvar o fornecedor.",
      };
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase text-tomato">Dominios</p>
        <h1 className="mt-1 text-3xl font-semibold">Fornecedores</h1>
        <OperationForm
          action={create}
          className="mt-8 grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3"
          feedbackClassName="mt-4"
        >
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            maxLength={120}
            name="name"
            placeholder="Nome"
            required
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            maxLength={80}
            name="category"
            placeholder="Categoria"
            required
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            maxLength={120}
            name="contactName"
            placeholder="Contato"
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            maxLength={40}
            name="phone"
            placeholder="Telefone"
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            maxLength={160}
            name="email"
            placeholder="E-mail"
            type="email"
          />
          <label className="flex items-center gap-2 text-sm">
            <input defaultChecked name="active" type="checkbox" />
            Ativo
          </label>
          <textarea
            className="min-h-20 rounded-md border border-slate-200 px-3 py-2 text-sm md:col-span-3"
            maxLength={500}
            name="notes"
            placeholder="Observacoes"
          />
          <SubmitButton className="md:col-span-3" pendingLabel="Criando fornecedor...">
            Criar fornecedor
          </SubmitButton>
        </OperationForm>
        <div className="mt-6 space-y-3">
          {suppliers.map((supplier) => (
            <OperationForm
              action={update}
              className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-3"
              feedbackClassName="mt-2"
              key={supplier.id}
            >
              <input name="id" type="hidden" value={supplier.id} />
              <input
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                defaultValue={supplier.name}
                name="name"
                required
              />
              <input
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                defaultValue={supplier.category}
                name="category"
                required
              />
              <input
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                defaultValue={supplier.contactName ?? ""}
                name="contactName"
              />
              <input
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                defaultValue={supplier.phone ?? ""}
                name="phone"
              />
              <input
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                defaultValue={supplier.email ?? ""}
                name="email"
                type="email"
              />
              <label className="flex items-center gap-2 text-sm">
                <input defaultChecked={supplier.active} name="active" type="checkbox" />
                Ativo
              </label>
              <textarea
                className="min-h-20 rounded-md border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                defaultValue={supplier.notes ?? ""}
                name="notes"
              />
              <SubmitButton className="bg-slate-900 px-3" pendingLabel="Salvando...">
                Salvar
              </SubmitButton>
            </OperationForm>
          ))}
          {suppliers.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Nenhum fornecedor cadastrado.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
