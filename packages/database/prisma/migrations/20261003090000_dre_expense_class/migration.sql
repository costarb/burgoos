-- CreateEnum
CREATE TYPE "DreExpenseClass" AS ENUM ('FIXED_COST', 'VARIABLE_EXPENSE', 'EXCLUDED');

-- AlterTable
ALTER TABLE "financial_categories" ADD COLUMN     "dre_class" "DreExpenseClass" NOT NULL DEFAULT 'VARIABLE_EXPENSE';

-- AlterTable
ALTER TABLE "payables" ADD COLUMN     "dre_class_override" "DreExpenseClass";

-- CreateIndex
CREATE INDEX "payables_tenant_id_competence_date_idx" ON "payables"("tenant_id", "competence_date");


-- Backfill: initial DRE classification of existing categories by name (spec 027, research R3).
-- Same keyword lists as suggestDreClass() in apps/api/src/management/financial/dre-expense-class.ts.
UPDATE "financial_categories"
SET "dre_class" = 'EXCLUDED'
WHERE translate(lower("name"), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') ~ '(insumo|mercadoria|materia prima|materia-prima|taxa|equipamento|investimento|emprestimo|financiamento|retirada|distribuicao)';

UPDATE "financial_categories"
SET "dre_class" = 'FIXED_COST'
WHERE "dre_class" = 'VARIABLE_EXPENSE'
  AND translate(lower("name"), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') ~ '(aluguel|energia|luz|agua|internet|telefone|salario|folha|contab|contador|seguro|condominio|iptu|sistema|software|assinatura)';
