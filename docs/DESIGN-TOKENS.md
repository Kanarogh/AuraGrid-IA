# AuraStudio — Design Tokens

Referência visual: pasta [`images/`](../images/) (UX Kit / brand guide).

## Tipografia

| Token | Valor |
|-------|-------|
| `--font-sans` | Sora, system-ui |
| `--font-display` | Sora, system-ui |
| `--font-mono` | JetBrains Mono |

## Marca (fixas)

| Token | Hex |
|-------|-----|
| `--ag-brand-purple` | `#7B5CFF` |
| `--ag-brand-blue` | `#4361FF` |
| `--ag-brand-cyan` | `#00D4FF` |
| `--ag-brand-teal` | `#00E4B5` |

Gradientes definidos em [`src/styles/aura-tokens.css`](../src/styles/aura-tokens.css):

- `--ag-gradient-brand` — roxo → azul → ciano (135deg)
- `--ag-gradient-btn` — roxo → azul (botões primários)
- `--ag-gradient-text` — texto “STUDIO” e destaques

## Superfícies — modo claro

| Token | Hex |
|-------|-----|
| `--ag-bg` | `#F2F4F7` |
| `--ag-surface-1` | `#FFFFFF` |
| `--ag-surface-2` | `#F8F9FB` |
| `--ag-surface-3` | `#E6E8EE` |
| `--ag-border` | `#E6E8EE` |
| `--ag-text` | `#0D0F14` |
| `--ag-muted` | `#5C6370` |

## Superfícies — modo escuro

| Token | Hex |
|-------|-----|
| `--ag-bg` | `#111218` |
| `--ag-surface-1` | `#23242B` |
| `--ag-surface-2` | `#1A1B22` |
| `--ag-surface-3` | `#2D2E36` |
| `--ag-border` | `#2D2E36` |
| `--ag-text` | `#E6E7ED` |
| `--ag-muted` | `#9CA3AF` |

## Semânticas (ambos os modos)

| Token | Hex |
|-------|-----|
| `--ag-success` | `#00E4B5` |
| `--ag-warning` | `#E6A23C` (light) / `#FBBF24` (dark) |
| `--ag-danger` | `#EF4444` (light) / `#F87171` (dark) |

## Accent preset padrão

`data-accent="aura"` — roxo `#7B5CFF` (light), `#9B84FF` (dark). Presets opcionais permanecem em Configurações → Aparência.

**Cliente e servidor:** o preset padrão é `aura` em [`useAccent.ts`](../src/hooks/useAccent.ts), [`appearanceSchema.ts`](../server/validation/appearanceSchema.ts) e migration `0020_appearance_default_aura`. Usuários que já salvaram outro preset na nuvem mantêm a escolha.

## Ícones de plataforma (publicação)

Em [`SocialConnectionsPanel.tsx`](../src/components/publish/SocialConnectionsPanel.tsx), fundos dos ícones usam tokens de marca (não cores Tailwind genéricas):

| Plataforma | Gradiente |
|------------|-----------|
| Instagram | `--ag-gradient-brand` |
| Facebook | `--ag-brand-blue` → `--ag-brand-purple` |
| LinkedIn | `--ag-brand-blue` → `--ag-brand-cyan` |
| Pinterest | `--ag-brand-purple` → `--ag-brand-teal` |

Ícones sobre gradiente: `text-ag-accent-fg`.

## Sombras (modo claro)

| Token | Uso |
|-------|-----|
| `--ag-shadow-sm` | Cards compactos (`WorkspaceCard`, seletor de período) |
| `--ag-shadow` | Cards padrão, botões accent, hovers leves |
| `--ag-shadow-lg` | Heroes, modais, drawers, FAB mobile |

Preferir `shadow-[var(--ag-shadow)]` / `-lg` em vez de `shadow-sm|lg|2xl` do Tailwind.

## Superfície glass (modo claro)

| Token | Valor |
|-------|-------|
| `--ag-glass-bg` | `#ffffffd1` — topbar e overlays com `ag-glass` |

## Header de módulo — `WorkspaceHero`

Componente discreto em [`WorkspaceHero.tsx`](../src/components/layout/WorkspaceHero.tsx): borda + `bg-ag-surface-1` + `shadow-[var(--ag-shadow-lg)]`, **sem** mesh. Usado em Dashboard, Publicar, Cronograma, Config (page), Conta.

Conteúdo denso (calendário, Post do dia) pode manter `ag-studio` + `ag-studio-mesh`.

## Texto sobre fundo colorido

- Botões / chips accent: `text-ag-accent-fg` (não `text-white`)
- Sucesso em badge pequeno: `text-ag-text` sobre `bg-ag-success`
- Overlays sobre imagem ou mockups IG: `text-white` permitido

## Modo escuro

Polish visual do dark mode — fase posterior (fora do escopo atual).

## Raio

| Token | Valor |
|-------|-------|
| Botões / inputs | `8px` (`rounded-lg`, `--radius-ag-md`) |
| Cards / modais | `12px` (`rounded-xl`, `--radius-ag-xl`) |

## Classes utilitárias

| Classe | Uso |
|--------|-----|
| `ag-gradient-text` | Texto com gradiente de marca |
| `ag-gradient-btn` | Botão primário/accent |
| `ag-studio-mesh` | Glow roxo/ciano em hero |
| `ag-auth-mesh` | Fundo login/splash |
| `ag-sidebar-nav-active` | Item ativo na sidebar |
| `ag-brand-wordmark` | “aura” lowercase |
| `ag-brand-studio` | “STUDIO” tracked uppercase |

## Logo

Componentes: [`AuraLogoIcon.tsx`](../src/components/brand/AuraLogoIcon.tsx), [`AuraLogo.tsx`](../src/components/brand/AuraLogo.tsx). Favicon: [`public/favicon.svg`](../public/favicon.svg).

## Regra de implementação

Usar tokens `ag-*` e variáveis CSS — evitar cores Tailwind hardcoded (`emerald-`, `amber-`, etc.) exceto em mockups fielmente Instagram.
