# Quickstart: Repaginacao do Fluxo de Contas a Pagar

## Prerequisites

- Docker Desktop running.
- PostgreSQL service up through `docker compose`.
- Local dependencies installed.
- Development database seeded with at least one financial category and supplier.
- Admin user with `finance.view` and `finance.manage` permissions.

## Run Locally

```powershell
docker compose up -d postgres
npm.cmd run dev --workspace @burgoos/api
npm.cmd run dev --workspace @burgoos/web
```

Open:

- Web: `http://localhost:3000`
- API docs: `http://localhost:3001/docs`

## Manual Validation Flow

1. Login as an admin user with financial permissions.
2. Navigate to `Admin > Financeiro > Contas a pagar`.
3. Confirm the cards `Previsto`, `Pago`, `Em aberto` and `Vencido` are visible before interacting with the list.
4. Open `Nova conta`.
5. Confirm the payable form opens in a modal and the background page keeps the list/cards context.
6. Fill category, supplier, description, competence date, due date and expected amount.
7. Submit the modal.
8. Confirm the modal closes, the new payable appears in the list and all relevant cards update.
9. Open details for the created payable.
10. Confirm details appear in a modal.
11. Trigger edit from the list or detail.
12. Confirm edit opens in a modal consistent with creation/detail.
13. Change a permitted field and save.
14. Confirm the list, detail and cards reflect the update.
15. Apply filters using the visible consultation area.
16. Request export in CSV.
17. Confirm the request returns immediately and the page remains usable.
18. Repeat export requests for PDF and XLSX.
19. Open the notification center.
20. Confirm pending/completed/failed export notifications are visible with status and timestamps.
21. For a completed export, use the notification action to download the file.
22. Confirm the downloaded file reflects the filters applied when export was requested.
23. Mark a notification as read.
24. Confirm unread count decreases.

## Error Validation Flow

1. Submit the new payable modal with required fields missing.
2. Confirm validation appears inside the modal and the modal remains open.
3. Start an export with no matching payable records.
4. Confirm the user receives clear feedback and no confusing empty file is presented.
5. Simulate an export generation failure.
6. Confirm a failure notification appears with a safe, understandable message.
7. Login as a user without `finance.manage`.
8. Confirm create/edit/export actions are unavailable or blocked while view-only access remains safe.

## Automated Checks

```powershell
npm.cmd run test --workspace @burgoos/api
npm.cmd run test --workspace @burgoos/web
npm.cmd run typecheck --workspaces --if-present
npm.cmd run lint --workspaces --if-present
```

## Expected Evidence

- Modal creation and edition do not navigate away from the payables page.
- Cards remain visible and match current query summary.
- Export request responds as accepted instead of waiting for file generation.
- Notification center shows unread/read states.
- Completed export notification links to a downloadable file.
- Failed export notification does not expose internal technical details.
