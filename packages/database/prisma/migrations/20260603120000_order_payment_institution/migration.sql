ALTER TYPE "PaymentMethod" ADD VALUE 'DEBIT_CARD';
ALTER TYPE "PaymentMethod" ADD VALUE 'CREDIT_CARD';
ALTER TYPE "PaymentMethod" ADD VALUE 'VOUCHER';
ALTER TYPE "PaymentMethod" ADD VALUE 'PIX';

CREATE TYPE "PaymentInstitution" AS ENUM ('PAGBANK', 'MERCADO_PAGO', 'DINHEIRO');

ALTER TABLE "orders" ADD COLUMN "payment_institution" "PaymentInstitution";
