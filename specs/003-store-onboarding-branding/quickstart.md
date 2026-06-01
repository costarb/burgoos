# Quickstart: Cadastro de Lojas e Personalizacao Visual

## Goal

Validate the first multi-store setup and branding flow locally:

1. Platform administrator creates a new store.
2. Platform administrator creates the initial responsible owner for that store.
3. Owner logs in and sees only the new store.
4. Owner saves branding and layout as draft.
5. Owner previews and publishes the branding.
6. Public store page shows logo/colors/layout.
7. Public ordering still works for the new store.
8. Deactivating the store blocks new public usage while preserving history.

## Expected Commands

```powershell
npm install
npm run db:up
$env:DATABASE_URL='postgresql://burgoos:burgoos@127.0.0.1:5432/burgoos?schema=public&sslmode=disable'
npm run db:migrate
npm run db:seed
npm run dev
```

Implementation validation commands:

```powershell
npm.cmd run typecheck --workspaces --if-present
npm.cmd run lint --workspaces --if-present
npm.cmd run test --workspaces --if-present
```

## Manual Validation Script

1. Log in as a platform administrator.
2. Open the store setup area.
3. Create a new store:
   - name: Loja Centro
   - slug: loja-centro
   - phone: 5511999999999
   - active: true
   - accepting orders: false
4. Create the responsible owner:
   - name: Dona Maria
   - email: maria@example.com
   - temporary password: trocar123
5. Confirm the store appears in the platform store list.
6. Confirm launch readiness indicates the required setup state.
7. Log in as the new owner.
8. Confirm the owner sees only Loja Centro data.
9. Open store branding settings.
10. Save a draft with:
    - logo URL
    - primary color
    - accent color
    - neutral theme
    - layout preset
11. Preview the draft and confirm there are no contrast warnings.
12. Publish the draft.
13. Open the public store page for `/loja-centro`.
14. Confirm the public page shows the published visual identity.
15. Create a category, product and public order for the new store.
16. Confirm the order appears only in Loja Centro admin queue.
17. Deactivate Loja Centro from platform store setup.
18. Confirm new public access/order creation is blocked.
19. Confirm historical admin orders and reports remain visible to authorized users.

## Launch Readiness Checklist

- Store can be created without seed/script edits.
- Store slug is unique and blocks reserved words.
- Initial owner can log in.
- Owner is scoped to the new store only.
- Branding draft can be saved.
- Invalid contrast is blocked before publication.
- Published branding appears on public pages.
- Layout preset changes public menu composition without breaking mobile usability.
- Previous branding can be restored.
- Inactive store blocks new public ordering.
- Historical data remains available after deactivation.
