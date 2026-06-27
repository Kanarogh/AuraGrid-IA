# Roteamento AuraGrid (SPA-in-Next)

O AuraGrid usa o **Next.js App Router** só para registrar URLs e servir APIs. A UI é uma SPA client-side montada uma vez no layout `(workspace)`.

## Estrutura

```
app/
├── layout.tsx                 # HTML shell + tema
├── (workspace)/layout.tsx     # AppShell persistente (dynamic ssr:false)
├── (workspace)/page.tsx       # GET /  → null
├── (workspace)/welcome/       # GET /welcome
├── (workspace)/dashboard/     # GET /dashboard
├── (workspace)/c/[clientId]/  # GET /c/:id/...
├── login/page.tsx             # Fora do workspace (AuthProvider separado)
└── not-found.tsx              # Redirect → /welcome
```

Providers e `src/App.tsx` vivem em [`app/AppShell.tsx`](../app/AppShell.tsx). Pages retornam `null` — **nunca** monte providers em `page.tsx`.

## Fluxo de bootstrap

1. `(workspace)/layout` carrega `AppShell` (`ssr: false`)
2. `AuthProvider` resolve `storageMode` via `/api/health` (`pending` → `local`|`postgresql`)
3. `AppBootstrapGate` bloqueia UI até auth + workspace hidratado (cloud)
4. `AppRouteBootstrap` faz redirects globais (`/` → `/dashboard` ou `/welcome`, auth, clientId inválido)
5. `useAppRouteSync` sincroniza URL ↔ estado React

## Home e dashboard

| Rota | Quem vê |
|------|---------|
| `/` | Redirect-only |
| `/welcome` | Onboarding sem clientes |
| `/dashboard` | Home com KPIs, pipeline, atalhos e lista de clientes |

UI em [`DashboardView.tsx`](../src/components/dashboard/DashboardView.tsx). Sidebar: item **Dashboard** (Início).

## Regras (não quebrar)

1. **URL é fonte de verdade** — seções/abas visíveis derivam de `clientRoute`, não de state solto
2. **Navegação programática** — use `navigateRoute` / `commitNavigation`, nunca `router.push` direto na UI
3. **Layout persistente** — não reintroduzir `dynamic()` ou providers por page
4. **`storageMode` nunca assume `local` por default** — use `pending` até health
5. **Validação de rota** — só strip `postId`/`pageId` quando `workspaceReady === true`
6. **Bootstrap** — um gate (`AppBootstrapGate`), não spinners espalhados

## Sync URL ↔ estado

- **State → URL:** `commitNavigation` em [`useAppRouteSync.ts`](../src/hooks/useAppRouteSync.ts)
- **URL → state:** effects separados no mesmo hook (canonical replace, apply patch, reconciliação state→URL)
- **Facade:** `navigateRoute` no provider delega para `commitNavigation` registrado pelo App
- **Build context:** `registerRouteBuildContext` serializa `?period=` como slug legível (`YYYY-MM`)

### Contrato: o que vai na URL vs. só no state

| Na URL | Só no state (React / workspace) |
|--------|----------------------------------|
| `clientId`, seção, abas (`postsTab`, `catalogTab`, `settingsTab`) | Gem dirty, enrich de catálogo, swap mode |
| `postId`, `pageId`, `slotId` (quando válidos) | Conteúdo editável, drafts locais |
| `?period=` slug legível (`2026-06`) quando ≠ roteiro padrão | `activePlanningPeriodId` interno após fetch |

### Query `?period=`

- **Formato canônico:** `YYYY-MM` derivado de `PlanningPeriod.startDate` (ex.: Junho 2026 → `?period=2026-06`)
- **Colisão no mesmo mês:** fallback para `YYYY-MM-DD` (`?period=2026-06-01`)
- **Compat legado:** IDs internos (`*_period_*`, `__period_`) na query são resolvidos e substituídos por `router.replace` com slug legível
- **Roteiro estrangeiro** (period de outro cliente na URL): substituído pelo period ativo do cliente ou removido
- **Omitido** quando o period na rota coincide com o roteiro padrão do workspace (`defaultPeriodId`)

Resolução em [`periodSlug.ts`](../src/lib/appRouting/periodSlug.ts); validação em [`validateClientRoute`](../src/lib/appRouting/defaults.ts).

## Testes

```bash
npm run test:app-routing   # paths + periodSlug
npm run test:navigation
```

## Anti-patterns

- `dynamic(AppShell)` em pages individuais
- Effect paralelo state→URL além de `commitNavigation`
- `ensureClientRegistry()` no mount em modo cloud
- Múltiplos full-screen loaders sem coordenação
- `buildClientPath` com `clientId` vazio (deve ir para `/welcome`)
