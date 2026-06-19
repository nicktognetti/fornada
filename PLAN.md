# ERP Fornada — Plano de Desenvolvimento

## 🏗 Stack
- Next.js 16 (App Router) + React 19 + TypeScript (strict) + **Tailwind CSS v4** + Supabase (PostgreSQL)
- Build: `npm run build` (exit 0). Testes: `npm test` (Vitest — `lib/format.test.ts`, 26 testes passando).

## 🎨 Reforma Visual — Dark Theme Unificado

### Onde vivem os tokens
**Tailwind v4 não usa `tailwind.config.ts`** (esse arquivo não existe). A paleta é declarada no bloco
`@theme` de `app/globals.css`, que gera os utilitários (`bg-surface`, `text-primary`, `border-subtle`…).
Há também variáveis semânticas `--t-*` (no `:root` do mesmo arquivo) que dirigem as classes de componente
`.card-surface` / `.btn-primary` / `.btn-ghost` / `.input-field` / `.field-label`.

### Paleta de Cores (tokens no `@theme` de `app/globals.css`)
| Token | Hex | Uso |
|-------|-----|-----|
| `bg-canvas` | #1a1a1a | Fundo de página (DashboardShell, sidebar) — token próprio, evita a colisão `bg-primary`/`text-primary` do Tailwind v4 |
| `bg-surface` | #222226 | Cards, containers, modais, painéis |
| `bg-surface-2` | #1e1e22 | Zebra de tabela / superfície secundária |
| `bg-input` | #2a2a2e | Inputs, textareas, hovers (`border-input`) |
| `bg-neutral-tint` | #2a2a2a | Chip neutro (Pendente / Devolução) |
| `border-subtle` | #333336 | Divisores, bordas de card/input |
| `text-primary` | #f5f5f0 | Títulos, dados, KPIs |
| `text-secondary` | #888888 | Subtítulos, labels, placeholders |
| `text-ink-soft` | #d4d4d0 | Texto de itens/valores em destaque secundário |
| `text-faint` | #666666 | Placeholders e ícones apagados |
| `accent-primary` | **#d98d5f** | Botões, destaques, toggles ativos, progress bars, item de menu ativo |
| `accent-hover` | #e8a57a | Hover de elementos accent |
| `accent-ink` | #1a1a1a | **Texto escuro SOBRE o accent** (contraste 6,57:1 — passa WCAG AA) |
| `accent-tint` / `accent-tint-hover` | #2a2a1e / #333320 | Fundo de chips/badges de accent |
| `success` / `success-tint` | #5f9a5f / #1e2a1e | Recebido / sucesso |
| `danger` / `danger-tint` | #c74a4a / #2a1e1e | Divergência / erro |

> Cores semânticas pontuais usam a paleta padrão do Tailwind em tons claros p/ fundo escuro
> (`amber-400`, `red-400`, `emerald-400`, `blue-400`).

