# ERP Fornada — Plano de Desenvolvimento

## ▶ Ponto de retomada (atualizado 29/06/2026)

**Sessão 29/06 — Review visual completo + demo + polimentos (3 commits):**
- ✅ **Tour por todas as 11 telas** rodando local (preview): sistema sólido, coeso e estável (zero erros de console). Veredito: pronto pra apresentar.
- ✅ **Fix card "Em breve"** do Resumo → mostra contagem de produtos precificados (commit 2ddfd34).
- ✅ **Polimentos**: 5 `loading.tsx` (skeletons) + `tabular-nums` nas tabelas de R$ (commit b8a6260).
- ✅ **Ilha de demonstração** no banco (Bolo de Cenoura + Brownie + Pão Doce + Cookie, todos "(demo)") — 5 produtos precificados, Painel 100% vivo (KPIs, gráficos, alerta de prejuízo). **Remover com `node _demo_cleanup.mjs`.** Ver memória [[dados-e-demo-fornada]].
- 🔎 **Achado importante p/ Natali:** as 129 fichas importadas têm **quantidades/unidades furadas** (300 ovos num omelete) e nomes duplicados — precisam de limpeza antes de precificar de verdade. `insumo_preco` estava 100% vazio.
- ✅ **Teste de isolamento RBAC — FEITO e APROVADO:** criados 2 usuários QA (`qa.centro@` / `qa.morada@flordotrigo.app`, senha `Teste@2026`, removíveis com `node _demo_cleanup.mjs`). Validado: nav filtra por permissão; centro vê 0 insumos / morada vê 229 (RLS por loja isola 100%); escrita cruzada bloqueada por `temAcesso`.
- ✅ **Gap de segurança corrigido (commit do guard):** acesso via URL direta a telas não concedidas agora é barrado no `proxy.ts` (mapa rota→tela + redirect; admin `*` passa). Antes só o menu escondia. Dados/escrita já estavam protegidos por RLS/temAcesso — era exposição de visualização do módulo.
- ✅ **Drill-down por clique** (drawers de produto + KPIs) — commit c54647a.
- ✅ **Precificação de insumos em lote** (`/dashboard/insumos/precificar`) — grade editável com preview de custo ao vivo e `addPrecosLote`. Desbloqueia a entrada dos 229 preços. Validado end-to-end.
- 🔲 **Pendente:** preparação de deploy (decidido: preparar, deploy depois). Antes: remover ilha-demo + usuários QA do banco (`node _demo_cleanup.mjs`), ligar monitoramento/erros, confirmar backup do Supabase.

---

## ▶ Retomada anterior (26/06/2026)

**Status:** todo o trabalho está **commitado** na `master`. Não há remote git configurado (tudo local). **Todas as migrations pendentes foram aplicadas ao banco em 26/06.** Build de produção, `tsc` e 52 testes ✅ limpos.

**Sessão 26/06 (tarde) — Bugs pós-teste + Auditoria de segurança (8 commits, detalhes no CHANGELOG):**
- ✅ 6 bugs de teste de usuários: loop login desabilitado, Resumo sempre visível (movido p/ `/dashboard/resumo`; `/dashboard` virou landing), Admin Global não restringia config, dados cruzados entre lojas (`syncUsuarioUnidade` bidirecional), transferência/produto sumindo no Receber, Configurações inacessível para admin de config
- ✅ **Auditoria de segurança — achados #1, #2, #3, #5, #6, #7 fechados:**
  - **#1** `getUnidadeAutorizada()` valida cookie de loja contra `usuario_unidade` (fecha vazamento intra-tenant nas páginas com `supabaseAdmin`)
  - **#2** granularidade módulo×loja na escrita (`temAcesso({ unidadeId })` + helper `unidadeDoRegistro`)
  - **#3** migrations `20260624*` (RLS por empresa) arquivadas em `_descartadas/`
  - **#5** núcleo de autorização testável `authz-core.ts` + 26 testes (suíte 26→52)
  - **#6** `error.tsx` + `not-found.tsx`; **#7** tela `produtos` virou permissão real
- ⏸️ **#4 ADIADO (decisão de produto):** isolamento de estoque/compras/despesas/config — hoje por empresa, não por loja. Retomar quando decidir se essas tabelas são por loja ou por empresa.
- 🔲 **Pendente de teste real:** validar com logins Centro/Morada que (a) cada um vê só os recebimentos da própria loja e (b) usuário com módulo só numa loja não escreve na outra.

