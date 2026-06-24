# Changelog — ERP Fornada

Todas as mudanças notáveis são registradas aqui.
Formato: `tipo: descrição — detalhes`

---

## [Não lançado]

---

## 2026-06-24 — Auditoria Sênior + Design + RBAC fixes

### Design & UX
- **Login redesenhado** — wordmark "Fornada" em Playfair Display Bold Italic + `#ede9e1` (mesma fonte/cor do logo Flor do Trigo); fundo atmosférico com 3 camadas (halo quente bottom, gradiente frio top, vinheta radial); linha decorativa fade-out; botão com gradiente accent; animações staggered `fade-up` (delays 0/120/260/380ms)
- **Grain texture** no `body` via SVG fractalNoise (3,5%) — textura artesanal coerente com identidade de padaria
- **Nav link ativo** com gradiente lateral quente (16% accent → transparente) + barra left com `box-shadow` glow
- **Card hover** com borda quente accent via `.card-surface:hover`
- **Scrollbar** mais visível (thumb opacity 0,25 → 0,38)
- **Fix autofill browser** — `webkit-box-shadow: inset` força dark background nos inputs auto-preenchidos
- **Fix middleware `proxy.ts`** — `/images/` e extensões de imagem (png/jpg/svg/gif/webp/ico) excluídas do matcher de autenticação; root cause: `next/image unoptimized` serve URL direta que era interceptada e redirecionada para `/login` quando não havia sessão

### RBAC & Navegação
- **Nova Transferência — ORIGEM vazia** corrigida: `cookie → unidade.empresa_id → todas unidades da empresa` (substituiu join PostgREST `usuario_unidade` que falhava silenciosamente)
- **Tab Resumo** não aparece mais para usuários sem permissão (`canAccess` durante `isLoading` retorna `false`)
- **UnidadeSelector** oculto em `/configuracoes` (página tem seletor de escopo próprio — evitava duplo seletor)
- **`router.replace()` removido** do `unidade-context.tsx` — `refresh()` sozinho é suficiente para reler o cookie nos Server Components; o `replace()` causava double fetch desnecessário

### Segurança — Data Leak entre Tenants
- `transferencias/page.tsx` — query `unidade` sem `empresa_id` retornava unidades de todos os tenants
- `transferencias-tab.tsx` — `SELECT * FROM produto` sem filtro ao abrir drawer de confirmação → agora filtra por `.in('id', prodIds)`
- `insumos/page.tsx` — `insumo_preco` e `receita_item` sem filtro → reestruturado em 2 fases (IDs → dependentes com `.in()`)
- `dashboard/page.tsx` — `vw_insumo_custo_atual`, `receita_item`, `produto_preco`, `vw_custo_receita` sem filtro → reestruturado em 2 fases

### Estabilidade — `.single()` → `.maybeSingle()`
`.single()` lança exceção quando retorna 0 linhas; todos os usos problemáticos convertidos:
- `receber/page.tsx` — `usuario_empresa`
- `permissoes.ts` (criar usuário) — `usuario_empresa` dentro de try/catch causava rollback indevido do usuário recém-criado
- `transferencia.ts` — 4 instâncias em `cancelar`, `excluir` e `confirmar recebimento`
- `receitas/actions.ts` — `getEmpresaId()`
- `insumos/actions.ts` — `getEmpresaId()`
- `receitas/[id]/page.tsx` — `vw_custo_receita` (crash se receita sem custo calculado)

### Permissões
- `permissions-context.tsx` — `canAccess()` retornava `true` durante `isLoading`; se o fetch falhasse silenciosamente, acesso ficava liberado permanentemente → corrigido para `false`

### Resiliência
- `dashboard/layout.tsx` — `getUnidadesDoUsuario()` sem try/catch; falha de query derrubava o layout inteiro → envolvido em try/catch com retorno `[]`

### Design System / Contraste
- `status-badge.tsx` — `text-emerald-700`/`text-amber-700` têm ~3:1 contraste no dark (abaixo do WCAG AA) → substituídos por tokens `text-success`/`text-warning`/`bg-success`/`bg-warning`
- `globals.css` — `--t-nav-bg` e `--t-nav-border` estavam referenciados em `.app-nav` mas não definidos no `:root`

### Acessibilidade
- `sidebar.tsx` — botão "Sair →" recebe `aria-label="Sair do sistema"`
- `nova-transferencia-form.tsx` — botões X (fechar modal, remover item) recebem `aria-label`; ESLint disable de regra inexistente removido
- `transferencia-table.tsx` — `key={i}` em cabeçalhos estáticos → `key={h}`; botão Excluir recebe `aria-label` descritivo

---

## 2026-06-19 — FASE 5: RBAC & Limpeza

**feat: RBAC completo — permissoes, server actions, UI de gerenciamento, Admin Global vs Personalizado**

45 arquivos modificados, 1605 inserções, 661 deleções.

### Banco de dados
- `supabase/migrations/20260619000000_rbac_permissoes.sql` — tabela `permissao` (usuario_id, tela, acesso, unidade_id), constraint UNIQUE, RLS básico
- `supabase/migrations/20260619010000_fix_permissao_rls.sql` — `fn_is_global_admin(uuid)` SECURITY DEFINER para resolver loop infinito 42P17 do RLS; seeds admin para todos os usuários existentes
- `supabase/migrations/20260617150000_baseline.sql` — placeholder vazio para sincronizar histórico de migrations com o remote
- `supabase/migrations/20260618120000_transferencia_unidades.sql` — renomeado de `20260618_transferencia_unidades.sql` (nome não-padrão)

