# Auditoria Técnica + Produto/UX — Fornada (Flor do Trigo) — **v2**

> Passada **somente leitura**. Nenhum código de aplicação foi alterado. Único arquivo escrito: este relatório.
> Data: 21/06/2026 · Branch: `master` · Último commit: `248844e` (working tree com muitas mudanças não commitadas).
> **Qualidade medida nesta passada:** `next build` ✅ (17 rotas) · `tsc --noEmit` ✅ 0 erros · `vitest` ✅ **26/26** · `eslint` ❌ **1 erro**.
> Toda conclusão cita `arquivo:linha`. Onde não foi possível confirmar contra o banco real, está marcado **[NÃO VERIFICADO no banco]**.

> **Nota de método sobre o banco:** não há `psql`, `DATABASE_URL` nem CLI Supabase linkada neste ambiente, e a restrição de não criar arquivos impede um script de teste. Logo, **não introspectei `pg_policies`/`information_schema`**. As afirmações sobre schema baseiam-se nas **migrations versionadas** (`supabase/migrations/*.sql`, evidência real do repositório). Onde o estado *efetivo* do banco importa (RLS combinada, definição real de view), recomendo rodar `SELECT * FROM pg_policies` e `pg_get_viewdef(...)`.

---

## 1. Visão geral do projeto

ERP enxuto de custo/preço para a padaria Flor do Trigo (unidades **Centro** e **Morada do Sol**), em Next.js 16.2.9 (App Router, Turbopack) + React 19 + TypeScript strict + Tailwind v4 (`@theme` em [globals.css](app/globals.css), sem `tailwind.config.ts`) + Supabase (Postgres/Auth/RLS) + Zod + Vitest.

**Houve um salto de maturidade muito grande desde a auditoria anterior.** As duas auditorias prévias (consolidadas em [AUDITORIA_FORNADA.md](AUDITORIA_FORNADA.md), sessões de 18/06 e 20/06) apontavam: P0 de parsing decimal, cisão visual claro×escuro, seletor de unidade falso, três telas-stub, schema central não versionado, zero testes, e uma série de furos multi-tenant. **A maioria foi resolvida.** Hoje:

- **Tema escuro unificado** via tokens `--t-*` ([globals.css:79-103](app/globals.css)); o accent agora usa **texto escuro** sobre laranja (contraste **6,57:1**, passa WCAG AA).
- **Parser decimal reescrito** e coberto por **26 testes** ([lib/format.ts:19](lib/format.ts), [lib/format.test.ts](lib/format.test.ts)).
- **Simulador, Painel Financeiro e Configurações** deixaram de ser stubs e estão funcionais.
- **Schema central versionado** ([20260620000004_schema_central.sql](supabase/migrations/20260620000004_schema_central.sql), [20260618170000_views_custo.sql](supabase/migrations/20260618170000_views_custo.sql)).
- Módulo **Produto** como entidade de 1ª classe, RPC atômica de recebimento, módulo de **Compras/NFe** (registro manual), RBAC por tela/unidade, multi-empresa com `EmpresaSwitcher`.

**Estado de maturidade:** as 17 rotas compilam e renderizam; o núcleo (Insumos → Fichas → Preços → Painel/Simulador) está coerente e funcional para **single-tenant** (a Flor do Trigo isolada). Os problemas remanescentes são de **maturidade e confiança**: isolamento por **unidade** que o RLS não garante, **reprodutibilidade do banco** frágil, **autorização** ausente na confirmação de recebimento, e **semântica financeira** (faturamento/ponto de equilíbrio) que mistura grandezas.

**Veredicto de deploy:** **OK para a Flor do Trigo** (1 empresa, 2 unidades, usuária dona/confiável). **Cautela antes de multi-tenant real ou de prometer isolamento por unidade**, enquanto os P1 abaixo não forem fechados.

**Score geral (subjetivo): ~7,0/10** (a auditoria anterior havia dado 5,2).

---

## 2. O que já está bom