**Últimas sessões concluídas (25/06):**
- ✅ **Módulo Transferências — sessão completa (4 commits, 92a2738 → 72884b2):**
  - Formulário sem preço: operadores informam só produto + quantidade (un); preço auto-buscado server-side
  - RBAC financeiro: valor total e preços só visíveis para admin (`temAcesso transferencias/admin`)
  - Lista de recebimento: nomes dos produtos inline, valor total oculto para não-admin
  - Drawer de confirmação: UX compacto — itens default "Recebido", expande só ao clicar "Divergência"
  - Auto-detecção de status por qtd: diferente → DIFERENÇA, zero → AUSENTE, igual → RECEBIDO (colapsa)
  - Origem carregada via `usuario_unidade` + `usuario_empresa` (mais robusto)
  - `isCentro` substituído por coluna `is_pagadora BOOLEAN` na tabela `unidade` (migration `20260626000002`)
  - Listagem filtra por unidade selecionada via `.or(origem.eq.X,destino.eq.X)`
  - Paleta legada removida do CSS (`marrom-*`, `creme-*`, `madrugada-*`, `croissant`, `demerara`) — −95 linhas
  - `ThemeProvider` e `html.creme-quente` removidos (código inerte, toggle já tinha sido removido)

**Sessões anteriores concluídas (24/06):**
- ✅ Design da tela de login reformulado (wordmark Fornada em Playfair italic + cor creme `#ede9e1`, halo atmosférico, animações staggered)
- ✅ Refinamentos visuais globais: textura de grão, nav ativo gradiente quente, card hover borda accent, scrollbar mais visível
- ✅ Fix middleware `proxy.ts` — exclui `/images/` do matcher de auth (logo sumia no login)
- ✅ RBAC: origem vazia em Nova Transferência corrigida (usa cookie → unidade → empresa_id)
- ✅ RBAC: aba Resumo não aparece mais para usuários sem permissão
- ✅ UnidadeSelector oculto em `/configuracoes` (evitava seletor duplicado)
- ✅ **Auditoria sênior completa — 18 correções em 4 commits** (ver seção abaixo)

**✅ Banco confirmado (25/06): é o Fornada** (slug `flor-do-trigo`). O "susto do sac_agrindus" foi alarme falso. Diagnóstico real:
- O **Painel aparece vazio** porque faltam `vw_custo_receita` e `vw_produto_financeiro` no banco → criada a migration `20260625000000_views_custo_fornada.sql`.
- Tabelas `linha`/`parametro_financeiro`/`despesa`/`vw_markup_linha` são de uma versão **antiga, não usada** por este app.

**Próximos passos (um de cada vez — com calma):**
1. ✅ **FEITO (25/06):** aplicado `20260625000000_views_custo_fornada.sql` → Painel acendeu. `vw_produto_financeiro` tem **1156 produtos**. Obs.: só ~8 produtos têm preço cadastrado e o Painel carrega 1000 de 1156 (limite padrão — paginação é roadmap).
2. ✅ **FEITO (26/06):** migrations de **isolamento por loja** escritas e **APLICADAS**: `cnpj_por_loja`, `rls_por_loja`, `unidade_is_pagadora`.
3. ✅ **FEITO (26/06):** `20260620000011` (constraint CANCELADA + GRANT sequences) e `20260620000012` (RPC `confirmar_recebimento` sem `p.insumo_id`) **APLICADAS**.
4. ✅ **FEITO (26/06):** Fix `teste@agrindus.com.br` — permissões globais (NULL) removidas via SQL.
5. ✅ **FEITO (26/06):** 5 bugs corrigidos pós-teste de usuários (commit f952cd7):
   - Tela preta ao logar desabilitado → redireciona com `?error=desabilitado`, login exibe mensagem
   - Resumo aparecia para todos → removido `FALLBACK_TELAS` do sidebar (Resumo respeita RBAC como as demais)
   - Admin Global não restringia Configurações → grade desabilita telas individuais quando `*=admin` ativo + aviso
   - Dados cruzados entre lojas → `syncUsuarioUnidade` agora remove entradas obsoletas (era só additive) + SQL de limpeza do banco aplicado manualmente
   - Transferência não aparecia no Receber → `receber/page.tsx` usa `supabaseAdmin` para todas as queries (antes usava cliente RLS que podia bloquear)
