# POS, KDS and payments migration

This migration is additive and must run after all migrations currently on `main`.

Implementation rules:

1. Add enum values before columns that use them.
2. Create nullable/defaulted compatibility columns before backfilling historical orders.
3. Create tables before foreign keys and indexes.
4. Backfill historical orders with `source = LEGACY`.
5. Do not rename or delete existing order/payment fields in this migration.
6. Rollback is performed by restoring the pre-migration backup; production down migrations are not generated.