| # | Ponto forte | Evidência |
|---|---|---|
| ✅ | **Parser decimal correto e testado** — vírgula = decimal, ponto = milhar/decimal heurístico, `NaN` para inválido; 26 testes cobrindo `2.5`, `10.00`, `1.234,56`, vazio, negativo etc. | [lib/format.ts:19-51](lib/format.ts), [lib/format.test.ts](lib/format.test.ts) |
| ✅ | **Contraste do botão primário resolvido** — `accent-ink #1a1a1a` sobre accent `#d98d5f` = **6,57:1** (era 2,65 com branco) | [globals.css:65](app/globals.css), [globals.css:203](app/globals.css) |
| ✅ | **Tema escuro unificado** — `:root` define tokens escuros; Transferências, Login e núcleo usam os mesmos `--t-*`/utilitários | [globals.css:79-103](app/globals.css) |
| ✅ | **Tokens semânticos** de sucesso/erro e `bg-canvas` (resolve a colisão `bg-primary`) | [globals.css:51-69](app/globals.css) |
| ✅ | **Confirmação de recebimento atômica** — RPC `confirmar_recebimento` faz item+saldo+histórico+status em **uma transação** com `FOR UPDATE` | [20260620000007_confirmar_recebimento_atomico.sql:78-182](supabase/migrations/20260620000007_confirmar_recebimento_atomico.sql) |
| ✅ | **Detecção de ciclo (BFS)** em sub-receitas, em `addItem` **e** `updateItem`, + bloqueio de auto-referência | [receitas/actions.ts:144-169](app/dashboard/receitas/actions.ts), [receitas/actions.ts:200](app/dashboard/receitas/actions.ts) |
| ✅ | **Histórico de preço por INSERT** (nunca UPDATE) com view de custo vigente por `MAX(vigente_desde)` | [20260620000004_schema_central.sql:189](supabase/migrations/20260620000004_schema_central.sql), [20260618170000_views_custo.sql:27](supabase/migrations/20260618170000_views_custo.sql) |
| ✅ | **`savePrecoVenda` valida ownership de empresa** (corrige ALTO 1 da sessão 2) | [painel.ts:180](app/actions/painel.ts) |
| ✅ | **Upsert em lote** `savePrecoVendaLote` (corrige ALTO 9) + `router.refresh()` após salvar | [painel.ts:200-254](app/actions/painel.ts), [painel-tabela.tsx:66](app/dashboard/painel/components/painel-tabela.tsx) |
| ✅ | **`UnidadeSelector` agora é real** — lê contexto + RBAC, persiste cookie e força re-render server-side | [unidade-selector.tsx](app/components/unidade-selector.tsx), [unidade-context.tsx:37-42](app/context/unidade-context.tsx) |
| ✅ | **Margem × Markup distinguidos corretamente** na view e na precificadora (`custo/(1-m)` vs `custo*(1+mk)`) | [20260621000000_produto_financeiro.sql:120-137](supabase/migrations/20260621000000_produto_financeiro.sql), [painel-precificacao.tsx:31-38](app/dashboard/painel/components/painel-precificacao.tsx) |
| ✅ | **Entrada monetária "estilo centavos"** no fluxo de transferência (robusta, sem ambiguidade decimal) | [nova-transferencia-form.tsx:56-71](app/dashboard/transferencias/components/nova-transferencia-form.tsx) |
| ✅ | **Features "em breve" honestas** — Consolidado e Produto Fabricado desabilitados com badge (corrige MÉDIO 1 e 2 da sessão 2) | [empresa-switcher.tsx:16-26](app/components/empresa-switcher.tsx), [novo-produto-modal.tsx:65-76](app/dashboard/produtos/components/novo-produto-modal.tsx) |
| ✅ | **Configurações persistem** (era "só memória") via `config_geral` por empresa | [config.ts:46-68](app/actions/config.ts), [cadastros-panel.tsx:69-87](app/dashboard/cadastros/components/cadastros-panel.tsx) |
| ✅ | **`tabular-nums` amplamente aplicado** em colunas de R$; **código morto removido** (`navigation.tsx`/`header.tsx` não existem mais) | tabelas de painel/simulador; Glob vazio |
| ✅ | **Segurança de chaves** — `.env.local` não versionado, apenas nomes esperados (`NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`); nenhum segredo no código | — |

---

## 3. O que precisa melhorar

### 3.1 RLS: isolamento por **unidade** não funciona (P1)
As tabelas centrais acumulam **duas gerações de políticas RLS** que nunca foram reconciliadas:
- **Gen 1 — por unidade** ([20260618140000_unidade_id_rls.sql](supabase/migrations/20260618140000_unidade_id_rls.sql)): `"Usuarios veem apenas registros da propria unidade"` + `insert/update_*_unidade` em `insumo`, `insumo_preco`, `receita`, `receita_item`, `produto`, `produto_preco`, filtrando por `unidade_id = get_user_unidade_id()`.
- **Gen 2 — por empresa** ([20260620000004_schema_central.sql:158](supabase/migrations/20260620000004_schema_central.sql)): `insumo_empresa`, `receita_empresa`, etc. **com `IF NOT EXISTS`** — ou seja, **não removem** as de unidade.

Como ambas são **PERMISSIVE**, o Postgres as combina com **OR**. A política por empresa (mais ampla) **anula** o filtro por unidade: um operador da unidade Centro lê/edita registros da Morada do Sol normalmente. A tabela `produto` chega a ter ~6 políticas empilhadas (4 por unidade + `produto_por_empresa` + `produto_empresa_rls`). **[NÃO VERIFICADO no banco]** — confirmar com `SELECT tablename, policyname, cmd, qual FROM pg_policies`.

> Consequência: o RBAC e o `UnidadeSelector` *prometem* dados por unidade na UI, mas o **banco isola apenas por empresa**. Para a Flor do Trigo (2 unidades, mesma empresa) é um risco de confiança, não de vazamento entre clientes. Contradiz a decisão de produto "dados por unidade".

### 3.2 Confirmação de recebimento sem autorização (P1)
`confirmarRecebimentoAction` só checa `if (!user)` e repassa `transferencia_id` e `user.id` para a RPC; **não valida** que o usuário pertence à empresa/unidade de destino ([transferencia.ts:118-149](app/actions/transferencia.ts)). A RPC `confirmar_recebimento` é `SECURITY DEFINER` (ignora RLS) e **também não valida ownership** ([20260620000007...sql:78-182](supabase/migrations/20260620000007_confirmar_recebimento_atomico.sql)). Resultado: qualquer usuário autenticado pode confirmar o recebimento (mexendo em saldo e status financeiro) de **qualquer** transferência cujo id conheça. Compare com `cancelar`/`excluir`, que **validam empresa** ([transferencia.ts:158-169](app/actions/transferencia.ts)).

