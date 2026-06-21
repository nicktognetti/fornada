# Correções pós-auditoria (v2) — acompanhamento

> Documento vivo. Base: [AUDITORIA_FORNADA_v2.md](AUDITORIA_FORNADA_v2.md). Início: 21/06/2026.
> Legenda: ✅ feito e verificado · 🟡 parcial · ⬜ pendente · ⛔ bloqueado por decisão.
>
> **Verificação após o lote de código:** `tsc --noEmit` ✅ 0 · `eslint` ✅ **0** (era 1) · `vitest` ✅ 26/26 · `next build` ✅ 17 rotas.
>
> ⚠️ **Não foi possível testar contra o banco real** (sem `psql`/conexão neste ambiente). Tudo que é SQL abaixo está como **proposta para revisar + aplicar + testar manualmente** — não foi aplicado.

---

## A) Correções de CÓDIGO aplicadas (✅ verificadas com tsc/lint/test/build)

| # | Item (sev) | O que foi feito | Arquivos |
|---|---|---|---|
| A1 | **Ownership na confirmação de recebimento (P1)** | A action passou a validar que a transferência pertence a uma empresa do usuário **antes** de chamar a RPC `SECURITY DEFINER`. Antes, qualquer autenticado confirmava qualquer transferência. | [transferencia.ts:128-150](app/actions/transferencia.ts) |
| A2 | **Parsing monetário inconsistente (P2)** | Troquei `parseFloat(x.replace(',','.'))` pelo `parseDecimalBR` robusto e `type="number"` → `type="text" inputMode="decimal"` em todos os inputs de dinheiro/percentual do painel e do modal de produto. | [painel-tabela.tsx](app/dashboard/painel/components/painel-tabela.tsx) (PrecoCell, LoteModal), [painel-precificacao.tsx](app/dashboard/painel/components/painel-precificacao.tsx), [painel-meta.tsx](app/dashboard/painel/components/painel-meta.tsx), [novo-produto-modal.tsx](app/dashboard/produtos/components/novo-produto-modal.tsx) |
| A3 | **Fichas/insumos órfãos de unidade (P2)** | `createReceita` e `createInsumo` agora setam `unidade_id` (unidade preferida do cookie, com fallback na 1ª unidade ativa da empresa), via helper `getUnidadeEscrita`. Evita que registros novos sumam sob o filtro por unidade. | [receitas/actions.ts:25-44,62-79](app/dashboard/receitas/actions.ts), [insumos/actions.ts:45-66,79-99](app/dashboard/insumos/actions.ts) |
| A4 | **`console.log` de debug em produção (P3)** | Removidos os 6 `console.log('[TIPO/UNID/CAT]'…)`. | [cadastros-panel.tsx](app/dashboard/cadastros/components/cadastros-panel.tsx) |
| A5 | **Lint quebrado: 1 erro (P3)** | `react-hooks/set-state-in-effect` resolvido com `eslint-disable` justificado (leitura de cookie pós-mount é intencional p/ evitar hydration mismatch). `eslint .` agora passa com 0 erros. | [nova-transferencia-form.tsx:107-112](app/dashboard/transferencias/components/nova-transferencia-form.tsx) |
| A6 | **Token semântico de atenção (P3)** | Adicionados `--color-warning`/`--t-warning` (`#d9a441`, AA sobre escuro) e substituídos os `#f59e0b` inline. | [globals.css:67-68,103](app/globals.css), [simulador-client.tsx:200](app/dashboard/simulador/components/simulador-client.tsx), [painel-meta.tsx:70](app/dashboard/painel/components/painel-meta.tsx) |
| A7 | **Semântica "Faturamento Estimado" (P2/P3)** | ✅ Renomeado para **"Valor do Portfólio"** em todo o painel; campo interno `faturamento_estimado` → `valor_portfolio`; ponto de equilíbrio compara explicitamente com o portfólio (prop `valorPortfolio`). (Decisão D3) | [painel-kpis.tsx](app/dashboard/painel/components/painel-kpis.tsx), [painel.ts](app/actions/painel.ts), [painel-equilibrio.tsx](app/dashboard/painel/components/painel-equilibrio.tsx), [painel-alertas.tsx](app/dashboard/painel/components/painel-alertas.tsx) |
| A8 | **Autorização de recebimento via RBAC (P1 · D2)** | A confirmação exige **admin global** OU permissão de **escrita** em `receber`/`transferencias` para a **unidade de destino** (ou todas). Não quebra hoje (todos são admin global pelo seeder); passa a valer p/ perfis restritos. | [transferencia.ts:134-170](app/actions/transferencia.ts) |