### Regras de Componentes
- **Botão primário:** `bg accent-primary` (#d98d5f) + **texto escuro `accent-ink`** (#1a1a1a) — NÃO `text-white`
  (branco sobre #d98d5f dá 2,65:1 e reprova AA; texto escuro dá 6,57:1).
- Cards: `bg-surface` (#222226), bordas `border-subtle`, `rounded-lg/xl`, `shadow-lg shadow-black/20`.
- Inputs: `bg-input`, `border-subtle`, focus ring `accent-primary/40`.
- Labels de form: uppercase, `text-xs`, tracking-wider, `text-secondary`.
- Sidebar: `bg-canvas`; item ativo = `bg-input` + barra left `bg-accent-primary`.
- Tabelas: header `text-secondary` uppercase, divisores `border-subtle`, zebra `bg-canvas`/`bg-surface-2`.
- **Sem cor inline (`bg-[#...]`)** — usar sempre os tokens acima.

### Progresso por Tela

#### ✅ CONCLUÍDO (dark theme + tokens, build verde)
- [x] **Resumo** (KPIs, alertas, curva ABC com gradiente tokenizado)
- [x] **Fichas** (lista, ficha técnica/`ficha-view`, modais de receita e de item)
- [x] **Insumos** (lista e modal — preço, histórico, preview)
- [x] **Preços** (margem/prejuízo com cores semânticas)
- [x] **Transferências** (lista/tabela, nova transferência, detalhe `[id]`, drawer de conferência, skeleton, badges de status)
- [x] **Receber** (recebimentos pendentes)
- [x] **Sidebar / NavLink / Login** — tokens; toggle "Creme Clássico/Quente" removido (no-op no dark)
- [x] **Modais e diálogos** — todos com fundo escuro `bg-surface` (antes `bg-white`)
- [x] **Contraste do accent** corrigido para WCAG AA + **token `bg-canvas`** para o fundo de página

#### 💰 Parsing decimal (R$) — CONCLUÍDO
- [x] `parseDecimalBR` (`lib/format.ts`) reescrita: convenção BR (vírgula decimal, ponto milhar), tolerante a
  ruído ("R$", espaços), inválidos → `NaN`. Corrigido o bug que transformava `"10.00"` em `1000`.
- [x] `formatBRL`/`formatCustoUso` tolerantes a `NaN` (`"0,00"`).
- [x] Unificado: Insumos/Preços e Transferências (form + drawer) usam a mesma função; inputs `text` + `inputMode="decimal"`.
- [x] **Testes:** `lib/format.test.ts` (26 casos, incluindo regressão do bug e negativos).

## 🚧 Pendências reais

### Funcionalidade (não é tema — telas dark prontas, mas sem lógica)
- [ ] **Painel Financeiro** — stub "Em configuração" (ponto de equilíbrio, margem média, markup, despesa fixa não implementados).
- [ ] **Simulador** — stub "Em breve" (impacto de alta/baixa de insumo, comparar cenários).
- [ ] **Configurações** — edição só em memória de sessão; **não persiste** (faltam tabelas de configuração no banco).

### Dados por unidade (decisão já tomada, falta implementar)
- [ ] `UnidadeSelector` ainda é **decorativo** (useState local, unidades hardcoded, não filtra nada).
- [ ] Implementar de verdade: `unidade_id` em insumo/preço + RLS por unidade + ligar o seletor a dados reais (mudança de schema/migração).

### Limpeza (rollout de tokens — concluído no que renderiza; resta o inerte)
- [ ] **Código morto:** `app/components/navigation.tsx` e `app/components/header.tsx` (ninguém importa; ainda na paleta clara).
- [ ] **Paleta clara do `@theme`** (`marrom-*`, `creme-*`, `madrugada-*`, `croissant`, `demerara`) — agora sem uso; pode ser removida para enxugar o CSS.
- [ ] **ThemeProvider** (`app/context/theme-provider.tsx`) e o bloco `html.creme-quente` — inertes após remoção do toggle.
- [ ] **Lint:** 17 erros pré-existentes (`@typescript-eslint/no-explicit-any` + `Date.now()` no render em `ficha-view.tsx`).

### Decisões de produto em aberto (confirmar antes de implementar)
- [ ] **Resumo** deve filtrar pela unidade selecionada? (hoje agrega a empresa inteira)
- [ ] **Quem pode confirmar recebimento** de transferência? (hoje: qualquer um da empresa que não seja o criador — restringir à unidade de destino?)
- [ ] **Definição de margem:** sobre o preço de venda (atual) ou markup sobre o custo?
- [ ] **"Receber":** deve virar entrada de **NFe de fornecedor** (que alimenta custo) ou seguir só como conferência de transferência interna?
- Decididas: tema = **escuro**; dados = **por unidade**; Painel/Simulador/Config = **mantidos no menu como "em breve"**.

## 🔧 TypeScript
- Strict mode ativo; `tsc --noEmit` sem erros.
- `getUserUnidadeAction` retorna discriminated union (`{ success: true; unidade } | { success: false; error }`).

## 📋 Observações
- Paleta no bloco `@theme` de `app/globals.css` (**não** em `tailwind.config.ts`, que não existe). Usar tokens, **nunca** cor inline `bg-[#...]`.
- Rodar `npm run build` após cada sessão e parar se houver erro; rodar `npm test` ao mexer em cálculo/parsing.
- NÃO quebrar lógica de negócio (APIs, hooks, mutations, queries Supabase).
- NÃO modificar tipos compartilhados sem verificar dependências.
