-- ============================================================
-- Cria as views que o app (repo) precisa e que FALTAM no Fornada:
--   public.fn_custo_total_receita(uuid)   (função recursiva de custo)
--   public.vw_custo_receita
--   public.vw_produto_financeiro
-- Data: 25/06/2026 — confirmado contra o banco do Fornada (slug 'flor-do-trigo').
--
-- CONTEXTO: o Painel/Produtos/Preços do repo consultam vw_produto_financeiro e
-- vw_custo_receita, que NÃO existem neste banco — por isso o Painel aparece vazio
-- ("Nenhum produto ativo"). Esta migration cria as duas, no modelo do repo.
--
-- Substitui a definição RECURSIVA quebrada de vw_custo_receita
-- (20260618170000_views_custo.sql), que o Postgres recusa. Aqui o custo é
-- calculado por uma FUNÇÃO recursiva (suporta sub-receita em qualquer profundidade;
-- ciclos já são barrados na aplicação, em receitas/actions.ts).
--
-- ⚠️ Aplicar com BACKUP. Idempotente (CREATE OR REPLACE). Reaproveita a
--    vw_insumo_custo_atual já existente.
-- ============================================================

-- ── 1. Função recursiva: custo TOTAL de uma receita ──────────────────────────
-- Insumo direto: quantidade × custo_uso.
-- Sub-receita:  quantidade × (custo_total_sub / rendimento_sub)  [= custo unitário da sub].
CREATE OR REPLACE FUNCTION public.fn_custo_total_receita(p_receita_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total numeric := 0;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN ri.insumo_id IS NOT NULL
        THEN ri.quantidade * COALESCE(ica.custo_uso, 0)
      WHEN ri.sub_receita_id IS NOT NULL
        THEN ri.quantidade * (public.fn_custo_total_receita(ri.sub_receita_id) / NULLIF(sub.rendimento, 0))
      ELSE 0
    END
  ), 0)
  INTO v_total
  FROM public.receita_item ri
  LEFT JOIN public.vw_insumo_custo_atual ica ON ica.insumo_id = ri.insumo_id
  LEFT JOIN public.receita               sub ON sub.id        = ri.sub_receita_id
  WHERE ri.receita_id = p_receita_id;

  RETURN v_total;
END $$;

COMMENT ON FUNCTION public.fn_custo_total_receita(uuid) IS
  'Custo total de uma receita (insumos diretos + sub-receitas por custo unitário). Recursiva.';

-- ── 2. vw_custo_receita ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_custo_receita
WITH (security_invoker = true) AS
SELECT
  r.id,
  r.empresa_id,
  r.unidade_id,
  r.nome,
  r.tipo,
  r.rendimento,
  r.rendimento_unidade,
  r.ativo,
  r.observacao,
  c.custo_total,
  CASE WHEN r.rendimento > 0 THEN c.custo_total / r.rendimento ELSE NULL END AS custo_unitario
FROM public.receita r
CROSS JOIN LATERAL (SELECT public.fn_custo_total_receita(r.id) AS custo_total) c;

COMMENT ON VIEW public.vw_custo_receita IS
  'Custo total e unitário de cada receita (custo_unitario = custo_total / rendimento).';

-- ── 3. vw_produto_financeiro ─────────────────────────────────────────────────
-- Observação: a coluna de saída chama-se `custo_total` (contrato do front-end),
-- mas para produto 'produzido' usa o custo UNITÁRIO da receita (custo_total/rendimento),
-- que é o que faz sentido comparar com o preço de venda por unidade. Para 'revenda',
-- usa custo_compra. (custo_embalagem NÃO é somado aqui para evitar dupla contagem
-- quando a embalagem já é um insumo da ficha — revisar caso a caso.)
CREATE OR REPLACE VIEW public.vw_produto_financeiro
WITH (security_invoker = true) AS
SELECT
  p.id                                   AS produto_id,
  p.nome                                 AS produto_nome,
  p.tipo                                 AS produto_tipo,
  p.categoria,
  p.empresa_id,
  p.unidade_id,
  u.nome                                 AS unidade_nome,
  COALESCE(vcr.custo_unitario, p.custo_compra, 0)  AS custo_total,
  COALESCE(pp.preco_praticado, 0)        AS preco_venda,
  CASE WHEN COALESCE(pp.preco_praticado, 0) > 0
       THEN pp.preco_praticado - COALESCE(vcr.custo_unitario, p.custo_compra, 0)
       ELSE 0 END                        AS margem_rs,
  CASE WHEN COALESCE(pp.preco_praticado, 0) > 0
            AND COALESCE(vcr.custo_unitario, p.custo_compra, 0) > 0
       THEN ROUND(((pp.preco_praticado - COALESCE(vcr.custo_unitario, p.custo_compra, 0))
                   / pp.preco_praticado) * 100, 2)
       ELSE 0 END                        AS margem_percentual,
  CASE WHEN COALESCE(vcr.custo_unitario, p.custo_compra, 0) > 0
            AND COALESCE(pp.preco_praticado, 0) > 0
       THEN ROUND(((pp.preco_praticado - COALESCE(vcr.custo_unitario, p.custo_compra, 0))
                   / COALESCE(vcr.custo_unitario, p.custo_compra, 0)) * 100, 2)
       ELSE 0 END                        AS markup_percentual
FROM public.produto p
LEFT JOIN public.unidade       u   ON u.id = p.unidade_id
LEFT JOIN public.vw_custo_receita vcr ON vcr.id = p.receita_id
LEFT JOIN public.produto_preco pp  ON pp.produto_id = p.id
  AND (p.unidade_id IS NULL OR pp.unidade_id = p.unidade_id)
WHERE p.ativo = true
ORDER BY p.nome;

COMMENT ON VIEW public.vw_produto_financeiro IS
  'Linha financeira por produto (custo unitário, preço, margem e markup). '
  'security_invoker=true → respeita o RLS das tabelas base.';

-- ── 4. Permissões ────────────────────────────────────────────────────────────
GRANT SELECT ON public.vw_custo_receita      TO authenticated;
GRANT SELECT ON public.vw_produto_financeiro TO authenticated;

-- ── Verificação pós-aplicação (rodar manualmente) ────────────────────────────
--   select count(*) from public.vw_produto_financeiro;          -- > 0 se houver produtos ativos
--   select produto_nome, custo_total, preco_venda, margem_percentual
--   from public.vw_produto_financeiro order by produto_nome limit 10;
--   select nome, custo_total, custo_unitario from public.vw_custo_receita limit 10;