### 3.3 Migrations não reproduzem o banco em ordem limpa (P1)
O conjunto de migrations documenta o schema, mas **não constitui um caminho de recriação confiável**:
- [20260620000003_correcoes_seguranca.sql:25](supabase/migrations/20260620000003_correcoes_seguranca.sql) faz `ALTER VIEW public.vw_produto_financeiro SET (security_invoker = true)` **sem tratamento de erro** — mas a view só é criada em [20260621000000_produto_financeiro.sql:109](supabase/migrations/20260621000000_produto_financeiro.sql) (timestamp posterior). Em `supabase db reset` limpo, **a migration aborta** ("view não existe").
- [baseline.sql](supabase/migrations/20260617150000_baseline.sql) admite que "o schema real foi criado manualmente"; várias migrations assumem objetos pré-existentes.
- Políticas duplicadas se acumulam por causa dos `IF NOT EXISTS` + `DROP` espalhados e fora de ordem (ver 3.1).

> A migration de 23/06 ([20260623000000_correcao_painel_financeiro.sql:67-88](supabase/migrations/20260623000000_correcao_painel_financeiro.sql)) recria a view **com** `security_invoker` corretamente (via `pg_get_viewdef` + `EXCEPTION`), então o estado *final em produção* provavelmente está correto — mas um banco novo não chega lá sozinho.

### 3.4 `vw_custo_receita`: CTE recursivo provavelmente inválido no Postgres (P2 — verificar)
A definição versionada referencia a CTE `custo_base` **dentro de subconsultas com agregação** no termo recursivo: um `SELECT SUM(...) ... JOIN custo_base` e um `NOT EXISTS (SELECT 1 FROM custo_base ...)` ([20260618170000_views_custo.sql:106-145](supabase/migrations/20260618170000_views_custo.sql)). O Postgres proíbe referência recursiva em subquery/agregação e mais de uma vez no termo recursivo — essa view, **como escrita, tende a falhar na criação**. Logo, ou a definição em produção diverge do repo, ou sub-receitas de 2+ níveis não calculam como o código assume. **[NÃO VERIFICADO no banco]** — rodar `SELECT pg_get_viewdef('public.vw_custo_receita', true)` e testar uma ficha A→B→C.

### 3.5 Parsing monetário inconsistente (P2)
Existe um `parseDecimalBR` robusto e testado, mas **vários pontos de entrada de dinheiro não o usam** — recorrem a `parseFloat(x.replace(',', '.'))`, que **quebra com separador de milhar** (`"1.234,56"` → `1.234`) e mascara `NaN`:
- `PrecoCell.save` ([painel-tabela.tsx:165](app/dashboard/painel/components/painel-tabela.tsx)) e `LoteModal` ([painel-tabela.tsx:62](app/dashboard/painel/components/painel-tabela.tsx))
- Precificadora ([painel-precificacao.tsx:29](app/dashboard/painel/components/painel-precificacao.tsx))
- Meta do mês ([painel-meta.tsx:38](app/dashboard/painel/components/painel-meta.tsx))
- Novo produto de revenda ([novo-produto-modal.tsx:28](app/dashboard/produtos/components/novo-produto-modal.tsx))

Além disso, 3 inputs monetários/percentuais ainda são `type="number"` (deveria ser `type="text" inputMode="decimal"`): [painel-tabela.tsx:92](app/dashboard/painel/components/painel-tabela.tsx), [painel-precificacao.tsx:144](app/dashboard/painel/components/painel-precificacao.tsx), [novo-produto-modal.tsx:132](app/dashboard/produtos/components/novo-produto-modal.tsx). Para preços de padaria (valores baixos) raramente corrompe, mas é incoerência num app cujo núcleo é dinheiro.

### 3.6 Fichas criadas pela UI nascem sem `unidade_id` (P2)
`createReceita`/`updateReceita` inserem `empresa_id` mas **não setam `unidade_id`** ([receitas/actions.ts:62-70](app/dashboard/receitas/actions.ts), [receitas/actions.ts:102-108](app/dashboard/receitas/actions.ts)). Como o Resumo e Preços **filtram por `unidade_id`** quando há unidade selecionada ([dashboard/page.tsx:48-56](app/dashboard/page.tsx), [precos/page.tsx:10-11](app/dashboard/precos/page.tsx)), uma ficha recém-criada pode **desaparecer** da tela com uma unidade ativa. Inconsistência entre escrita (sem unidade) e leitura (filtra por unidade).

### 3.7 Semântica financeira mistura grandezas (P2)
- O KPI **"Faturamento Estimado"** exibe a **soma dos preços de catálogo** dos produtos, sem volume de vendas ([painel-kpis.tsx:53-66](app/dashboard/painel/components/painel-kpis.tsx); origem em [painel.ts:150](app/actions/painel.ts)). O componente Meta documenta isso ("não representa faturamento real", [painel-meta.tsx:163](app/dashboard/painel/components/painel-meta.tsx)), mas o KPI principal não tem ressalva.
- O **ponto de equilíbrio** usa a fórmula correta `despesas / (margem%/100)`, porém compara o resultado (R$/mês) com `faturamento_estimado` (soma de preços unitários): "Portfólio R$ X acima do ponto de equilíbrio" mistura mensal × unitário ([painel-equilibrio.tsx:50-54](app/dashboard/painel/components/painel-equilibrio.tsx), [painel-client.tsx:75](app/dashboard/painel/components/painel-client.tsx)).
- A meta automática é `portfólio × 1.2` (mín. R$1.000), o que faz a barra começar sempre em ~83% ([empresa.ts:135-138](app/actions/empresa.ts)).

