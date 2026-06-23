# ERP Fornada — Plano de Desenvolvimento

## ▶ Ponto de retomada (atualizado 24/06/2026)

**Status:** todo o trabalho está **commitado** na `master` (auditoria → correções → RBAC granular → docs → migrations). **Nada foi aplicado no banco** — o sistema no ar está intacto. Não há remote git configurado (tudo local).

**⛔ ATENÇÃO — diagnóstico de banco INVÁLIDO (precisa refazer).** Os comandos de verificação de 24/06 foram rodados, por engano, no **banco errado (`sac_agrindus`)**, não no do Fornada/Flor do Trigo. **Todas as conclusões sobre "o banco real" estão suspensas** — RLS `p_emp`/`app_user_empresas()`, views `vw_custo_receita`/`vw_produto_financeiro` "ausentes", `vw_markup_linha`/etc. eram do sac_agrindus. **Nada foi aplicado em banco nenhum** (só leitura) — sem dano. A parte de **código** (correções, RBAC, docs) segue válida. Ver memória `estado_banco_fornada` e `CORRECOES_FORNADA.md` §B.

**Próximos passos (com calma, um de cada vez — pedido do dono):**
0. **Refazer o diagnóstico no banco CERTO** (Fornada). Confirmar a identidade primeiro: `select current_database();` e `select slug, nome from public.empresa;` (deve listar `flor-do-trigo`). Só então rodar `pg_policies` / `information_schema` / `pg_get_viewdef` e refazer as conclusões.
1. Com o diagnóstico **real do Fornada**: revisar/corrigir as migrations `20260624*` (os nomes de políticas/colunas podem ser outros) antes de qualquer "faxina de RLS".
2. **Criar/validar as views** que faltarem no Fornada (`vw_custo_receita` numa def que o Postgres aceite, `vw_produto_financeiro`) conforme o diagnóstico real.
3. **Publicar o código novo** (Painel/Produtos/RBAC por unidade) e **testar a Priscila** (perfil só "Receber" na Centro).

Nada disso é urgente — o que está no ar funciona.

---

## 🏗 Stack
- Next.js 16 (App Router) + React 19 + TypeScript (strict) + **Tailwind CSS v4** + Supabase (PostgreSQL)
- Build: `npm run build` (exit 0). Testes: `npm test` (Vitest — `lib/format.test.ts`, 26 testes passando).

## 🎨 Dark Theme Unificado