**Observações de A3:** `updateReceita`/`updateInsumo` **não** alteram a unidade (para não mover registros sem querer). Registros **antigos** com `unidade_id = NULL` continuam órfãos até o backfill do banco (ver B4). `insumo_preco.unidade_id` segue nulo (a view de custo não usa).

---

## B) Correções de BANCO — propostas (⬜ aplicar + testar manualmente)

> Aplicar via nova migration `supabase/migrations/2026MMDD..._correcoes_auditoria_v2.sql` **depois de revisar** e, idealmente, testar em staging / `supabase db reset`. **Faça backup antes.**

### B1 ⛔ Consolidar RLS (P1) — **DEPENDE DE DECISÃO D1**
Hoje as tabelas core têm políticas **por unidade** (gen 1) **e por empresa** (gen 2) simultâneas; como são PERMISSIVE, combinam por **OR** e o isolamento por unidade não vale. Escolher **um** caminho:

**Opção 1 — isolar por UNIDADE (alinha com a decisão "dados por unidade"):**
```sql
-- Helper: TODAS as unidades do usuário (não só a primeira)
CREATE OR REPLACE FUNCTION public.fn_user_unidades()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT unidade_id FROM public.usuario_unidade WHERE user_id = auth.uid();
$$;

-- Para CADA tabela (insumo, receita, produto, produto_preco, ...):
-- 1) dropar TODAS as políticas antigas (gen1 por unidade + gen2 por empresa)
-- 2) criar UMA política canônica por unidade. Ex. insumo:
DROP POLICY IF EXISTS insumo_empresa ON public.insumo;
DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.insumo;
DROP POLICY IF EXISTS insert_insumo_unidade ON public.insumo;
DROP POLICY IF EXISTS update_insumo_unidade ON public.insumo;
CREATE POLICY insumo_rls ON public.insumo FOR ALL
  USING      (unidade_id IN (SELECT public.fn_user_unidades()))
  WITH CHECK (unidade_id IN (SELECT public.fn_user_unidades()));
-- (repetir para receita/produto; tabelas-filho via JOIN ao pai, como hoje)
```
**Pré-requisitos:** (a) `usuario_unidade` populada corretamente p/ cada usuário; (b) backfill de `unidade_id` (B4) — senão registros NULL somem para todos. **Risco alto, testar com cada perfil.**

**Opção 2 — isolar por EMPRESA (mais simples/seguro hoje; filtro fino por unidade fica no código):**
```sql
-- Dropar as políticas por UNIDADE e manter só as por empresa. Ex. insumo:
DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.insumo;
DROP POLICY IF EXISTS insert_insumo_unidade ON public.insumo;
DROP POLICY IF EXISTS update_insumo_unidade ON public.insumo;
-- mantém insumo_empresa (já existe)
```
Para `produto`, manter **uma só** política por empresa (`produto_por_empresa`) e dropar `produto_empresa_rls` (duplicada).

> **Verificar antes:** `SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;`

### B2 ⬜ `vw_produto_financeiro` com `security_invoker` idempotente (P1)
Garantir que recriações não percam a propriedade (a migration de 20/06 faz `ALTER VIEW` **antes** de a view existir → aborta em banco limpo). Trocar por bloco com `IF EXISTS`:
```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='vw_produto_financeiro') THEN
    EXECUTE 'ALTER VIEW public.vw_produto_financeiro SET (security_invoker = true)';
  END IF;
END $$;
```