### 3.8 Lint quebrado (1 erro) + `console.log` de debug (P3)
- `npm run lint` falha com 1 erro: `react-hooks/set-state-in-effect` em [nova-transferencia-form.tsx:108](app/dashboard/transferencias/components/nova-transferencia-form.tsx) (`setState` síncrono no efeito de leitura de cookie). É o padrão "ler cookie só no client", mas o lint do React 19 reprova.
- **6 `console.log('[TIPO]'…)` de depuração** esquecidos em produção ([cadastros-panel.tsx:127-155](app/dashboard/cadastros/components/cadastros-panel.tsx)).
- O `next build` passa porque não roda ESLint nesta config.

---

## 4. O que ainda falta implementar

| Item | Situação | Evidência |
|---|---|---|
| **Receber/NFe → casar item com insumo → atualizar custo** | **Parcial.** Há registro de Compra/NFe (fornecedor, data, valor total, "anexar XML em breve"), mas **não vincula itens a insumos nem atualiza custo** — o custeio segue manual via módulo Insumos | [compras-tab.tsx](app/dashboard/transferencias/receber/components/compras-tab.tsx), [20260618160000_compra.sql](supabase/migrations/20260618160000_compra.sql) |
| **Conversão de unidade** | Ausente. `custo_item = quantidade × custo_uso`; sub-receita usa `custo_total/rendimento` sem checar se `rendimento_unidade` bate com a unidade usada | [20260618170000_views_custo.sql:118-133](supabase/migrations/20260618170000_views_custo.sql) |
| **Produto Fabricado pela UI** (`createProdutoFabricado`) | Não existe; UI honesta ("Em breve" + Importar de Fichas) | [novo-produto-modal.tsx:65](app/dashboard/produtos/components/novo-produto-modal.tsx) |
| **Modo Consolidado (multi-empresa)** | Desabilitado "Em breve" | [empresa-switcher.tsx:16](app/components/empresa-switcher.tsx) |
| **Validação/baixa de estoque na origem** | A confirmação **soma** saldo no destino, mas o envio **não debita** a origem; sem checagem de saldo | [20260620000007...sql:141-167](supabase/migrations/20260620000007_confirmar_recebimento_atomico.sql) |
| **Testes da matemática de custo/margem** | Só há testes de `format` (parse/format). Nenhum teste da lógica SQL de custo, da view, ou de integração | [lib/format.test.ts](lib/format.test.ts) (único) |
| **Curva ABC ponderada por vendas** | Heurística por `quantidade × custo` nas fichas, sem volume real (o tooltip admite) | [dashboard/page.tsx:130-144](app/dashboard/page.tsx) |
| **Upload de XML da NFe** | Placeholder visual "em breve" | [compras-tab.tsx:252-262](app/dashboard/transferencias/receber/components/compras-tab.tsx) |

---

## 5. Problemas / riscos (com evidência e severidade)

| Sev | Problema | Evidência |
|-----|----------|-----------|
| **P1** | RLS por unidade anulada por RLS por empresa (políticas permissivas combinam com OR); `produto` com ~6 políticas | 3.1 · [unidade_id_rls.sql](supabase/migrations/20260618140000_unidade_id_rls.sql) vs [schema_central.sql:158](supabase/migrations/20260620000004_schema_central.sql) |
| **P1** | `confirmar_recebimento` sem validação de ownership (action + RPC `SECURITY DEFINER`) | 3.2 · [transferencia.ts:118-149](app/actions/transferencia.ts) |
| **P1** | Migrations não reproduzem banco limpo (`ALTER VIEW` antes do `CREATE`; baseline manual) | 3.3 · [correcoes_seguranca.sql:25](supabase/migrations/20260620000003_correcoes_seguranca.sql) |
| **P2** | `vw_custo_receita`: termo recursivo referencia a CTE em subquery/agregação → provável invalidez no PG **[NÃO VERIFICADO]** | 3.4 · [views_custo.sql:106-145](supabase/migrations/20260618170000_views_custo.sql) |
| **P2** | Parsing monetário inconsistente (`parseFloat(replace)` em vez de `parseDecimalBR`) + 3 `type="number"` | 3.5 |
| **P2** | Fichas criadas sem `unidade_id` → invisíveis sob filtro de unidade | 3.6 · [receitas/actions.ts:62](app/dashboard/receitas/actions.ts) |
| **P2** | "Faturamento estimado" e ponto de equilíbrio misturam soma-de-preços (unitário) com fluxo mensal | 3.7 · [painel-kpis.tsx:53](app/dashboard/painel/components/painel-kpis.tsx), [painel-equilibrio.tsx:50](app/dashboard/painel/components/painel-equilibrio.tsx) |
| **P2** | `NOT NULL` condicional em `multi_empresa` pode não aplicar a constraint se backfill falhar (divergência TS×banco) | [20260622000000_multi_empresa.sql:48-59](supabase/migrations/20260622000000_multi_empresa.sql) |
| **P2** | Resumo não filtra por empresa (depende só de RLS), embora filtre por unidade | [dashboard/page.tsx:40-56](app/dashboard/page.tsx) |
| **P2** | Envio de transferência não debita saldo da origem; sem validação de estoque | [20260620000007...sql](supabase/migrations/20260620000007_confirmar_recebimento_atomico.sql) |
| **P3** | Lint: `setState` em efeito (único erro restante) | [nova-transferencia-form.tsx:108](app/dashboard/transferencias/components/nova-transferencia-form.tsx) |
| **P3** | `console.log` de depuração em produção (6×) | [cadastros-panel.tsx:127-155](app/dashboard/cadastros/components/cadastros-panel.tsx) |
| **P3** | `vw_insumo_custo_atual`: 2 preços com mesma `vigente_desde` duplicam linha → custo de receita inflado | [views_custo.sql:41-47](supabase/migrations/20260618170000_views_custo.sql) |
| **P3** | Curva ABC por `nome.includes('pendente')` (frágil) e sem ponderação por vendas | [dashboard/page.tsx:137](app/dashboard/page.tsx) |
| **P3** | Falta token semântico de "atenção" (amarelo `#f59e0b`/`amber-400` hardcoded) | [painel-graficos.tsx:200](app/dashboard/painel/components/painel-graficos.tsx), [simulador-client.tsx:200](app/dashboard/simulador/components/simulador-client.tsx) |
| **P3** | Inconsistência de tokens de cor: `text-red-400`/`emerald-400` (Preços, Ficha) vs `text-danger`/`success` (Painel) | [precos/page.tsx:74](app/dashboard/precos/page.tsx), [ficha-view.tsx:97](app/dashboard/receitas/components/ficha-view.tsx) |
| **P3** | Status de transferência com convenções mistas (`'EM_TRANSITO'` e `'enviada'` aceitos) | [20260620000007...sql:105](supabase/migrations/20260620000007_confirmar_recebimento_atomico.sql) |
| **P3** | `danger #c74a4a` como texto pequeno = **3,40:1** (reprova AA normal; passa só AA Large) | cálculo WCAG · [globals.css:68](app/globals.css) |