O sistema usa **exclusivamente tema escuro**. Não há tema claro, paleta creme, fundo branco (#ffffff) ou toggle de tema.

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

## ✅ O que foi implementado

### Tema e Visual
- [x] Dark theme unificado WCAG AA — tokens `--t-*`, `@theme`, `.card-surface`, sem paleta clara
- [x] Sidebar / NavLink / Login — tokens; toggle de tema removido
- [x] Modais e diálogos — todos com fundo escuro `bg-surface`
- [x] Contraste do accent corrigido para WCAG AA + token `bg-canvas` para o fundo de página

### Schema e Banco
> ⚠️ **Esta lista reflete a INTENÇÃO do repositório.** O estado real do banco do Fornada **ainda não foi verificado** (o diagnóstico de 24/06 foi feito no banco errado, `sac_agrindus` — ver "Ponto de retomada"). Verificar com `pg_policies`/`pg_get_viewdef` **no projeto Fornada** antes de agir.
- [x] Schema central versionado em migrations (todas as tabelas, índices, RLS)
- [x] Multi-empresa: `empresa`, `usuario_empresa`, UnidadeSelector funcional
- [x] RBAC completo (FASE 5): tabela `permissao`, `fn_is_global_admin`, `PermissionsContext`
- [x] `fn_get_empresas_usuario()` Security Definer — usado nas políticas RLS
- [x] `vw_produto_financeiro` com `security_invoker = true`
- [x] `despesa_fixa_empresa` — CRUD atômico com RLS
- [x] `insumo_saldo` + `insumo_saldo_historico` — tabelas de estoque
- [x] `confirmar_recebimento(UUID, UUID, JSONB)` — RPC atômica, `FOR UPDATE`, sem dependência em `produto.insumo_id`
- [x] Todos os objetos migrados de `fornada.*` para `public.*` — `.schema('fornada')` removido de todo o código
- [x] `usuario_unidade` em `public` populado via migration 009 para todos os usuários existentes
- [x] `fn_gerar_codigo_transferencia` com `SECURITY DEFINER` — resolve `permission denied` nas sequences
- [x] Constraint `ck_transferencia_status` inclui `CANCELADA`

### Sessão 4 — Transação Atômica + UnidadeSelector

- [x] Migration `20260620000007_confirmar_recebimento_atomico` — RPC com `FOR UPDATE`, loop JSONB, `insumo_saldo` upsert, `insumo_saldo_historico` imutável
- [x] Dark theme unificado com tokens `--t-*` e `@theme` em `globals.css`
- [x] `UnidadeSelector` funcional via cookie `unidade_preferida` — `setUnidadeCookieAction` + `router.refresh()`
- [x] `EmpresaSwitcher` + `UnidadeSelector` coexistindo no `DashboardShell` (acima do `{children}`)
- [x] `UnidadeProvider` no `DashboardLayout` — alimentado por `usuario_unidade` server-side
- [x] Curva ABC com tooltip explicando limitação da estimativa (FASE 3)
- [x] Comentário `is_pendente` com convenção + TODO FASE 3

### Sessão 5 — Schema + Transferências + Botões

- [x] Migration `20260620000008_mover_fornada_para_public` — recreate idempotente de todas as tabelas/funções do schema `fornada` em `public`
- [x] Migration `20260620000009_popular_usuario_unidade` — INSERT de todos os vínculos empresa→unidade para usuários existentes
- [x] Migration `20260620000010_fn_gerar_codigo_security_definer` — `SECURITY DEFINER` + `GRANT USAGE ON ALL SEQUENCES`
- [x] Migration `20260620000011_cancelar_excluir_transferencia` — adiciona `CANCELADA` ao `CHECK` constraint
- [x] Migration `20260620000012_fix_constraint_cancelada_rpc` — recria RPC sem `p.insumo_id`, idem constraint (idempotente)
- [x] Página de detalhe de transferência convertida para **Server Component** — `Promise.all` server-side, sem race condition de RLS
- [x] `AcoesTransferencia` Client Component — botões Confirmar / Cancelar / Excluir com modais inline
- [x] `cancelarTransferenciaAction` + `excluirTransferenciaAction` em `app/actions/transferencia.ts`
- [x] Tab "Canceladas" na listagem; ícone de lixeira por linha para `PENDENTE|CANCELADA`
- [x] Toggle "Ocultar/Mostrar preço" no form de nova transferência — persiste em cookie `show_price_transfer`
- [x] Botão "Confirmar" inline na tela Receber — busca itens via Supabase client e abre `ConfirmacaoDrawer`
- [x] `ConfirmacaoDrawer` convertido de slide-right para **modal centralizado** (`max-w-[580px] max-h-[90vh]`)
- [x] Default da rota: `ordem created_at` no banco (Morada do Sol primeiro); lazy initializer `useState(() => ...)` evita hydration mismatch

### Sessão 6 — Auditoria v2 + RBAC granular (21/06)
> Relatório: `AUDITORIA_FORNADA_v2.md` · Acompanhamento detalhado: `CORRECOES_FORNADA.md`
- [x] **Parser monetário unificado** — `parseDecimalBR` + `inputMode="decimal"` em todos os inputs de R$ (PrecoCell, Lote, Precificadora, Meta, Novo Produto); fim do `parseFloat(replace)` que quebrava com separador de milhar
- [x] **`unidade_id` ao criar ficha/insumo** — `createReceita`/`createInsumo` herdam a unidade preferida (helper `getUnidadeEscrita`); fim dos registros órfãos que sumiam sob o filtro por unidade
- [x] **"Faturamento Estimado" → "Valor do Portfólio"** — rótulo e campo `valor_portfolio` (deixa claro que NÃO é faturamento real)
- [x] **Precificadora em lote** — usa `savePrecoVendaLote` (1 chamada em vez de N)
- [x] **Token `--t-warning`** (atenção) + remoção de `console.log` de debug; `eslint` zerado (era 1 erro)
- [x] **RBAC vira barreira real (server-side):** helper `temAcesso(userId, telas, {unidadeId, nivel})` em `app/lib/authz.ts`, aplicado nas actions de escrita — insumos, fichas (criar/editar/excluir/itens), preços/produtos/despesas, config, criar transferência (por unidade de origem) e confirmar recebimento (por unidade de destino). Admin global sempre passa.
- [x] **RBAC: permissão por módulo + unidade na UI** — seletor de **Escopo** (unidade) ao editar e ao criar usuário; grava `permissao.unidade_id`; `getUnidadesGerenciaveis` lista as unidades da empresa. Ex.: criar usuária só com "Receber" na Centro.

### Painel Financeiro (completo)
- [x] KPIs: total produtos, com/sem preço, margem média + ponderada, faturamento estimado
- [x] Gráficos SVG: distribuição de margem por faixa + top produtos por faturamento
- [x] Tabela de produtos com filtros, ordenação, busca
- [x] Precificadora por produto (modal inline)
- [x] Meta de faturamento (portfólio estimado)
- [x] Despesas fixas — CRUD colapsável, totalizador
- [x] Ponto de equilíbrio — fórmula `despesas / (margem% / 100)`, indicador ▲/▼
- [x] Alertas inteligentes — equilíbrio vs portfólio, margem negativa, sem preço, diferença entre unidades
- [x] Margem ponderada pelo portfólio: `SOMA((pv−ct)×pv) / SOMA(pv)`

### Simulador de Preço (completo, 100% em memória)
- [x] Ajuste individual por produto (campo % por linha, cálculo em tempo real)
- [x] Ajuste uniforme (painel de controles global)
- [x] Resumo: 4 cards — total atual, total simulado, diferença R$+%, margem antes→depois
- [x] Gráficos SVG: comparativo de preços + impacto na margem
- [x] Tabela: ordenação, busca, paginação (20/página)
- [x] **Nunca persiste dados** — `AjustesMap` é estado React volátil

### Transferências entre Unidades
- [x] Fluxo completo: Nova → EM_TRANSITO → Confirmar recebimento → RECEBIDO / RECEBIDO_COM_DIVERGENCIA
- [x] Cancelar (PENDENTE|EM_TRANSITO → CANCELADA) + Excluir (PENDENTE|CANCELADA)
- [x] Confirmação atômica via RPC — nenhum item é salvo se qualquer um falhar
- [x] Saldo de insumo atualizado na unidade de destino (`insumo_saldo` upsert)
- [x] Histórico imutável de movimentações (`insumo_saldo_historico`)
- [x] Preço auto-preenchido ao selecionar produto (query `produto_preco` via Supabase client)
- [x] Input de preço estilo centavos (só dígitos, divide por 100, sem letras)
- [x] Origem/destino pré-preenchidos: RPC vínculo fixo → cookie `unidade_preferida` → `todasUnidades[0]`
- [x] `podeConferir` calculado server-side; fallback permissivo se `usuario_unidade` vazio

### Outras Funcionalidades
- [x] Fichas técnicas (lista, ficha, modais de receita e de item)
- [x] Insumos (lista e modal — preço, histórico, preview)
- [x] Preços (margem/prejuízo com cores semânticas)
- [x] `parseDecimalBR` corrigido (26 testes) — convenção BR, tolerante a ruído

## 🚧 Pendências reais

### Migrations pendentes de aplicação manual no Supabase
> Estas migrations estão no repositório mas **ainda precisam ser rodadas** no SQL Editor do Supabase:
- [ ] `20260620000011_cancelar_excluir_transferencia.sql` — constraint `CANCELADA` + `GRANT USAGE ON SEQUENCES`
- [ ] `20260620000012_fix_constraint_cancelada_rpc.sql` — recria `confirmar_recebimento` sem `p.insumo_id`, idem constraint

### UnidadeSelector nas telas de Transferência
- [ ] A tela `/dashboard/transferencias` (listagem) não filtra por unidade selecionada — mostra todas da empresa
- [ ] A tela `/dashboard/transferencias/receber` usa `usuario_unidade` diretamente mas ignora o cookie `unidade_preferida`
- [ ] Decisão de produto: filtrar transferências pelo `UnidadeSelector` ou sempre mostrar todas?

### FASE 3 — Estoque Simplificado
- [ ] Entradas manuais de estoque por unidade
- [ ] Baixa automática pelas fichas técnicas
- [ ] Relatório de consumo
- [ ] Curva ABC ponderada por volume real de venda (hoje usa estimativa custo × quantidade nas fichas)

### Configurações persistentes
- [x] **Cadastros** — tipos/unidades/categorias persistem em `config_geral` (por empresa) via `getConfigAction`/`saveConfigAction`.

### Fluxo NFe
- [ ] **"Receber"** deve virar entrada de **NFe de fornecedor** (que alimenta custo) ou seguir só como conferência de transferência interna? (decisão de produto pendente)

### Limpeza técnica remanescente
- [ ] **Paleta clara do `@theme`** (`marrom-*`, `creme-*`, `madrugada-*`, `croissant`, `demerara`) — agora sem uso; pode ser removida para enxugar o CSS.
- [ ] **ThemeProvider** (`app/context/theme-provider.tsx`) e o bloco `html.creme-quente` — inertes após remoção do toggle.
- [ ] Skeleton/error states no núcleo (loading boundaries, Suspense com fallback visual).
- [ ] Tabular-nums nas colunas de R$ em todas as tabelas.

### Decisões de produto — respondidas (21/06)
- [x] **Isolamento = RBAC granular** por módulo + empresa/unidade (ex.: admin total vs. "só Receber na Centro"). Implementado: seletor de escopo na UI + `temAcesso` server-side.
- [x] **Quem confirma recebimento:** via RBAC (escrita em `receber`/`transferencias` na unidade de destino); admin global sempre.
- [x] **Margem:** sobre o preço de venda (`(pv−ct)/pv`); markup (`(pv−ct)/ct`) é visão auxiliar.
- [x] **"Receber"** segue como Compra simples (fornecedor + valor) por ora; pipeline NFe→custo é roadmap.
- [ ] **Resumo/Painel** devem respeitar também a **empresa** selecionada? (hoje filtram por unidade via cookie; empresa só via RLS) — ainda em aberto

### Pendências de banco — auditoria v2 (⚠️ REVERIFICAR — diagnóstico foi no banco errado)
> As migrations `20260624*` foram ajustadas para um diagnóstico que, descobriu-se, foi feito no banco **errado (`sac_agrindus`)**. **NÃO aplicar.** Primeiro refazer o diagnóstico no banco do Fornada (ver "Ponto de retomada") e então corrigir/validar as migrations. Detalhes em `CORRECOES_FORNADA.md` §B.
- [ ] **Refazer diagnóstico no banco do Fornada** (políticas, colunas, views) — confirmar identidade (`empresa.slug = 'flor-do-trigo'`) antes
- [ ] Revisar `20260624000001_consolidar_rls_por_empresa.sql` com os **nomes reais** das políticas do Fornada
- [ ] Revisar `20260624000000_correcoes_auditoria_v2.sql` com as **colunas reais**
- [ ] Verificar se `vw_custo_receita` / `vw_produto_financeiro` existem no Fornada; criar/corrigir conforme necessário
- [ ] Confirmar se a tabela `permissao` tem `unidade_id` — base do RBAC por unidade

## 🔧 TypeScript
- Strict mode ativo; `tsc --noEmit` sem erros.
- `getUserUnidadeAction` retorna discriminated union (`{ success: true; unidade } | { success: false; error }`).
- Sem `any` — todos os retornos de Supabase tipados via `as`.

## 📋 Observações
- Paleta no bloco `@theme` de `app/globals.css` (**não** em `tailwind.config.ts`, que não existe). Usar tokens, **nunca** cor inline `bg-[#...]`.
- Rodar `npm run build` após cada sessão e parar se houver erro; rodar `npm test` ao mexer em cálculo/parsing.
- NÃO quebrar lógica de negócio (APIs, hooks, mutations, queries Supabase).
- NÃO modificar tipos compartilhados sem verificar dependências.
- `lib/supabase/admin.ts` usa `SUPABASE_SERVICE_ROLE_KEY` — **nunca expor no client**; usar apenas em server actions.
- Simulador **nunca persiste** — cálculo 100% em memória React.
