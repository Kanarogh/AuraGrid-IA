# AuraStudio IA

Plataforma para **planejamento e produção de conteúdo para redes sociais** voltada a **clientes de agências de marketing digital**.

Cobre o ciclo completo: voz da marca → copy mensal com IA → grid visual → roteiro de 30 dias com legendas (e match de referências quando necessário) → agendamento e publicação nas redes conectadas (**Instagram, Facebook, LinkedIn, TikTok, Pinterest, YouTube e YouTube Shorts**).

Cada marca/cliente tem workspace próprio (cronograma, catálogo, grid, roteiro e publicação). Em produção, suporta múltiplos usuários por conta com permissões por equipe.

## Desenvolvimento local (sem Docker)

1. `npm install`
2. Copie `.env.example` → `.env` e configure `GEMINI_API_KEY` (ou outro provedor)
3. `npm run dev` → http://localhost:3000

Sem `DATABASE_URL`, os dados ficam no **localStorage** do navegador.

## PostgreSQL + MinIO (Docker)

> Guia completo: **[docs/SETUP-INFRAESTRUTURA.md](docs/SETUP-INFRAESTRUTURA.md)** (Docker, migrations, MinIO, auth, catálogo, troubleshooting).

### 1. Subir infraestrutura

```bash
npm run docker:infra
```

Sobe Postgres (5432) e MinIO (9000 API, 9001 console).

### 2. Configurar `.env`

```env
DATABASE_URL=postgresql://auragrid:auragrid@localhost:5432/auragrid
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=auragrid
MINIO_SECRET_KEY=auragridsecret
MINIO_BUCKET=auragrid-media
JWT_SECRET=sua-chave-secreta-longa
```

### 3. Migrar banco e rodar app

```bash
npm run db:migrate
npm run dev
```

Com `DATABASE_URL` configurada, o app exige **login/cadastro** e persiste tudo no PostgreSQL + blobs no MinIO.

### Stack completa (app + DB + MinIO)

```bash
npm run docker:up
```

## Scripts úteis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Next.js dev server |
| `npm run test:app-routing` | Testes de parse/build de URLs |
| `npm run test:navigation` | Testes de sync, bootstrap e validação |
| `npm run docker:infra` | Só Postgres + MinIO |
| `npm run docker:up` | Stack completa |
| `npm run db:migrate` | Aplica migrations SQL |

## Migração localStorage → PostgreSQL

1. Faça login no app com Docker/DB ativo
2. Vá em **Configurações**
3. Clique **Importar dados do localStorage**

## API v1

- `POST /api/v1/auth/register|login|refresh|logout`
- `GET /api/v1/clients` — lista clientes
- `GET /api/v1/clients/:id/workspace` — workspace completo
- `POST /api/v1/clients/:id/catalog/batch` — upload de referências
- `GET /api/v1/media/:id` — serve imagem (auth Bearer ou `?token=`)

Health: `GET /api/health` inclui status de DB e MinIO.

## Roteamento e navegação

Arquitetura SPA-in-Next, bootstrap unificado e regras anti-regressão: **[docs/routing.md](docs/routing.md)**.

Com clientes cadastrados, a home do app é **`/dashboard`** (KPIs, pipeline de produção, atalhos e troca de cliente).