---

## 6. Sugestões práticas de melhoria

**Segurança / dados (prioridade):**
1. **Decidir o nível de isolamento e limpar o RLS.** Se o alvo é por **unidade**: dropar as políticas por empresa nas tabelas core e manter só as por unidade (ou torná-las `RESTRICTIVE` em cima da de empresa). Se o alvo é por **empresa**: dropar as de unidade e fazer o filtro fino por unidade no código. Hoje as duas coexistem e se anulam (ver 3.1).
2. **Validar ownership na confirmação de recebimento** — na action e/ou na RPC, exigir que `auth.uid()` pertença à empresa da transferência e (idealmente) à unidade de destino.
3. **Tornar as migrations reproduzíveis** — `supabase db reset` num banco limpo deve passar. Proteger `ALTER VIEW` com `IF EXISTS`/ordem correta, consolidar as políticas em uma migration canônica, e remover dependências de objetos "criados manualmente".

**Confiabilidade da matemática:**
4. **Verificar e versionar a `vw_custo_receita` real** (`pg_get_viewdef`) e adicionar um teste de ficha com sub-receita de 2+ níveis. Tratar empate de `vigente_desde` em `vw_insumo_custo_atual` (desempatar por `created_at`/`id`).
5. **Padronizar todo input de dinheiro** em `type="text" inputMode="decimal"` + `parseDecimalBR` no submit. Eliminar `parseFloat(replace(',','.'))`.
6. **Introduzir conversão de unidade** (ou validar que `rendimento_unidade` da sub-receita bate com a unidade usada) antes de multiplicar custos.

**Produto / UX:**
7. **Setar `unidade_id` ao criar/editar ficha** (e insumo), herdando da unidade selecionada — senão remover o filtro por unidade dessas telas.
8. **Renomear/qualificar "Faturamento Estimado"** (ex.: "Valor do portfólio") em todos os lugares, e separar do ponto de equilíbrio até existir volume de vendas.
9. Adicionar **token semântico de atenção** (`--t-warning`) e unificar `text-danger/success` (parar de misturar `red-400`/`emerald-400`).
10. Remover os `console.log` e corrigir o último erro de lint.

---

## 7. Prioridades de ação (P0 → P3)

