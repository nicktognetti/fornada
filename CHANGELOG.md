# Changelog — ERP Fornada

Todas as mudanças notáveis são registradas aqui.
Formato: `tipo: descrição — detalhes`

---

## [Não lançado]

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