6. ⬜ Testar com os logins de Centro e Morada para confirmar isolamento correto de dados.
7. ⬜ Conferir margens no Painel; quando Natali zerar/reimportar produtos, cadastrar por loja.
8. ⬜ (futuro) Módulo "contas a pagar/receber" por loja.

> A "faxina de RLS por empresa" (`20260624000001`) está **DESCARTADA** — substituída pela RLS por loja (`20260626000001`). Junto com o backfill opcional `20260624000000`, foi **movida para `supabase/migrations/_descartadas/`** (26/06) para sair do caminho de execução do CLI. Ver README de lá.

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

### Sessão 7 — Design, RBAC fixes + Auditoria Sênior (24/06)
> 4 commits, 18 arquivos corrigidos, build limpo em todos.

#### Design
- [x] **Login redesenhado:** wordmark "Fornada" em Playfair Display Bold Italic + `#ede9e1` (mesma cor/fonte do logo); fundo com 3 camadas (halo quente, gradiente frio, vinheta); linha decorativa fade-out nos lados; botão gradiente accent; animações staggered `fade-up` (0/120/260/380ms)
- [x] **Grain texture** no `body` via SVG fractalNoise (3,5% de opacidade) — reforça identidade de padaria artesanal
- [x] **Nav link ativo** com gradiente lateral quente (16% accent → transparente) + barra left com glow
- [x] **Card hover:** borda quente + glow sutil via `card-surface:hover`
- [x] **Scrollbar** mais visível (0,25 → 0,38 opacidade)
- [x] **Fix autofill do browser:** `webkit-box-shadow` inset força background escuro nos inputs preenchidos automaticamente
- [x] **Fix middleware `proxy.ts`:** `/images/` e extensões de imagem excluídas do matcher de auth (logo sumia no login porque `next/image unoptimized` serve a URL direta que era interceptada e redirecionada para `/login`)

#### RBAC & Navegação
- [x] **Nova Transferência — ORIGEM vazia** corrigida: usa `cookie → unidade.empresa_id → todas as unidades da empresa` (sem depender de join `usuario_unidade` que falhava silenciosamente via PostgREST)
- [x] **Resumo sem permissão** não aparece mais (fix na lógica de filtro do sidebar)
- [x] **UnidadeSelector oculto em `/configuracoes`** — a página já tem seu próprio seletor de escopo (Todas/Centro/Morada), o seletor global causava duplo seletor visível

#### Auditoria Sênior — 18 correções
**SEGURANÇA / DATA LEAK:**
- [x] `transferencias/page.tsx` — query `unidade` sem `empresa_id` retornava unidades de todos os tenants → `.eq('empresa_id', empresaId)`
- [x] `transferencias-tab.tsx` — `SELECT * FROM produto` sem filtro carregava todos os produtos do banco ao abrir drawer → `.in('id', prodIds)` com apenas IDs necessários
- [x] `insumos/page.tsx` — `insumo_preco` e `receita_item` sem filtro algum → reestruturado em 2 fases: primeiro IDs, depois `.in('insumo_id', insumoIds)`
- [x] `dashboard/page.tsx` (Resumo) — `vw_insumo_custo_atual`, `receita_item`, `produto_preco`, `vw_custo_receita` sem filtro → reestruturado em 2 fases (IDs na fase 1, dependentes filtrados na fase 2)

**ESTABILIDADE — `.single()` que lança exceção com 0 linhas:**
- [x] `receber/page.tsx` — `.single()` em `usuario_empresa`
- [x] `permissoes.ts` — `.single()` em `usuario_empresa` dentro de try/catch de criação de usuário (causava rollback indevido)
- [x] `transferencia.ts` — 4× `.single()` em `usuario_empresa` e `transferencia` (cancelar, excluir, confirmar)
- [x] `receitas/actions.ts` — `getEmpresaId()` com `.single()`
- [x] `insumos/actions.ts` — `getEmpresaId()` com `.single()`
- [x] `receitas/[id]/page.tsx` — `.single()` em `vw_custo_receita` (crash se receita sem custo calculado)

**PERMISSÕES:**
- [x] `permissions-context.tsx` — `canAccess()` retornava `true` durante `isLoading`; se o fetch de permissões falhasse silenciosamente, acesso ficava liberado permanentemente → corrigido para `false`