| Prioridade | Ação | Arquivo-chave |
|---|---|---|
| **P1** | Consolidar RLS (decidir unidade × empresa) e remover políticas redundantes | [unidade_id_rls.sql](supabase/migrations/20260618140000_unidade_id_rls.sql), [schema_central.sql](supabase/migrations/20260620000004_schema_central.sql) |
| **P1** | Validar ownership em `confirmarRecebimentoAction` + RPC | [transferencia.ts:118](app/actions/transferencia.ts), [20260620000007...sql](supabase/migrations/20260620000007_confirmar_recebimento_atomico.sql) |
| **P1** | Garantir `supabase db reset` limpo (ordem/idempotência das migrations) | [correcoes_seguranca.sql:25](supabase/migrations/20260620000003_correcoes_seguranca.sql) |
| **P2** | Verificar `vw_custo_receita` real + teste de sub-receita multinível | [views_custo.sql:74](supabase/migrations/20260618170000_views_custo.sql) |
| **P2** | Padronizar parsing monetário (parseDecimalBR + inputMode) | [painel-tabela.tsx:165](app/dashboard/painel/components/painel-tabela.tsx), [painel-precificacao.tsx:29](app/dashboard/painel/components/painel-precificacao.tsx) |
| **P2** | Setar `unidade_id` ao criar ficha/insumo | [receitas/actions.ts:62](app/dashboard/receitas/actions.ts) |
| **P2** | Corrigir semântica de faturamento/ponto de equilíbrio | [painel-kpis.tsx:53](app/dashboard/painel/components/painel-kpis.tsx), [painel-equilibrio.tsx:50](app/dashboard/painel/components/painel-equilibrio.tsx) |
| **P2** | Filtrar Resumo por empresa; tratar `unidade_id`/`NOT NULL` em produtos | [dashboard/page.tsx:40](app/dashboard/page.tsx), [multi_empresa.sql:48](supabase/migrations/20260622000000_multi_empresa.sql) |
| **P3** | Remover `console.log`; corrigir lint `setState`-em-efeito | [cadastros-panel.tsx:127](app/dashboard/cadastros/components/cadastros-panel.tsx), [nova-transferencia-form.tsx:108](app/dashboard/transferencias/components/nova-transferencia-form.tsx) |
| **P3** | Token de atenção; unificar tokens de cor; desempate de `vigente_desde` | [globals.css](app/globals.css), [views_custo.sql:41](supabase/migrations/20260618170000_views_custo.sql) |
| **P3** | Substituir `includes('pendente')` por flag/coluna explícita na ABC | [dashboard/page.tsx:137](app/dashboard/page.tsx) |

---

## 8. Conclusão / diagnóstico geral

O Fornada **amadureceu muito** entre as auditorias. Os achados mais graves anteriores foram efetivamente resolvidos: o **P0 do parser decimal** (reescrito + 26 testes), a **cisão visual** (tema escuro único), o **contraste do botão** (6,57:1), o **seletor de unidade falso** (agora real), as **três telas-stub** (Simulador/Painel/Configurações funcionais), o **schema central** (versionado) e vários furos multi-tenant da sessão 2 (ownership de preço, lote, `copiarEntreUnidades`, `isFaixaAtiva`, mutação de prop, paginação, "Consolidado"/"Fabricado" honestos).

O que sobra **não é falta de funcionalidade — é coerência e confiança**, em três frentes:

1. **Banco / segurança (P1):** o RLS isola por **empresa**, mas a UI promete por **unidade**, e há duas gerações de políticas que se anulam; a confirmação de recebimento não valida quem confirma; e as migrations não recriam o banco do zero. Para a Flor do Trigo (uma empresa, dona no controle) isso é tolerável hoje, mas é o bloqueador para multi-tenant e para a promessa de "dados por unidade".
2. **Matemática auditável (P2):** o custo vive em views SQL cujas definições versionadas têm pontos suspeitos (CTE recursivo, empate de vigência) e **sem testes de integração**. A semântica de "faturamento"/"ponto de equilíbrio" mistura grandezas.
3. **Polimento (P2/P3):** parsing monetário incoerente, fichas sem `unidade_id`, `console.log` esquecidos e 1 erro de lint.

**Ordem recomendada:** consolidar RLS → autorizar a confirmação de recebimento → tornar as migrations reproduzíveis → verificar/testar a matemática de custo → padronizar parsing e semântica financeira → polimento. Nenhuma dessas exige reescrita; são saneamento e consistência sobre uma base já boa.

---

## Tabela-delta (Passo 0) — auditorias anteriores → status hoje

### Sessão 1 (18/06)
| Achado anterior | Status | Evidência |
|---|---|---|
| P0 `parseDecimalBR` corrompe (`2.5`→25) | ✅ RESOLVIDO | [lib/format.ts:19](lib/format.ts), 26 testes |
| P1 cisão visual claro × escuro | ✅ RESOLVIDO | [globals.css:79](app/globals.css) |
| P1 `UnidadeSelector` falso | ✅ RESOLVIDO | [unidade-selector.tsx](app/components/unidade-selector.tsx) |
| P1 telas vazias (Simulador/Painel/Config) | ✅ RESOLVIDO | simulador/painel/cadastros |
| P1 schema central não versionado | ✅ RESOLVIDO (c/ ressalva de ordem) | [schema_central.sql](supabase/migrations/20260620000004_schema_central.sql) |
| P1 contraste botão 2,65:1 | ✅ RESOLVIDO (6,57:1) | [globals.css:203](app/globals.css) |
| P2 matemática fora do repo + 0 testes | 🟡 PARCIAL (views versionadas; testes só de format) | [views_custo.sql](supabase/migrations/20260618170000_views_custo.sql) |
| P2 RLS por empresa, não por unidade | ⛔ ABERTO (agravado: 2 gerações em OR) | 3.1 |
| P2 sem conversão de unidade | ⛔ ABERTO | 3.4 / Seção 4 |
| P2 recebimento sem transação (N updates) | ✅ RESOLVIDO (RPC atômica) | [20260620000007...sql](supabase/migrations/20260620000007_confirmar_recebimento_atomico.sql) |
| P2 sem skeleton/error no núcleo | 🟡 PARCIAL | painel/`loading.tsx` |
| P2 sem `tabular-nums` | ✅ RESOLVIDO (amplo) | tabelas painel |
| P2 login contraste 3,85:1 | ✅ RESOLVIDO | [login/page.tsx:85](app/login/page.tsx) |
| P3 `includes('pendente')` | 🟡 PARCIAL (flag na ficha; ABC ainda usa) | [dashboard/page.tsx:137](app/dashboard/page.tsx) |
| P3 curva ABC sem ponderação | ⛔ ABERTO (documentado) | [dashboard/page.tsx:130](app/dashboard/page.tsx) |
| P3 código morto navigation/header | ✅ RESOLVIDO (removidos) | Glob vazio |
| P3 `PLAN.md` descreve tema inexistente | ❓ NÃO REVERIFICADO (tema escuro agora existe) | — |
| P3 detalhe transferência `window.reload` | ❓ NÃO REVERIFICADO nesta passada | — |

