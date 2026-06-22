-- ============================================================
-- Correções da auditoria v2 — parte SEGURA (idempotente)
-- Data: 24/06/2026
--
-- ⚠️ REVISAR e TESTAR antes de aplicar em produção. FAÇA BACKUP.
--    Estas migrations NÃO foram testadas contra o banco real
--    (o agente não tinha conexão). Rodar de preferência em staging
--    ou numa branch do Supabase primeiro.
--
-- Conteúdo:
--   1. vw_produto_financeiro com security_invoker (guard idempotente)
--   2. vw_insumo_custo_atual com desempate de vigência (sem custo duplicado)
--   3. Backfill de unidade_id NULL em insumo/receita
--   4. NOT NULL de empresa_id (apenas se não houver nulos)
--
-- A consolidação de RLS por empresa está em
--   20260624000001_consolidar_rls_por_empresa.sql (revisar com cuidado).
--
-- Verificação MANUAL pendente (auditoria §B5): a definição versionada de
-- vw_custo_receita usa CTE recursivo que o Postgres pode recusar. Conferir
-- a definição real em produção e testar sub-receita de 2+ níveis:
--   SELECT pg_get_viewdef('public.vw_custo_receita', true);
-- ============================================================

-- ── 1. security_invoker idempotente ───────────────────────────
-- A view só existe a partir de 20260621; este guard evita abortar
-- em banco limpo (corrige o ALTER VIEW fora de ordem de 20260620000003).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'vw_produto_financeiro'
  ) THEN
    EXECUTE 'ALTER VIEW public.vw_produto_financeiro SET (security_invoker = true)';
  END IF;
END $$;

-- ── 2. vw_insumo_custo_atual: 1 linha por insumo ──────────────
-- Antes: INNER JOIN por MAX(vigente_desde) duplicava o insumo quando
-- havia 2 preços na mesma data → custo de receita inflado.
-- Agora: DISTINCT ON desempata por vigência e created_at. Mesmas colunas.
CREATE OR REPLACE VIEW public.vw_insumo_custo_atual AS
SELECT DISTINCT ON (ip.insumo_id)
    ip.insumo_id,
    ip.preco_compra,
    ip.qtd_uso_por_compra,
    ip.unidade_compra,
    ip.vigente_desde,
    CASE
        WHEN ip.qtd_uso_por_compra > 0
        THEN ip.preco_compra / ip.qtd_uso_por_compra
        ELSE NULL
    END AS custo_uso
FROM public.insumo_preco ip
ORDER BY ip.insumo_id, ip.vigente_desde DESC, ip.created_at DESC;

COMMENT ON VIEW public.vw_insumo_custo_atual IS
  'Custo vigente por unidade de uso de cada insumo (1 linha por insumo; '
  'desempate por vigente_desde DESC, created_at DESC). '
  'custo_uso = preco_compra / qtd_uso_por_compra.';

-- ── 3. Backfill de unidade_id ─────────────────────────────────
-- Registros antigos com unidade_id NULL somem sob o filtro por unidade
-- das telas. Associa cada um à primeira unidade ativa da empresa.
UPDATE public.insumo i
SET unidade_id = (
  SELECT u.id FROM public.unidade u
  WHERE u.empresa_id = i.empresa_id AND u.ativa = true
  ORDER BY u.nome LIMIT 1
)
WHERE i.unidade_id IS NULL
  AND i.empresa_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.unidade u2 WHERE u2.empresa_id = i.empresa_id AND u2.ativa = true);

UPDATE public.receita r
SET unidade_id = (
  SELECT u.id FROM public.unidade u
  WHERE u.empresa_id = r.empresa_id AND u.ativa = true
  ORDER BY u.nome LIMIT 1
)
WHERE r.unidade_id IS NULL
  AND r.empresa_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.unidade u2 WHERE u2.empresa_id = r.empresa_id AND u2.ativa = true);

-- ── 4. NOT NULL de empresa_id (apenas se já não houver nulos) ─
-- Evita abortar em banco com dados parciais; rode o backfill de empresa_id antes.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.insumo  WHERE empresa_id IS NULL) THEN
    ALTER TABLE public.insumo  ALTER COLUMN empresa_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.receita WHERE empresa_id IS NULL) THEN
    ALTER TABLE public.receita ALTER COLUMN empresa_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.produto WHERE empresa_id IS NULL) THEN
    ALTER TABLE public.produto ALTER COLUMN empresa_id SET NOT NULL;
  END IF;
END $$;

-- ── Diagnóstico pós-aplicação (rodar manualmente) ─────────────
--   SELECT count(*) FILTER (WHERE unidade_id IS NULL) AS insumos_sem_unidade  FROM public.insumo;
--   SELECT count(*) FILTER (WHERE unidade_id IS NULL) AS receitas_sem_unidade FROM public.receita;
--   -- Esperado: 0 (quando a empresa tem ao menos 1 unidade ativa).