### Infraestrutura
- `lib/supabase/admin.ts` — client Supabase com service_role key; sem auto-refresh, sem persistência de sessão; uso restrito a server actions
- `.env.local` — `SUPABASE_SERVICE_ROLE_KEY` adicionada (não versionada)

### Server Actions (`app/actions/permissoes.ts`)
- `getUserPermissionsAction` — lê as próprias permissões (client anon, RLS SELECT = próprio usuário)
- `savePermissionsAction` — upsert via admin client (bypassa RLS na escrita)
- `deletePermissionAction` — delete pontual via admin client
- `createUserAction(email, password, nome, permissaoInicial)` — cria usuário via `auth.admin.createUser`, vincula à empresa, insere permissões; rollback com `deleteUser` se falhar
- `disableUserAction` — remove todas as permissões do usuário (não exclui `auth.users`); bloqueia auto-desabilitar
- `resetPasswordAction` — redefine senha via `auth.admin.updateUserById`
- `listUsersWithPermissionsAction` — lista `auth.users` da empresa com permissões agregadas via admin client

### Contexto de permissões
- `app/context/permissions-context.tsx` — `PermissionsProvider` com `reload()` via tick counter (sem setState direto em useEffect); `canAccess()` com fallback: mapa vazio = acesso total; `usePermission(tela)` hook

### UI — Tela de Configurações
- `app/dashboard/configuracoes/components/permissoes-tab.tsx` — reescrito como máquina de estados (`lista | editar | novo | reset | desabilitar`)
  - **Lista**: tabela de usuários com badges (Admin Global / N telas / Desabilitado), ações por linha (editar, resetar senha, desabilitar)
  - **Editar**: grade tela-a-tela com quatro níveis (Sem acesso / Leitura / Escrita / Admin), salva via server actions
  - **Novo**: formulário Nome/Email/Senha + seção "Permissões Iniciais" (Admin Global ou grade personalizada inline)
  - **Reset**: campo de nova senha com confirmação
  - **Desabilitar**: tela de confirmação com aviso claro

### Separação Cadastros / Configurações
- `app/dashboard/cadastros/page.tsx` + `app/dashboard/cadastros/components/cadastros-panel.tsx` — novo módulo com abas Tipos / Unidades / Categorias (extraído do antigo `config-panel.tsx`)
- `app/dashboard/configuracoes/page.tsx` — simplificado: apenas Permissões
- `app/dashboard/configuracoes/components/config-panel.tsx` — **deletado** (substituído por `cadastros-panel.tsx`)

### Lógica de permissões
- `app/lib/permissions.ts` — `TELAS[]`, `TELA_LABEL`, `PermissaoMap`, `getAcesso()`, `isGlobalAdmin()`; `cadastros` adicionado

### Sidebar
- `app/components/sidebar.tsx` — 10 itens: Resumo, Fichas, Insumos, Preços, Painel, **Cadastros**, Simulador, Transferências, Receber, **Configurações** (ícone Shield)

### Limpeza de lint (0 erros, 0 warnings)
- `app/context/theme-provider.tsx` — `setState` em `useEffect` → lazy initializer `useState(readStoredTheme)`
- `app/context/unidade-context.tsx` — `useState` + `useEffect` substituídos por derivação direta de `searchParams`
- `app/dashboard/receitas/components/ficha-view.tsx` — `Date.now()` em handler → `useRef` counter
- `app/dashboard/insumos/components/insumo-list.tsx` — idem
- `app/dashboard/receitas/components/receita-list.tsx` — idem
- Múltiplos arquivos — tipos `any` substituídos por tipos explícitos; imports não-usados removidos
- `app/components/header.tsx`, `app/components/navigation.tsx` — **deletados** (código morto sem importadores)

---

## 2026-06-18 — FASE 4: Transferências entre Unidades

**feat(transferencia): módulo completo de transferência entre unidades**

- Módulo completo: nova transferência, lista, detalhe `[id]`, drawer de conferência, skeleton, badges de status
- `app/dashboard/transferencias/receber/` — recebimentos pendentes com abas Conferência / Compras
- Server Actions em `app/actions/transferencia.ts`
- Migrations de schema: `usuario_unidade`, `unidade_id_rls`, `transferencia_financeiro`, `compra`, `views_custo`

---

## 2026-06-17 — FASE 3: Dark Theme + Tokens

**feat: reforma visual V2/V3 — tema escuro unificado, toggle de tema, UnidadeSelector**

- Dark theme com tokens Tailwind v4 (`@theme` em `globals.css`)
- `bg-canvas`, `bg-surface`, `bg-input`, `border-subtle`, `text-primary`, `text-secondary`, `accent-primary`, `accent-ink`
- Contraste do accent corrigido para WCAG AA (6,57:1)
- `UnidadeSelector` na dashboard shell
- Toggle "Creme Clássico/Quente" (depois removido como no-op)

---

## 2026-06-16 — FASE 2: Funcionalidade Core

**feat: fichas técnicas, insumos, preços, parsing decimal BR**

- `lib/format.ts`: `parseDecimalBR` corrigida (bug `"10.00"` → `1000`), `formatBRL`, `formatCustoUso`
- `lib/format.test.ts`: 26 testes Vitest
- Fichas técnicas com modais de receita e item
- Insumos com histórico de preço e preview de custo
- Tela de Preços com margem/prejuízo semânticos

---

## 2026-06-15 — FASE 1: Bootstrap

**feat: setup inicial — Next.js 16 + Supabase + autenticação**

- Next.js 16 App Router, TypeScript strict, Tailwind v4, Supabase
- Login / logout com `proxy.ts` middleware
- Dashboard shell com sidebar e navegação
- Tela Resumo com KPIs e curva ABC