### Sessão 2 (20/06)
| Achado anterior | Status | Evidência |
|---|---|---|
| 🔴 C1 `vw_produto_financeiro` sem RLS | 🟡 PARCIAL (security_invoker em 23/06 + filtro no código; `ALTER` em 20/06 fora de ordem) | [correcao_painel_financeiro.sql:67](supabase/migrations/20260623000000_correcao_painel_financeiro.sql) |
| 🔴 C2 políticas duplicadas em `produto` | 🟡 PARCIAL (`produto_empresa` dropada; ainda há redundância) | 3.1 |
| 🔴 C3 `fn_set_atualizado_em` não garantida | ✅ RESOLVIDO | [schema_central.sql:27](supabase/migrations/20260620000004_schema_central.sql) |
| 🟠 A1 `savePrecoVenda` sem ownership | ✅ RESOLVIDO | [painel.ts:180](app/actions/painel.ts) |
| 🟠 A2 `copiarEntreUnidades` `.single()` | ✅ RESOLVIDO | [unidade.ts:85](app/actions/unidade.ts) |
| 🟠 A3 cópia de preços usa `receita_preco` | ✅ RESOLVIDO (usa `produto_preco`) | [unidade.ts:196](app/actions/unidade.ts) |
| 🟠 A4 `isFaixaAtiva` `-999`×`-Infinity` | ✅ RESOLVIDO | [painel-graficos.tsx:78](app/dashboard/painel/components/painel-graficos.tsx) |
| 🟠 A5 mutação de prop em `PrecoCell` | ✅ RESOLVIDO (estado local + refresh) | [painel-tabela.tsx:151](app/dashboard/painel/components/painel-tabela.tsx) |
| 🟠 A6 `NOT NULL` silencioso (multi_empresa) | ⛔ ABERTO | [multi_empresa.sql:48](supabase/migrations/20260622000000_multi_empresa.sql) |
| 🟠 A7 `getMetaFaturamento` sem filtro empresa | ✅ RESOLVIDO | [empresa.ts:118](app/actions/empresa.ts) |
| 🟠 A8 `faturamentoAtual` semântica | 🟡 PARCIAL (renomeado + tooltip; KPI sem ressalva) | [painel-kpis.tsx:57](app/dashboard/painel/components/painel-kpis.tsx) |
| 🟠 A9 `LoteModal` N chamadas | ✅ RESOLVIDO (lote); precificadora ainda em loop | [painel.ts:200](app/actions/painel.ts), [painel-precificacao.tsx:55](app/dashboard/painel/components/painel-precificacao.tsx) |
| 🟠 A10 produtos sem `unidade_id` | 🟡 PARCIAL (migration de backfill; erro ainda possível) | [produtos_sem_unidade.sql](supabase/migrations/20260620000006_produtos_sem_unidade.sql), [painel.ts:181](app/actions/painel.ts) |
| 🟡 M1 Consolidado quebrado | ✅ RESOLVIDO (desabilitado) | [empresa-switcher.tsx:16](app/components/empresa-switcher.tsx) |
| 🟡 M2 "Fabricado" exibe erro | ✅ RESOLVIDO (desabilitado) | [novo-produto-modal.tsx:65](app/dashboard/produtos/components/novo-produto-modal.tsx) |
| 🟡 M3 sem `router.refresh` no save | ✅ RESOLVIDO | [painel-tabela.tsx:174](app/dashboard/painel/components/painel-tabela.tsx) |
| 🟡 M6 `canRead/canWrite` true no loading | ✅ RESOLVIDO (`canWrite=false` no loading) | [permissions-context.tsx:94](app/context/permissions-context.tsx) |
| 🟡 M9 sem paginação no painel | ✅ RESOLVIDO (range/pagination) | [painel.ts:100](app/actions/painel.ts) |
| L2 modo consolidado | ✅ desabilitado | [empresa-switcher.tsx](app/components/empresa-switcher.tsx) |
| L3 `createProdutoFabricado` | ⛔ não existe (UI honesta) | [novo-produto-modal.tsx](app/dashboard/produtos/components/novo-produto-modal.tsx) |
| L4 `receita_preco` × `produto_preco` | 🟡 PARCIAL (consolidação; legado mantido) | [consolidar_precos.sql](supabase/migrations/20260620000005_consolidar_precos.sql) |
| L5 sem testes | 🟡 PARCIAL (26 de format; nada de negócio) | [lib/format.test.ts](lib/format.test.ts) |

---

## Ambiguidades — decisões de produto a confirmar (NÃO adivinhar)

