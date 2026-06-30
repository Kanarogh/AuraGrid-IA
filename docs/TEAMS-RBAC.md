# Teams e RBAC

Sistema de equipe no modo nuvem: **owner** (admin da conta) convida **membros** com acesso por cliente e permissões granulares.

## Papéis

| Papel | Descrição |
|-------|-----------|
| **owner** | Dono da conta; acesso total; aba Equipe em Configurações |
| **member** | Convidado; acesso só aos clientes e seções concedidos |

Templates ao convidar: **Gerente**, **Editor**, **Visualizador** (+ toggle **Programar posts**).

## Fluxo

1. Owner abre **Configurações → Equipe**
2. Cria membro (e-mail, senha temporária, clientes, função)
3. Membro faz login → **Redefinir senha** obrigatória
4. Membro vê só clientes/seções permitidos

## Registro público

Desabilitado por padrão. Dev local: `AURASTUDIO_ALLOW_PUBLIC_REGISTER=1` (legado: `AURAGRID_ALLOW_PUBLIC_REGISTER=1`).

## Migration

```bash
npm run docker:infra   # se usar Docker
npm run db:migrate
```

Aplica `0017_teams_rbac.sql` (colunas em `users`, `team_members`, `client_member_access`).

## API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/team/members` | Lista membros (owner) |
| POST | `/api/v1/team/members` | Cria membro |
| PATCH | `/api/v1/team/members/:userId` | Atualiza membro |
| DELETE | `/api/v1/team/members/:userId` | Remove membro + grants |
| POST | `/api/v1/auth/change-password` | Troca senha |
| GET | `/api/v1/auth/me` | Perfil + `clientGrants` |
| POST | `/api/v1/auth/refresh` | Renova token + perfil RBAC |

## Autorização

- `assertClientAccess` aceita owner **ou** grant ativo em `client_member_access` **com** linha em `team_members` e `users.status = active`
- Membro removido: grants apagados + refresh tokens revogados
- Membro suspenso: refresh tokens revogados; access token expira naturalmente

### Matriz rota → permissão (principais)

| Área | Leitura | Escrita |
|------|---------|---------|
| Workspace GET | `content_schedule: read` | — |
| Workspace PATCH | — | por campo (`posts`, `catalog`, `canva_grid`, `settings`, `content_schedule`) |
| Catálogo | `catalog: read` | `catalog: write` |
| Posts / mídia / caption-cache | `posts: read` | `posts: write` |
| Calendário editorial | `content_schedule: read` | `content_schedule: write` |
| Períodos de planejamento | `content_schedule: read` | `content_schedule: write` + `managePlanningPeriods` |
| Brand Gem | `settings: read` | `settings: write` + `manageBrandGem` |
| Programar posts | `post_scheduling: read` | `post_scheduling: write` + `managePublish` |
| Meta OAuth | — | `post_scheduling: write` + `connectMeta` (start **e** callback) |
| Reset cliente | — | `manageClients` |
| Criar cliente (POST /clients) | — | owner only |
| Import local-storage | — | owner only |
| AI settings / gemini-model PUT | — | owner only |
| refine-caption / match-and-generate | — | `posts: write` + clientId |
| match-reference | — | `reference_finder: read` |
| generate-content-schedule | — | `content_schedule: write` |
| enrich-catalog-item | — | `catalog: write` |

Presets em `server/http/sectionAccess.ts` e `server/http/publishAccess.ts`.

## Frontend

- `SectionGate` bloqueia deep URLs sem permissão
- `ClientWorkspaceContext.isReadOnly` inclui viewer RBAC (sem write na seção ativa)
- Sidebar e dashboard quick actions filtrados por permissão
- CRUD de clientes visível só para owner

## Roadmap v2

Painel super-admin para provisionar contas **owner** independentes (multi-tenant SaaS).
