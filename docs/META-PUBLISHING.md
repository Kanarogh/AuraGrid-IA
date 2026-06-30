# Publicação nas redes sociais

Guia para configurar e usar a funcionalidade **Programar posts** no AuraStudio — agendamento e publicação para clientes de agência em **Instagram, Facebook, LinkedIn, TikTok, Pinterest, YouTube e YouTube Shorts**.

> **Integração atual:** OAuth e publicação automática via **Meta** (Instagram feed). Outras redes entram no roadmap de integrações.

> Detalhes da implementação, arquitetura e pendências de produto: [`PROGRAMAR-POSTS.md`](./PROGRAMAR-POSTS.md)

## O que foi implementado

- Seção **Programar posts** (`/c/:clientId/programar-posts`) — **Scheduler Hub** profissional
- **Calendário** semana/mês com drag-and-drop, gaps do planejamento e cores por status
- **Bandeja** de posts prontos + **Preencher automaticamente** (só no período visível)
- **Composer** lateral (preview, legenda, data/hora, agendar/reagendar/cancelar)
- **Preview Feed 3×3** integrado no hub (desktop + bottom sheet mobile) com badges de horário
- **Lista operacional** com filtros, retry/cancel em lote
- Conexão OAuth de contas sociais via Meta (Instagram Profissional hoje)
- Templates de horário (1–5 posts/dia) em **Configurações**
- Worker em background + polling na UI (30s)
- Limite Meta **X/100 publicações (24h)** no toolbar

## Variáveis de ambiente

```env
META_APP_ID=
META_APP_SECRET=
META_OAUTH_REDIRECT_URI=https://seu-dominio/api/v1/meta/oauth/callback
META_TOKEN_ENCRYPTION_KEY=   # 32 bytes em base64 — gere uma vez e guarde
META_GRAPH_VERSION=v21.0
META_PUBLISH_MOCK=1          # use 1 em dev local sem credenciais Meta
NEXT_PUBLIC_APP_URL=https://seu-dominio
```

Também são necessários `DATABASE_URL` e armazenamento de mídia (`MINIO_*` ou `SQUARECLOUD_BLOB_*`).

Migration: `0015_meta_publish.sql` (aplicada automaticamente no deploy).

## Desenvolvimento local (sem Meta)

1. Configure `META_PUBLISH_MOCK=1`
2. Use modo nuvem (`DATABASE_URL` + MinIO)
3. Conecte uma conta Meta **opcional** — com mock, a fila publica simulando sucesso
4. Fluxo: aprovar posts em **Planejamento e legendas** → **Programar posts** → arrastar para o calendário ou **Preencher automaticamente** → **Confirmar**

## Checklist Meta Developer (produção)

### App no Meta for Developers

1. Criar app em [developers.facebook.com](https://developers.facebook.com/) — tipo **Business**
2. Adicionar produto **Instagram** + **Facebook Login**
3. Configurar **OAuth Redirect URI**: `https://SEU_DOMINIO/api/v1/meta/oauth/callback`
4. Permissões necessárias:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
   - `pages_show_list`
5. **App Review** — screencast: login → conectar conta → agendar post → publicação
6. **Privacy Policy URL** pública
7. Modo **Development**: até ~25 usuários de teste — suficiente para validar antes do review

### Por marca / cliente

1. Instagram **Profissional** (Business ou Creator)
2. Vinculada a uma **Página do Facebook**
3. Usuário que conecta deve ser **admin** da Page
4. Completar **Page Publishing Authorization (PPA)** se solicitado
5. 2FA ativo na conta Facebook

### Infraestrutura

- Domínio HTTPS estável (Meta rejeita redirect HTTP em produção)
- `NEXT_PUBLIC_APP_URL` apontando para o domínio público
- Health: `database.ok` + storage OK após deploy

## Responsabilidades do usuário (não automatizadas pelo AuraStudio)

| Item | Quem faz |
|------|----------|
| Criar app Meta + App Review | Você |
| Privacy Policy URL | Você |
| Conta Instagram Profissional + Page Facebook | Cliente/marca |
| Conectar conta na aba Programar posts | Usuário logado (admin da Page) |
| Aprovar legendas e fotos no planejamento | Usuário |
| Reconectar quando token expira (~60 dias) | Usuário (banner na UI) |

## Limitações conhecidas

- Apenas **feed** (foto + legenda) — Stories/Reels não suportados
- Snapshot no job: editar post após agendar não atualiza o agendamento automaticamente
- Rate limit Meta: ~100 publicações/dia por conta (tratado no servidor)
- Modo **local** (sem PostgreSQL): seção indisponível — aviso na UI

## Revisão de entrega (Fase E)

### Verificação técnica

- [x] `npm run lint` sem erros
- [x] Testes: `suggestScheduleTimes`, `publishCalendarUtils`, routing `post_scheduling`
- [ ] Migration `0015` aplica limpo em banco vazio com dados reais (validar no deploy)

### Fluxo funcional (META_PUBLISH_MOCK=1)

- [x] Sidebar → Programar posts → URL `/c/:id/programar-posts`
- [x] Scheduler Hub: calendário, lista, config, bandeja, composer, feed 3×3
- [x] Configurações: templates 1–5 posts/dia persistem
- [x] Preencher automaticamente + override manual + drag-and-drop
- [x] Modal de confirmação com preview Instagram (carrossel multi-post)
- [x] Worker mock → status publicado
- [x] Cancelar / retry (individual e lote na lista)
- [x] Modo local exibe aviso

### OAuth real (quando credenciais disponíveis)

- [ ] Connect → callback → conta conectada
- [ ] Disconnect limpa estado
- [ ] Token expirado → banner reconectar
- [ ] Publicação real em Development mode

### Gaps pendentes de configuração externa

- App Review Meta (produção pública)
- Env vars de produção no deploy
- Job de refresh de token (recomendado: cron semanal) — reconexão manual disponível na UI