### B3 ⬜ `vw_insumo_custo_atual`: desempate de vigência (P3)
Dois preços com a **mesma** `vigente_desde` duplicam a linha → custo de receita inflado. Reescrever com `DISTINCT ON` mantendo as mesmas colunas:
```sql
CREATE OR REPLACE VIEW public.vw_insumo_custo_atual AS
SELECT DISTINCT ON (ip.insumo_id)
  ip.insumo_id, ip.preco_compra, ip.qtd_uso_por_compra, ip.unidade_compra, ip.vigente_desde,
  CASE WHEN ip.qtd_uso_por_compra > 0 THEN ip.preco_compra / ip.qtd_uso_por_compra ELSE NULL END AS custo_uso
FROM public.insumo_preco ip
ORDER BY ip.insumo_id, ip.vigente_desde DESC, ip.created_at DESC;
```

### B4 ⬜ Backfill de `unidade_id` NULL em insumo/receita (P2)
Pré-requisito da Opção 1 do RLS e da correção A3 para dados antigos:
```sql
UPDATE public.insumo  i SET unidade_id = (SELECT u.id FROM public.unidade u
  WHERE u.empresa_id=i.empresa_id AND u.ativa ORDER BY u.nome LIMIT 1)
  WHERE i.unidade_id IS NULL AND i.empresa_id IS NOT NULL;
UPDATE public.receita r SET unidade_id = (SELECT u.id FROM public.unidade u
  WHERE u.empresa_id=r.empresa_id AND u.ativa ORDER BY u.nome LIMIT 1)
  WHERE r.unidade_id IS NULL AND r.empresa_id IS NOT NULL;
-- conferir: SELECT count(*) FROM insumo WHERE unidade_id IS NULL;  -- deve dar 0
```

### B5 ⬜ Verificar `vw_custo_receita` real (P2)
A definição versionada referencia a CTE recursiva em subquery/agregação ([views_custo.sql:106-145](supabase/migrations/20260618170000_views_custo.sql)) — o Postgres normalmente recusa. Rodar `SELECT pg_get_viewdef('public.vw_custo_receita', true);` para ver a definição **real** em produção e testar uma ficha A→B→C (sub-receita de 2+ níveis). Se a real divergir, **versionar a real**; se a recursão não funcionar, reescrever (ex.: função recursiva ou materialização por níveis).

### B6 ⬜ `NOT NULL` de `empresa_id` (P2)
O `ALTER ... SET NOT NULL` condicional pode nunca aplicar se o backfill falhou. Após confirmar 0 nulos, forçar:
```sql
ALTER TABLE public.produto ALTER COLUMN empresa_id SET NOT NULL; -- idem receita/insumo
```

### B7 ⬜ Reprodutibilidade geral (P1)
Meta: `supabase db reset` num banco limpo passar do zero. Consolidar políticas numa migration canônica, proteger `ALTER VIEW/TABLE` com `IF EXISTS`, e garantir ordem (objeto criado antes de ser alterado).

---

## C) Itens de CÓDIGO ainda pendentes (⬜)

| # | Item (sev) | Nota |
|---|---|---|
| C1 | **Resumo filtrar por empresa (P2)** | [dashboard/page.tsx](app/dashboard/page.tsx) filtra por unidade mas não por empresa selecionada. Cuidado: `vw_insumo_custo_atual` não tem `empresa_id`. Baixa urgência (1 empresa hoje; RLS já limita). |
| C2 | ✅ **Precificadora em lote (P2/P3) — FEITO** | `aplicarLote` agora usa `savePrecoVendaLote` (1 chamada em vez de N). | [painel-precificacao.tsx:46-63](app/dashboard/painel/components/painel-precificacao.tsx) |
| C3 | 🟡 **Ponto de equilíbrio (P2)** | Rótulos agora dizem "Portfólio" e o KPI virou "Valor do Portfólio" (A7), deixando claro que **não** é faturamento. A comparação em si (portfólio × despesa mensal) só se resolve de vez com registro de vendas reais (D3 não escolhido agora). |
| C4 | **Curva ABC: `includes('pendente')` + sem ponderação (P3)** | [dashboard/page.tsx:137](app/dashboard/page.tsx). Trocar por flag/coluna `status` e ponderar por volume quando houver vendas. |
| C5 | **Conversão de unidade (P2)** | Custo de item/sub-receita não converte unidades. Exige decisão de modelagem (sempre kg? tabela de conversão?). |
| C6 | **Cores `red-400`/`emerald-400` vs tokens (P3)** | Unificar para `text-danger`/`text-success` em Preços e Ficha. Cosmético. |

