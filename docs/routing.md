# Roteamento AuraGrid (SPA-in-Next)

O AuraGrid usa o **Next.js App Router** só para registrar URLs e servir APIs. A UI é uma SPA client-side montada uma vez no layout `(workspace)`.

## Estrutura

```
app/
├── layout.tsx                 # HTML shell + tema
├── (workspace)/layout.tsx     # AppShell persistente (dynamic ssr:false)
├── (workspace)/page.tsx       # GET /  → null
├── (workspace)/welcome/       # GET /welcome
├── (workspace)/c/[clientId]/  # GET /c/:id/...
├── login/page.tsx             # Fora do workspace (AuthProvider separado)
└── not-found.tsx              # Redirect → /welcome
```

Providers e `src/App.tsx` vivem em [`app/AppShell.tsx`](../app/AppShell.tsx). Pages retornam `null` — **nunca** monte providers em `page.tsx`.

## Fluxo de bootstrap

1. `(workspace)/layout` carrega `AppShell` (`ssr: false`)
2. `AuthProvider` resolve `storageMode` via `/api/health` (`pending` → `local`|`postgresql`)
3. `AppBootstrapGate` bloqueia UI até auth + workspace hidratado (cloud)
4. `AppRouteBootstrap` faz redirects globais (`/` → home, auth, clientId inválido)
5. `useAppRouteSync` sincroniza URL ↔ estado React

## Regras (não quebrar)

1. **URL é fonte de verdade** — seções/abas visíveis derivam de `clientRoute`, não de state solto
2. **Navegação programática** — use `navigateRoute` / `commitNavigation`, nunca `router.push` direto na UI
3. **Layout persistente** — não reintroduzir `dynamic()` ou providers por page
4. **`storageMode` nunca assume `local` por default** — use `pending` até health
5. **Validação de rota** — só strip `postId`/`pageId` quando `workspaceReady === true`
6. **Bootstrap** — um gate (`AppBootstrapGate`), não spinners espalhados

## Sync URL ↔ estado

- **State → URL:** `commitNavigation` em [`useAppRouteSync.ts`](../src/hooks/useAppRouteSync.ts)
- **URL → state:** effect no mesmo hook, bloqueado por `pendingNavigationRef` durante push
- **Facade:** `navigateRoute` no provider delega para `commitNavigation` registrado pelo App

## Testes

```bash
npm run test:app-routing
npm run test:navigation
```

## Anti-patterns

- `dynamic(AppShell)` em pages individuais
- Effect paralelo state→URL além de `commitNavigation`
- `ensureClientRegistry()` no mount em modo cloud
- Múltiplos full-screen loaders sem coordenação
- `buildClientPath` com `clientId` vazio (deve ir para `/welcome`)
