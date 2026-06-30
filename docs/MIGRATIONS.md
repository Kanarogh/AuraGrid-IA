# Migrations do banco (PostgreSQL)

Guia rápido para alterações de schema que exigem migration. **O Square Cloud aplica migrations automaticamente no deploy** (`npm run db:migrate` no `START` do `squarecloud.app` e no boot via `instrumentation.ts`), **desde que a migration esteja registrada no catálogo**.

---

## Checklist obrigatório

Sempre que você alterar o schema do PostgreSQL (nova coluna, tabela, índice, etc.):

1. **Criar o arquivo SQL** em `server/db/migrations/`  
   - Nome: `00NN_descricao_curta.sql` (próximo número sequencial, ex.: `0022_minha_feature.sql`).
   - Preferir `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` quando fizer sentido.

2. **Registrar no catálogo** — [`server/db/migrationCatalog.ts`](../server/db/migrationCatalog.ts)  
   - Adicionar o hash (nome do arquivo **sem** `.sql`) **no final** do array `MIGRATION_FILES`, na mesma ordem numérica.
   - **Sem este passo, o deploy no Square Cloud não aplica a migration**, mesmo que o arquivo `.sql` exista no repositório.

3. **Atualizar o schema Drizzle** — [`server/db/schema.ts`](../server/db/schema.ts)  
   - Manter alinhado com o SQL (colunas, tipos, defaults).

4. **Ajustar serviços/API** que leem ou gravam os novos campos (ex.: `server/services/clientService.ts`).

5. **Testar localmente** (com Postgres rodando):

   ```bash
   npm run docker:infra   # se ainda não subiu
   npm run db:migrate
   ```

6. **Subir para o Square Cloud** — no próximo deploy, o `START` roda:

   ```
   npm run build && npm run db:migrate && npm run start
   ```

   Migrations já aplicadas são ignoradas (tabela `__drizzle_migrations`).

---

## O que acontece se esquecer o catálogo?

Exemplo real: migration `0021_content_schedule_options.sql` criada, mas **não** listada em `MIGRATION_FILES`.

- O código passa a usar a coluna `content_schedule_options` (via Drizzle).
- O banco em produção **não** recebe a coluna.
- Resultado: erro ao carregar workspace, mensagem do tipo *Failed query: select … "content_schedule_options" … from "planning_periods"*.

**Regra:** arquivo `.sql` + entrada em `migrationCatalog.ts` são **um par obrigatório**.

---

## Onde as migrations rodam

| Ambiente | Como |
|----------|------|
| **Square Cloud (deploy)** | `squarecloud.app` → `START` inclui `npm run db:migrate` após o build |
| **Square Cloud / produção (boot)** | `instrumentation.ts` → `runMigrations()` na subida do Next.js |
| **Dev local** | `npm run db:migrate` manual (recomendado na 1ª vez) ou boot do `npm run dev` |

---

## Estrutura dos arquivos

```
server/db/
├── migrate.ts              # Runner (lê MIGRATION_FILES e aplica SQL)
├── migrationCatalog.ts     # ← REGISTRAR TODA MIGRATION NOVA AQUI
├── schema.ts               # Schema Drizzle (TypeScript)
└── migrations/
    ├── 0000_initial.sql
    ├── …
    └── 00NN_nova_feature.sql
```

---

## Exemplo: nova coluna

**1.** `server/db/migrations/0022_exemplo.sql`:

```sql
ALTER TABLE planning_periods
  ADD COLUMN IF NOT EXISTS minha_coluna text NOT NULL DEFAULT '';
```

**2.** `server/db/migrationCatalog.ts`:

```ts
export const MIGRATION_FILES = [
  // … migrations anteriores …
  "0021_content_schedule_options",
  "0022_exemplo",  // ← adicionar
] as const;
```

**3.** Coluna correspondente em `server/db/schema.ts` e lógica em `clientService.ts` (GET/PATCH).

**4.** `npm run db:migrate` → commit → push → deploy Square Cloud.

---

## Referências

- Deploy e variáveis: [SETUP-INFRAESTRUTURA.md](./SETUP-INFRAESTRUTURA.md) (seção Square Cloud)
- Config do deploy: [`squarecloud.app`](../squarecloud.app) na raiz do projeto