---

## D) DECISÕES DE PRODUTO — respondidas em 21/06/2026

| # | Decisão | Resposta | Situação |
|---|---|---|---|
| D1 | Isolamento de dados | **RBAC granular**: escolher por módulo + empresa/unidade (ex.: Natali admin total; Priscila só "Receber" na Centro). | 🟡 Em andamento — ver bloco abaixo |
| D2 | Quem confirma recebimento | Idealmente via RBAC; senão, só a unidade de destino. | ✅ Implementado via RBAC (A8) |
| D3 | "Faturamento" | Renomear para "Valor do Portfólio". | ✅ Feito (A7) |
| D4 | "Receber" = NFe→custo | Manter Compra simples por ora. | ✅ Nada agora; vira roadmap (E) |

### RBAC granular (D1) — o que já existe e o que falta
**Já existe (✅):** a tabela `permissao(usuario_id, tela, acesso, unidade_id)` suporta exatamente o modelo desejado — `tela='*'`=admin global; `unidade_id=NULL`=todas as unidades; ou uma linha por (módulo, unidade). Um seeder garante que todo usuário existente seja admin global (ninguém é bloqueado por acidente). [rbac_permissoes.sql](supabase/migrations/20260619000000_rbac_permissoes.sql)

**Falta (⬜):**
1. **UI: escolher a unidade por permissão.** Hoje a grade ([permissoes-tab.tsx:111,150](app/dashboard/configuracoes/components/permissoes-tab.tsx)) só edita permissões globais (`unidade_id=null`), e `createUserAction` grava `unidade_id:null` ([permissoes.ts:196](app/actions/permissoes.ts)). Para criar "Priscila → Receber → Centro" pela tela, a grade precisa de uma dimensão de **unidade** (ex.: seletor de unidade por linha, ou uma grade por unidade).
2. **Autorização server-side nas demais ações.** Só o recebimento (A8) já checa permissão no servidor. As outras actions (criar/editar insumo, ficha, preço, transferência, despesa, config) ainda **não** verificam RBAC server-side — o controle é só visual (esconde botões). Criar um helper `assertPermissao(tela, unidadeId, nível)` e aplicá-lo em cada action sensível.
3. **(Opcional) RLS por permissão no banco.** Como o controle fino passará a ser via RBAC nas actions, o RLS das tabelas de dados pode ficar **por empresa** (mais simples/seguro) — ver B1, Opção 2.

---

## E) Features maiores não implementadas (roadmap, ⬜)

- **Pipeline NFe → casar item com insumo → atualizar custo → recalcular fichas** (depende de D4).
- **Produto Fabricado pela UI** (`createProdutoFabricado`) — hoje só via "Importar de Fichas".
- **Modo Consolidado multi-empresa** — hoje desabilitado ("Em breve").
- **Baixa/validação de estoque na origem** ao enviar transferência.
- **Testes da matemática de custo/margem** (hoje só `lib/format.test.ts`).
- **Upload de XML da NFe**.

---

## F) Próximos passos sugeridos (ordem)
1. **UI de permissões por unidade** (D1, item 1) — para você criar a Priscila restrita pela tela.
2. **Helper `assertPermissao` nas server actions** (D1, item 2) — transformar o RBAC em barreira real além do recebimento.
3. **Migrations de banco** B2–B6 (seguras) — revisar + aplicar/testar; RLS (B1) provavelmente **Opção 2 (por empresa)**, já que o controle fino será via RBAC nas actions.
4. C2 (lote na precificadora), C4/C6 (polimento).
5. Planejar E (roadmap NFe→custo) — D4.
