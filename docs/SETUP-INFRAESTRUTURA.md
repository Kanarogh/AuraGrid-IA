# AuraStudio IA — Guia de infraestrutura (Docker, PostgreSQL, MinIO)

Este documento explica como subir o ambiente de desenvolvimento com **Docker**, configurar o **PostgreSQL** e o **MinIO**, e usar os recursos que foram implementados na migração para persistência multi-usuário.

---

## Pré-requisitos

| Ferramenta | Versão sugerida |
|------------|-----------------|
| [Node.js](https://nodejs.org/) | 22+ |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Com Docker Compose |
| npm | Incluso com Node |

No Windows, o Docker Desktop precisa estar **aberto e rodando** antes de executar os comandos abaixo.

---

## Dois modos de operação

| Modo | Quando | Onde ficam os dados |
|------|--------|---------------------|
| **localStorage** | Sem `DATABASE_URL` no `.env` | Apenas no navegador (modo antigo) |
| **PostgreSQL + MinIO** | Com `DATABASE_URL` configurada | Banco + blobs no MinIO |

Com PostgreSQL ativo, o app exige **cadastro/login** e cada usuário tem seus próprios clientes (marcas) e workspaces.

---

## Início rápido (desenvolvimento — recomendado)

Fluxo usado no dia a dia: infra no Docker, app rodando localmente com hot reload.

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie o exemplo e edite:

```bash
cp .env.example .env
```

Conteúdo mínimo para persistência completa:

```env
# PostgreSQL
DATABASE_URL=postgresql://auragrid:auragrid@localhost:5432/auragrid

# MinIO (blob storage — fotos do catálogo, posts, Canva)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=auragrid
MINIO_SECRET_KEY=auragridsecret
MINIO_BUCKET=auragrid-media

# Auth JWT (troque em produção)
JWT_SECRET=sua-chave-secreta-longa-e-aleatoria
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=30

# IA (Gemini-only)
GEMINI_API_KEY=sua-chave-aqui
GEMINI_API_KEY=sua-chave-aqui
```

> **Importante:** com `MINIO_ENDPOINT=localhost`, o app (rodando fora do Docker) fala com o MinIO na porta 9000 do seu PC. Dentro do Docker Compose completo, o endpoint muda para `minio` — veja a seção [Stack completa](#stack-completa-app--db--minio-no-docker).

### 3. Subir infraestrutura (Postgres + MinIO)

```bash
npm run docker:infra
```

Isso usa `docker-compose.dev.yml` e sobe:

| Serviço | Porta | Função |
|---------|-------|--------|
| **postgres** | `5432` | Banco de dados |
| **minio** | `9000` (API), `9001` (console web) | Armazenamento de imagens |
| **minio-init** | — | Cria o bucket `auragrid-media` automaticamente |

Verificar se subiu:

```bash
docker compose -f docker-compose.dev.yml ps
```

### 4. Aplicar migrations do banco

```bash
npm run db:migrate
```

Cria as tabelas (`users`, `clients`, `catalog_items`, `media_assets`, `planned_posts`, etc.) a partir de `server/db/migrations/0000_initial.sql`.

> O servidor também tenta rodar migrations na subida (`npm run dev`), mas é recomendado executar `db:migrate` explicitamente na primeira vez.

### 5. Iniciar o app

```bash
npm run dev
```

Abra **http://localhost:3000**, crie uma conta e comece a usar.

---

## Stack completa (app + DB + MinIO no Docker)

Para rodar **tudo** dentro do Docker (útil para testar o ambiente “de produção” local):

```bash
npm run docker:up
```

Usa `docker-compose.yml` e sobe:

- `postgres` — banco
- `minio` + `minio-init` — storage
- `migrate` — aplica migrations e encerra
- `app` — servidor na porta **3000**

O serviço `app` já recebe `DATABASE_URL` e `MINIO_ENDPOINT=minio` internamente. Mantenha o `.env` com a chave `GEMINI_API_KEY`.

Parar tudo:

```bash
npm run docker:down
```

---

## Arquitetura

```mermaid
flowchart LR
  subgraph browser [Navegador]
    UI[Next.js App Router - React]
  end

  subgraph app [AuraStudio Next.js :3000/80]
    API[Route Handlers /api/**]
    AI[Provedores IA]
  end

  subgraph docker [Docker]
    PG[(PostgreSQL :5432)]
    MINIO[(MinIO :9000)]
  end

  UI -->|JWT + REST| API
  API --> PG
  API --> MINIO
  API --> AI
```

### O que fica onde

| Dado | PostgreSQL | MinIO |
|------|:----------:|:-----:|
| Usuários, sessões | ✓ | |
| Clientes / marcas | ✓ | |
| Brand Gem, UI prefs | ✓ | |
| Metadados do catálogo (label, JSON de indexação) | ✓ | |
| **Arquivos de imagem** (bytes) | | ✓ |
| Posts 30 dias, grid Canva | ✓ | ✓ (imagens) |
| Cache de legendas | ✓ | |

Imagens são servidas pela API em `GET /api/v1/media/:id` (autenticado via Bearer ou `?token=` na URL para tags `<img>`).

---

## MinIO — console e credenciais

Após `npm run docker:infra`:

- **Console web:** http://localhost:9001
- **Usuário:** `auragrid`
- **Senha:** `auragridsecret`
- **Bucket:** `auragrid-media` (criado pelo `minio-init`)

O bucket é **privado** — as imagens só são acessíveis via API autenticada do AuraStudio.

---

## Autenticação multi-usuário

Com `DATABASE_URL` configurada:

1. Na primeira visita, **cadastre-se** (email + senha).
2. O login retorna um **JWT** (access token) + cookie de **refresh token**.
3. Cada usuário vê apenas **seus clientes** e workspaces.
4. Logout disponível na sidebar.

Endpoints principais:

```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

---

## Catálogo de referências (fluxo atual)

1. **Subir referências** — pasta ou arquivos na aba *Catálogo*. As fotos vão para o MinIO; os metadados ficam no Postgres com status **Pend.**
2. **Indexação manual** — use **Indexar pendentes** ou **Indexar** em cada card quando quiser gerar o perfil visual (JSON) para match nos roteiros.
3. **Excluir catálogo** — remove todas as referências do cliente ativo (com confirmação).

A indexação **não** inicia automaticamente após o upload.

---

## Migrar dados do localStorage

Se você usava o app antes (dados só no navegador):

1. Suba Docker + configure `.env` + rode `db:migrate`.
2. Faça **login** no app.
3. Vá em **Configurações**.
4. Clique em **Importar dados do localStorage**.

Isso envia clientes, catálogo, posts e Canva para a API (`POST /api/v1/migrate/local-storage`).

---

## Health check

Verifique se DB, MinIO e IA estão OK:

```
GET http://localhost:3000/api/v1/health
```

Exemplo de resposta relevante:

```json
{
  "storage": {
    "mode": "postgresql",
    "database": { "configured": true, "ok": true },
    "minio": { "configured": true, "ok": true }
  }
}
```

Se `database.ok` ou `minio.ok` for `false`, veja [Solução de problemas](#solução-de-problemas).

---

## Scripts npm

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Next.js dev server (porta 3000) |
| `npm run docker:infra` | Só Postgres + MinIO (dev local) |
| `npm run docker:up` | Stack completa com app containerizado |
| `npm run docker:down` | Para containers do `docker-compose.yml` |
| `npm run db:migrate` | Aplica migrations SQL |
| `npm run build` | Build de produção (`next build`) |
| `npm run start` | Produção (`next start -p 80`) |
| `npm run lint` | Typecheck (`tsc --noEmit`) |

---

## API v1 — referência rápida

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/health` | Status IA + DB + MinIO |
| GET | `/api/v1/clients` | Lista marcas do usuário |
| POST | `/api/v1/clients` | Cria marca |
| GET | `/api/v1/clients/:id/workspace` | Workspace completo |
| PATCH | `/api/v1/clients/:id/workspace` | Atualiza workspace |
| POST | `/api/v1/clients/:id/catalog/batch` | Upload em lote de referências |
| POST | `/api/v1/clients/:id/catalog/enrich` | Indexar catálogo (manual) |
| POST | `/api/v1/clients/:id/catalog/clear` | Excluir catálogo inteiro |
| GET | `/api/v1/media/:id` | Download de imagem |
| POST | `/api/v1/clients/:id/media` | Upload de mídia avulsa |

Todas as rotas (exceto auth e GET de mídia com token) exigem header `Authorization: Bearer <access_token>`.

---

## Solução de problemas

### Docker não sobe / porta em uso

- Confirme que o Docker Desktop está rodando.
- Se a porta `5432` ou `9000` já estiver em uso, pare o serviço conflitante ou altere o mapeamento em `docker-compose.dev.yml`.

### `database.ok: false`

```bash
npm run docker:infra
npm run db:migrate
```

Confira se `DATABASE_URL` aponta para `localhost:5432` (modo dev fora do Docker).

### `minio.ok: false`

```bash
docker compose -f docker-compose.dev.yml ps
```

O serviço `minio` deve estar `running`. Aguarde alguns segundos após o `up` — o `minio-init` precisa criar o bucket.

### Imagens do catálogo não aparecem

1. Verifique `minio.ok: true` no health.
2. Recarregue a página (F5) após login — as URLs de mídia usam token JWT na query string.
3. Confirme que o upload retornou itens com `imageAssetId` preenchido.

### Migrations já aplicadas

Rodar `npm run db:migrate` novamente é seguro — migrations já aplicadas são ignoradas (tabela `__drizzle_migrations`).

### Reset completo da infra Docker (dev)

```bash
docker compose -f docker-compose.dev.yml down -v
npm run docker:infra
npm run db:migrate
```

> `-v` apaga volumes (`pg_data`, `minio_data`) — **perde todos os dados** do banco e do MinIO.

---

## Estrutura de arquivos relevante

```
AuraStudio-IA/
├── docker-compose.dev.yml    # Dev: só Postgres + MinIO
├── docker-compose.yml        # Stack completa (app + migrate)
├── Dockerfile
├── .env.example
├── server/
│   ├── db/
│   │   ├── schema.ts         # Schema Drizzle
│   │   ├── migrate.ts        # Runner de migrations
│   │   └── migrations/
│   │       ├── 0000_initial.sql
│   │       └── 0007_content_schedule.sql   # cronograma + structured_copy nos posts
│   ├── routes/               # auth, clients, catalog, media…
│   └── services/             # auth, catalog, media (MinIO), enrichQueue
└── src/
    ├── context/AuthContext.tsx
    ├── context/ApiWorkspaceSync.tsx
    └── lib/api/workspaceApi.ts
```

---

## Checklist — primeira vez

- [ ] Docker Desktop instalado e rodando
- [ ] `npm install`
- [ ] `.env` criado a partir de `.env.example`
- [ ] `DATABASE_URL`, MinIO e `JWT_SECRET` configurados
- [ ] Chave de IA Gemini (`GEMINI_API_KEY`)
- [ ] `npm run docker:infra`
- [ ] `npm run db:migrate`
- [ ] `npm run dev`
- [ ] Cadastro/login em http://localhost:3000
- [ ] Health OK em `/api/v1/health`
- [ ] (Opcional) Importar localStorage em Configurações

---

## Fluxo de trabalho recomendado

Ordem sugerida no workspace de cada marca:

1. **Configurações** — Gem da marca, instruções e contexto de campanha.
2. **Cronograma de Conteúdo** (`/c/:id/cronograma`) — gera copy mensal estruturado (headline, CTA, legenda, hashtags) para posts de arte e stories **antes** de produzir as artes.
3. **Designer (externo)** — artes criadas fora do app com base no cronograma exportado (TXT).
4. **Catálogo / Grid Canva** — referências e montagem das páginas de 12 fotos.
5. **Planejamento e legendas** (`/c/:id/roteiros`) — calendário de 30 dias; use **Enviar ao Planejamento** no cronograma para preencher dias com copy aprovado.

> A URL `/roteiros` foi mantida por compatibilidade; na interface o nome exibido é **Planejamento**.

---

## Produção (notas)

- Troque `JWT_SECRET` por um valor longo e aleatório.
- Use senhas fortes no Postgres e MinIO (não os defaults `auragrid` / `auragridsecret`).
- Configure `MINIO_USE_SSL=true` e endpoint público se o MinIO estiver exposto.
- Rode `npm run build` + `npm run start` (Next.js na porta 80) ou use o Dockerfile.
- Não commite o arquivo `.env` — ele contém segredos.

---

## Deploy no Square Cloud (Next.js + backend integrado)

O app agora é um único projeto **Next.js (App Router)** com o backend embutido em Route Handlers (`app/api/**`). O Square Cloud roda um processo Node **persistente**, então a fila de indexação em memória (`server/services/enrichQueue.ts`) e o estado de IA (circuit breaker, runtime settings) continuam funcionando.

### Arquivo de configuração

O `squarecloud.app` na raiz define o deploy:

```
DISPLAY_NAME=AuraStudio IA
MAIN=next.config.ts
MEMORY=2048
VERSION=recommended
AUTORESTART=true
START=NODE_OPTIONS=--max-old-space-size=1536 npm run build && npm run db:migrate && npm run start
SUBDOMAIN=aurastudio
```

- `START` roda `next build`, **`npm run db:migrate`** (aplica migrations pendentes, incluindo `0007_content_schedule.sql`) e depois `next start -p 80` (a porta 80 é exigida para websites no Square Cloud).
- `MEMORY` ≥ 512 MB; sugerido **2048** por causa do build do Next e da fila de indexação.
- `AUTORESTART=true` para o processo voltar sozinho após falhas.

### Migration 0007 (Cronograma de Conteúdo)

> **Nova migration?** Siga o checklist em **[docs/MIGRATIONS.md](./MIGRATIONS.md)** — criar o `.sql` **e** registrar em `server/db/migrationCatalog.ts`. Sem o catálogo, o Square Cloud não aplica a migration no deploy.

Obrigatória para persistência do cronograma na nuvem. Adiciona:

- `planning_periods.content_schedule` (jsonb) — itens do cronograma mensal
- `planned_posts.structured_copy` (jsonb) — copy estruturado vindo do cronograma
- `planned_posts.caption_from_schedule` (boolean) — protege legenda enviada pelo cronograma

As migrations rodam de duas formas redundantes em produção:

1. **`instrumentation.ts`** — no boot do Next.js (`register()` chama `runMigrations()`).
2. **`squarecloud.app` START** — `npm run db:migrate` após o build.

Em desenvolvimento local, após `npm run docker:infra`, execute manualmente:

```bash
npm run db:migrate
```

### Passos

1. **Banco gerenciado (PostgreSQL):** provisione um Postgres gerenciado (ex.: Neon, Supabase, Railway) e copie a connection string para `DATABASE_URL` nas variáveis de ambiente do Square Cloud.
2. **Storage S3-compatível externo:** em produção o MinIO local não existe. Use um bucket S3-compatível (AWS S3, Cloudflare R2, etc.). O cliente (`@aws-sdk/client-s3`) já suporta — basta apontar as variáveis:

   ```env
   MINIO_ENDPOINT=<host do endpoint S3, ex: <conta>.r2.cloudflarestorage.com>
   MINIO_PORT=443
   MINIO_USE_SSL=true
   MINIO_ACCESS_KEY=<access key>
   MINIO_SECRET_KEY=<secret key>
   MINIO_BUCKET=auragrid-media
   ```

   > Para R2/S3 com domínio (porta 443 + SSL), o `forcePathStyle` já está habilitado em `mediaService.ts`. Crie o bucket previamente no provedor.
3. **JWT e IA:** defina `JWT_SECRET` forte e a chave `GEMINI_API_KEY`.
4. **Migrations:** ver [docs/MIGRATIONS.md](./MIGRATIONS.md) (checklist completo) e a seção [Migration 0007](#migration-0007-cronograma-de-conteúdo) abaixo. Com `DATABASE_URL` definida, `instrumentation.ts` também aplica migrations no boot.
5. **Upload do projeto:** gere o `.zip` **sem** `node_modules` e **sem** `.next` (o Square Cloud instala dependências e o `START` faz o build). O `.gitignore` já exclui ambos.

### Health em produção

```
GET https://<subdominio>.squareweb.app/api/v1/health
```

Deve retornar `storage.mode: "postgresql"` com `database.ok` e `minio.ok` em `true`.