1. **Isolamento real: por unidade ou por empresa?** Hoje o RLS garante **empresa**; a UI promete **unidade**. Isso define se a correção é dropar as políticas de unidade (e filtrar no código) ou as de empresa (e endurecer o RLS por unidade). É a decisão-mãe do P1 de segurança.
2. **Quem pode confirmar recebimento?** Hoje qualquer autenticado (sem checagem). Restringir à empresa? À unidade de **destino**? Ao não-criador?
3. **O Resumo deve respeitar a unidade e a empresa selecionadas?** Hoje filtra por unidade (cookie), mas **não** por empresa.
4. **"Faturamento estimado" / Meta:** manter como "soma do portfólio" ou só exibir faturamento quando houver **volume de vendas**? A meta automática (`portfólio × 1,2`) é um placeholder aceitável?
5. **"Receber" = entrada de NFe de fornecedor que atualiza custo?** Hoje há registro de compra (valor total) **sem** vínculo a insumos/custo. Esse é o roadmap pretendido?
6. **Margem:** confirmar que o padrão é **margem sobre venda** (`(p−c)/p`), com markup `(p−c)/c` apenas como visão auxiliar (é o que o código faz).
7. **`receita_preco` legado:** pode ser descontinuada após confirmar que tudo migrou para `produto_preco`?

---

## Inventário de arquivos relevante (Passo 1)

**Config & infra**
- [package.json](package.json) — next 16.2.9, react 19, @supabase/ssr 0.12, lucide-react 1.20; **dev:** vitest 4.1.9, tailwindcss 4, eslint 9. Scripts: `dev/build/start/lint/test/test:watch`.
- `next.config.ts` (vazio — não roda ESLint no build) · `eslint.config.mjs` · `tsconfig.json` · `postcss.config.mjs` · `proxy.ts` (middleware de auth)
- [lib/format.ts](lib/format.ts) (+ [lib/format.test.ts](lib/format.test.ts) — único arquivo de teste) · `lib/supabase/{server,client}.ts`
- [app/globals.css](app/globals.css) — Tailwind v4 `@theme` + tokens `--t-*` + componentes `.btn-primary`/`.card-surface`/`.input-field`. **Tema escuro definitivo.** Sem `tailwind.config.ts`.

**Banco (Supabase) — 26 migrations**
- Baseline/central: [20260617150000_baseline.sql](supabase/migrations/20260617150000_baseline.sql), [20260620000004_schema_central.sql](supabase/migrations/20260620000004_schema_central.sql)
- Views/custo: [20260618170000_views_custo.sql](supabase/migrations/20260618170000_views_custo.sql) (`vw_insumo_custo_atual`, `vw_custo_receita`, `fn_get_user_unidade`)
- Unidade/RLS: [20260618140000_unidade_id_rls.sql](supabase/migrations/20260618140000_unidade_id_rls.sql) · Multi-empresa: [20260622000000_multi_empresa.sql](supabase/migrations/20260622000000_multi_empresa.sql)
- Produto/painel: [20260621000000_produto_financeiro.sql](supabase/migrations/20260621000000_produto_financeiro.sql), [20260620000005_consolidar_precos.sql](supabase/migrations/20260620000005_consolidar_precos.sql), [20260623000000_correcao_painel_financeiro.sql](supabase/migrations/20260623000000_correcao_painel_financeiro.sql)
- Transferência/recebimento/compra: [20260618120000_transferencia_unidades.sql](supabase/migrations/20260618120000_transferencia_unidades.sql), [20260620000007_confirmar_recebimento_atomico.sql](supabase/migrations/20260620000007_confirmar_recebimento_atomico.sql), [20260618160000_compra.sql](supabase/migrations/20260618160000_compra.sql)
- RBAC/config: [20260619000000_rbac_permissoes.sql](supabase/migrations/20260619000000_rbac_permissoes.sql), [20260619020000_config_geral.sql](supabase/migrations/20260619020000_config_geral.sql), [20260622000001_meta_faturamento.sql](supabase/migrations/20260622000001_meta_faturamento.sql)

**Server actions** — [painel.ts](app/actions/painel.ts), [empresa.ts](app/actions/empresa.ts), [unidade.ts](app/actions/unidade.ts), [transferencia.ts](app/actions/transferencia.ts), [config.ts](app/actions/config.ts), [permissoes.ts](app/actions/permissoes.ts), `compra.ts`; [insumos/actions.ts](app/dashboard/insumos/actions.ts), [receitas/actions.ts](app/dashboard/receitas/actions.ts)

**Rotas (17)** — `/`, `/login`, `/dashboard` (Resumo), `/dashboard/{insumos,receitas,receitas/[id],precos,produtos,painel,simulador,cadastros}`, `/dashboard/transferencias{,/nova,/[id],/receber}`

**Contextos & shell** — [unidade-context.tsx](app/context/unidade-context.tsx), [empresa-context.tsx](app/context/empresa-context.tsx), [permissions-context.tsx](app/context/permissions-context.tsx); `dashboard-shell.tsx`, `sidebar.tsx`, [unidade-selector.tsx](app/components/unidade-selector.tsx), [empresa-switcher.tsx](app/components/empresa-switcher.tsx)

**Painel (componentes)** — [painel-client.tsx](app/dashboard/painel/components/painel-client.tsx), `painel-kpis`, `painel-tabela`, `painel-graficos`, `painel-precificacao`, `painel-meta`, `painel-despesas`, `painel-equilibrio`, `painel-alertas`

---

> Fim do relatório v2. O histórico anterior permanece em [AUDITORIA_FORNADA.md](AUDITORIA_FORNADA.md) (não sobrescrito).