**PERFORMANCE / QUALIDADE:**
- [x] `unidade-context.tsx` — `router.replace(pathname)` + `router.refresh()` causava double fetch ao trocar de unidade → removido `replace`, mantido apenas `refresh()`
- [x] `dashboard/layout.tsx` — `getUnidadesDoUsuario()` sem try/catch; falha derrubava o layout inteiro → envolvido em try/catch → `[]`

**DESIGN SYSTEM / CONTRASTE:**
- [x] `status-badge.tsx` — `text-emerald-700`/`text-amber-700` têm ~3:1 contraste no dark theme (WCAG fail) → tokens `text-success`/`text-warning`

**CSS / TOKENS:**
- [x] `globals.css` — `--t-nav-bg` e `--t-nav-border` referenciados em `.app-nav` mas não definidos no `:root` → adicionados

**ACESSIBILIDADE:**
- [x] `sidebar.tsx` — botão "Sair →" sem `aria-label` → `aria-label="Sair do sistema"`
- [x] `nova-transferencia-form.tsx` — botões X (fechar modal, remover item) sem `aria-label`; comentário ESLint de regra inexistente removido
- [x] `transferencia-table.tsx` — `key={i}` em cabeçalhos estáticos → `key={h}`; botão Excluir recebe `aria-label` descritivo

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
> ✅ **TODAS APLICADAS em 26/06/2026.** Nenhuma migration pendente no momento.

### UnidadeSelector nas telas de Transferência
- [x] ~~A tela `/dashboard/transferencias` (listagem) não filtra por unidade selecionada~~ — **CORRIGIDO (25/06)**
- [x] ~~A tela `/dashboard/transferencias/receber` ignora cookie `unidade_preferida`~~ — já usava `getUnidadePreferida()`

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
- [x] ~~**Paleta clara do `@theme`**~~ — **REMOVIDA (25/06):** `marrom-*`, `creme-*`, `madrugada-*`, `croissant`, `demerara`, `ouro`, `terracota`, `oliva` deletados (−95 linhas).
- [x] ~~**ThemeProvider**~~ — **REMOVIDO (25/06):** arquivo deletado, `html.creme-quente` removido do CSS, layout simplificado.
- [x] ~~Skeleton/error states no núcleo~~ — **FEITO (29/06):** `loading.tsx` adicionado em resumo, precos, produtos, cadastros e configuracoes (já existiam em insumos/painel/receitas/transferencias). `error.tsx` na raiz cobre todas as filhas.
- [x] ~~Tabular-nums nas colunas de R$~~ — **FEITO (29/06):** aplicado em ficha-view, produto-list, precos e receita-list (Painel/transferências/simulador já tinham).

### Decisões de produto — respondidas (21/06)
- [x] **Isolamento = RBAC granular** por módulo + empresa/unidade (ex.: admin total vs. "só Receber na Centro"). Implementado: seletor de escopo na UI + `temAcesso` server-side.
- [x] **Quem confirma recebimento:** via RBAC (escrita em `receber`/`transferencias` na unidade de destino); admin global sempre.
- [x] **Margem:** sobre o preço de venda (`(pv−ct)/pv`); markup (`(pv−ct)/ct`) é visão auxiliar.
- [x] **"Receber"** segue como Compra simples (fornecedor + valor) por ora; pipeline NFe→custo é roadmap.
- [ ] **Resumo/Painel** devem respeitar também a **empresa** selecionada? (hoje filtram por unidade via cookie; empresa só via RLS) — ainda em aberto

### Pendências de banco — auditoria v2 (RESOLVIDO/ARQUIVADO)
> As migrations `20260624*` (geração "por empresa") foram **arquivadas em `supabase/migrations/_descartadas/`** (26/06) — conflitavam com a RLS por loja vigente e nunca foram aplicadas em produção. As demais verificações abaixo já foram confirmadas no banco `flor-do-trigo`:
- [x] Diagnóstico no banco do Fornada confirmado (identidade `empresa.slug = 'flor-do-trigo'`)
- [x] `vw_custo_receita` / `vw_produto_financeiro` criadas (`20260625000000_views_custo_fornada.sql`)
- [x] `permissao.unidade_id` existe — base do RBAC por unidade

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
