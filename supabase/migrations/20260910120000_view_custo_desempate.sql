-- ============================================================
-- Migration: desempate na vw_insumo_custo_atual
-- Data: 10/09/2026 (Auditoria v4, Lote A — achado 1.1)
--
-- Problema: a view casava por vigente_desde = MAX(vigente_desde),
-- e vigente_desde é DATE sem hora. Dois preços do mesmo insumo no
-- mesmo dia (ex.: corrigir um preço digitado errado) viravam DUAS
-- linhas no join — e fn_fornada_custo_receita faz SUM sobre esse
-- join, dobrando a parcela do ingrediente no custo de todas as
-- fichas até o dia seguinte.
--
-- Correção: DISTINCT ON com desempate por created_at/id — sempre
-- exatamente 1 linha por insumo, a mais recente de fato.
-- Mesmas colunas de saída; security_invoker preservado.
-- ============================================================

CREATE OR REPLACE VIEW public.vw_insumo_custo_atual
WITH (security_invoker = true) AS
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
ORDER BY ip.insumo_id, ip.vigente_desde DESC, ip.created_at DESC, ip.id DESC;

COMMENT ON VIEW public.vw_insumo_custo_atual IS
    'Custo vigente por unidade de uso de cada insumo — exatamente 1 linha por insumo. '
    'Desempate de mesma data por created_at (Auditoria v4, 10/09/2026). '
    'custo_uso = preco_compra / qtd_uso_por_compra.';
