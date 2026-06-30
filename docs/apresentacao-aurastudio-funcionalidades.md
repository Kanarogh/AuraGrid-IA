---
marp: true
theme: default
paginate: true
size: 16:9
style: |
  section {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 28px;
  }
  h1 { color: #1a1a2e; font-size: 1.6em; }
  h2 { color: #16213e; font-size: 1.2em; border-bottom: 3px solid #e94560; padding-bottom: 8px; }
  table { font-size: 0.75em; width: 100%; }
  th { background: #1a1a2e; color: white; }
  strong { color: #e94560; }
  blockquote { border-left: 4px solid #e94560; background: #f8f9fa; padding: 12px 20px; font-size: 0.9em; }
  section.lead h1 { font-size: 2.2em; }
  section.lead p { font-size: 1.1em; color: #555; }
---

<!-- _class: lead -->

# AuraStudio IA

### Funcionalidades e Fluxos

Apresentação para o time · Junho 2026

---

## O que é o AuraStudio IA?

Plataforma para **planejamento e produção de conteúdo para redes sociais** voltada a **clientes de agências de marketing digital**.

Cobre o ciclo completo:

> Voz da marca → Copy mensal com IA → Grid visual → Roteiro 30 dias → Legendas (e match de referências, se necessário) → Publicação nas redes conectadas

Cada **marca/cliente** tem workspace próprio. Suporta **múltiplos usuários** com permissões por equipe.

---

## Redes sociais suportadas

**Instagram · Facebook · LinkedIn · TikTok · Pinterest · YouTube · YouTube Shorts**

Conecte as contas de cada cliente e agende publicações a partir do conteúdo aprovado no roteiro.

---

## Pipeline de Produção

```
Configurações (Brand Gem)
        ↓
Cronograma (copy mensal com IA)
        ↓
Artes no designer externo
        ↓
Catálogo + Grid Canva
        ↓
Planejamento (legendas + aprovação)
        ↓
Programar Posts → Redes sociais conectadas
```

---

## Dashboard

**Página inicial operacional**

- Saudação e KPIs do roteiro ativo
- Legendas pendentes, referências indexadas, slots do grid
- Barra de progresso do pipeline de produção
- Atalhos rápidos para todas as seções
- Grid de clientes com troca rápida de marca
- Criação de novo cliente (dono da conta)

---

## Cronograma de Conteúdo

**Copy mensal estruturado — antes das artes**

- Briefing + voz da marca como contexto para IA
- Gera itens para **posts** e **stories**
  - Headline, CTA, legenda, hashtags, extras de story
- Refinamento item a item em linguagem natural
- Status: rascunho → aprovado → enviado ao planejamento → concluído
- Exportação TXT do cronograma completo
- **Enviar ao Planejamento** — preenche os dias do roteiro

---

## Planejamento e Legendas

**Calendário editorial de 30 dias**

| Aba | Função |
|-----|--------|
| **Dia** | Estúdio por post: foto, match (opcional), legenda, aprovação |
| **Calendário** | Visão em grade de todos os dias |
| **Setup** | Datas, distribuição inteligente, popular calendário |

- Upload de foto por dia ou sync do Grid Canva
- Match + legenda com IA **quando o cliente usa referências**
- Geração em lote e refinamento de legendas
- Aprovação de posts (obrigatória para publicar)
- Exportação PDF · Múltiplos períodos de planejamento

---

## Programar Posts

**Agendamento e publicação nas redes sociais conectadas**

- Calendário semana/mês com drag-and-drop
- Bandeja de posts prontos (foto + legenda + aprovados)
- Preenchimento automático com horários sugeridos
- Preview do post nas redes
- Reagendar, cancelar, retry
- Conexão de contas por cliente (Meta e demais integrações)
- Templates de horário (1–5 posts/dia)
- Publicação automática no horário agendado

---

## Grid Canva

**Montagem visual de páginas de 12 fotos**

- Múltiplas páginas com reordenação
- Slots: drag do catálogo, upload ou clipboard
- Match automático label → referência do catálogo
- **Sync com roteiro** — imagens ordenadas nos dias
- Auto-sync opcional Canva ↔ posts
- Ordem reversa configurável (feed de baixo para cima)
- Exportação PDF do grid

---

## Feed 3×3

**Simulador de prévia do feed social**

- Combina posts planejados + grid Canva montado
- Visualização de como o feed ficará publicado
- Útil para validar harmonia visual antes de publicar

---

## Catálogo

**Referências e peças de grid (opcional por cliente)**

| Aba | Conteúdo |
|-----|----------|
| **Referências** | Itens indexáveis para match com IA |
| **Grid** | Peças de atmosfera/layout (não indexadas) |

**Indexação:**
1. Upload em lote → status **Pendente**
2. Indexação manual (item ou lote)
3. IA gera perfil visual do item
4. Status: pronto / pronto limitado / falhou

---

## Buscar Referência

**Ferramenta foto → código no catálogo** *(quando aplicável)*

- Upload de imagem
- Match visual contra referências indexadas
- Exibe label/código identificado
- Disponível quando o roteiro do cliente usa referências

---

## Configurações do Cliente

| Aba | O que configura |
|-----|-----------------|
| **Marca** | Voz da marca: nome, descrição, instruções, contexto de campanha |
| **Legendas** | Emojis, estilo, rodapé fixo, hashtags, campos customizados |

**Brand Gem completo é obrigatório** antes de gerar legendas ou cronograma.

---

## Configurações da Conta

| Aba | Função |
|-----|--------|
| **Equipe** | Convidar membros, permissões por cliente (dono) |
| **Aparência** | Tema claro/escuro, cor de destaque |
| **IA** | Modelos de IA por operação (dono) |

---

## Autenticação e Equipe

- Cadastro, login, logout
- Membros convidados **redefinem senha** no primeiro acesso
- Papéis: **Dono** (acesso total) e **Membro** (limitado)
- Templates: Gerente · Editor · Visualizador · Custom
- Cada membro vê apenas clientes e seções concedidos

---

## Sincronização em Tempo Real

- Alterações de outro usuário ou aba refletem automaticamente
- Sem precisar recarregar a página
- Progresso de indexação do catálogo em tempo real

---

## Importação de Dados Locais

- Migra clientes, catálogo, posts, grid e imagens
- Do navegador (modo local) → banco em nuvem
- Disponível para o dono da conta em Configurações

---

## Fluxo 1 — Trabalho por Cliente

```
1. Configurar Brand Gem
2. Gerar cronograma com IA
3. Produzir artes (designer externo)
4. Indexar catálogo (se necessário) + montar Grid Canva
5. Sincronizar grid → gerar legendas → aprovar posts
6. Agendar e publicar nas redes sociais conectadas
```

Ordem recomendada para máximo aproveitamento da plataforma.

---

## Fluxo 2 — Cronograma → Planejamento

1. Gera copy mensal no **Cronograma** com IA
2. Revisa e aprova os itens desejados
3. Clica **Enviar ao Planejamento**
4. Dias do roteiro recebem copy estruturado
5. Status do item → *enviado ao planejamento*
6. Legendas do cronograma ficam protegidas contra sobrescrita

---

## Fluxo 3 — Indexação de Catálogo

1. Upload em lote de referências
2. Itens ficam **Pendentes**
3. Usuário aciona **Indexar pendentes**
4. IA analisa cada item → perfil visual
5. Referências ficam **Prontas** para match de legendas
6. Progresso visível em tempo real na UI

---

## Fluxo 4 — Match + Legenda *(opcional)*

1. Post com foto no **Planejamento**
2. Usuário aciona match + legenda
3. IA identifica referência mais provável no catálogo
4. Gera legenda alinhada à voz da marca
5. Exibe diagnóstico de confiança (alta / média / baixa)
6. Usuário revisa, refina e **aprova** o post

---

## Fluxo 5 — Grid Canva → Roteiro

1. Monta páginas no **Grid Canva**
2. Aciona sincronização com roteiro
3. Sistema distribui imagens nos 30 dias
4. Posts recebem fotos automaticamente
5. Legendas já editadas são **preservadas**

---

## Fluxo 6 — Publicação nas Redes Sociais

1. Posts aprovados (foto + legenda + confirmados)
2. Abre **Programar Posts**
3. Conecta contas do cliente (Instagram, Facebook, LinkedIn, etc.)
4. Arrasta posts para calendário ou preenchimento automático
5. Confirma agendamentos
6. Sistema publica automaticamente no horário

---

## Fluxo 7 — Gestão de Equipe

1. Dono abre **Equipe** em Configurações da Conta
2. Cria membro: email, senha temp., clientes, template
3. Membro faz login → **redefine senha**
4. Acessa apenas clientes e seções concedidos
5. Dono pode suspender ou remover a qualquer momento

---

## Papéis e Permissões

| Papel | Acesso |
|-------|--------|
| **Dono** | Tudo: equipe, clientes, IA, publicação |
| **Gerente** | Quase tudo por cliente, incluindo redes sociais |
| **Editor** | Cronograma, posts, grid, catálogo — sem publicação |
| **Visualizador** | Somente leitura em todas as seções |

Permissões configuráveis item a item no template **Custom**.

---

## Mapa de Seções

| Seção | Rota |
|-------|------|
| Dashboard | `/dashboard` |
| Cronograma | `/c/:id/cronograma` |
| Planejamento | `/c/:id/roteiros` |
| Programar Posts | `/c/:id/programar-posts` |
| Grid Canva | `/c/:id/grid-canva` |
| Feed 3×3 | `/c/:id/feed` |
| Catálogo | `/c/:id/catalogo` |
| Buscar Referência | `/c/:id/buscar-referencia` |
| Config. Cliente | `/c/:id/configuracoes` |
| Conta | `/conta/equipe · aparencia · ia` |

---

<!-- _class: lead -->

# Obrigado!

**AuraStudio IA** — do briefing à publicação nas redes sociais

Dúvidas?
