-- ============================================================
-- Migration: Views de custo + RPCs não versionadas
-- Data: 18/06/2026
--
-- Versiona objetos que existiam no banco mas não tinham
-- definição em nenhuma migration anterior:
--
--   public.vw_insumo_custo_atual
--   public.vw_custo_receita
--   fornada.fn_get_user_unidade
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. vw_insumo_custo_atual
--
--    Custo por unidade de uso do insumo, calculado a partir
--    da entrada vigente mais recente de insumo_preco.
--
--    Fórmula: custo_uso = preco_compra / qtd_uso_por_compra
--
--    Campos consumidos pelo front-end:
--      insumo_id  uuid
--      custo_uso  numeric
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.vw_insumo_custo_atual AS
SELECT
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
-- Apenas o registro mais recente por insumo
INNER JOIN (
    SELECT insumo_id, MAX(vigente_desde) AS max_vigente
    FROM public.insumo_preco
    GROUP BY insumo_id
) latest
    ON ip.insumo_id = latest.insumo_id
    AND ip.vigente_desde = latest.max_vigente;

COMMENT ON VIEW public.vw_insumo_custo_atual IS
    'Custo vigente por unidade de uso de cada insumo. '
    'Usa a entrada mais recente de insumo_preco. '
    'custo_uso = preco_compra / qtd_uso_por_compra.';


-- ────────────────────────────────────────────────────────────
-- 2. vw_custo_receita
--
--    Custo total e custo unitário de cada receita.
--    Suporta receitas compostas (sub_receita_id em receita_item).
--
--    Algoritmo (CTE recursivo):
--      a) Nível folha: receitas que só têm insumos diretos.
--         custo_total = SUM(quantidade * custo_uso)
--      b) Níveis superiores: receitas que incluem sub-receitas.
--         custo da sub-receita = custo_unitario_sub * quantidade
--      c) custo_unitario = custo_total / rendimento
--
--    Campos consumidos pelo front-end (select('*')):
--      Todos os campos de public.receita +
--      custo_total    numeric
--      custo_unitario numeric
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.vw_custo_receita AS
WITH RECURSIVE custo_base AS (

    -- ── Âncora: receitas sem dependência em sub-receitas
    --            (apenas insumos diretos)
    SELECT
        r.id,
        COALESCE(
            SUM(ri.quantidade * ica.custo_uso),
            0
        ) AS custo_total
    FROM public.receita r
    LEFT JOIN public.receita_item ri
        ON ri.receita_id = r.id
        AND ri.insumo_id IS NOT NULL
    LEFT JOIN public.vw_insumo_custo_atual ica
        ON ica.insumo_id = ri.insumo_id
    WHERE NOT EXISTS (
        SELECT 1 FROM public.receita_item x
        WHERE x.receita_id = r.id
          AND x.sub_receita_id IS NOT NULL
    )
    GROUP BY r.id

    UNION ALL

    -- ── Recursão: receitas que contêm sub-receitas já calculadas
    SELECT
        r.id,
        COALESCE(
            -- Custo dos insumos diretos desta receita
            (
                SELECT SUM(ri2.quantidade * ica2.custo_uso)
                FROM public.receita_item ri2
                LEFT JOIN public.vw_insumo_custo_atual ica2
                    ON ica2.insumo_id = ri2.insumo_id
                WHERE ri2.receita_id = r.id
                  AND ri2.insumo_id IS NOT NULL
            ), 0
        )
        +
        COALESCE(
            -- Custo das sub-receitas já resolvidas
            (
                SELECT SUM(
                    ri3.quantidade *
                    CASE
                        WHEN sub.rendimento > 0
                        THEN cb.custo_total / sub.rendimento
                        ELSE 0
                    END
                )
                FROM public.receita_item ri3
                JOIN custo_base cb
                    ON cb.id = ri3.sub_receita_id
                JOIN public.receita sub
                    ON sub.id = ri3.sub_receita_id
                WHERE ri3.receita_id = r.id
                  AND ri3.sub_receita_id IS NOT NULL
            ), 0
        ) AS custo_total
    FROM public.receita r
    -- Apenas receitas com sub-receitas
    WHERE EXISTS (
        SELECT 1 FROM public.receita_item x
        WHERE x.receita_id = r.id
          AND x.sub_receita_id IS NOT NULL
    )
    -- Que ainda não foram processadas
    AND NOT EXISTS (
        SELECT 1 FROM custo_base cb WHERE cb.id = r.id
    )
)

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
    COALESCE(cb.custo_total, 0)                          AS custo_total,
    CASE
        WHEN r.rendimento > 0
        THEN COALESCE(cb.custo_total, 0) / r.rendimento
        ELSE NULL
    END                                                  AS custo_unitario
FROM public.receita r
LEFT JOIN custo_base cb ON cb.id = r.id;

COMMENT ON VIEW public.vw_custo_receita IS
    'Custo total e custo unitário de cada receita. '
    'Suporta receitas compostas via CTE recursivo. '
    'custo_unitario = custo_total / rendimento.';


-- ────────────────────────────────────────────────────────────
-- 3. fn_get_user_unidade  (schema: fornada)
--
--    RPC chamada em app/actions/transferencia.ts:
--      supabase.rpc('fn_get_user_unidade', { p_user_id: user.id })
--
--    Retorna { id, nome } da primeira unidade vinculada ao
--    usuário informado via fornada.usuario_unidade.
--
--    Nota: esta função é diferente de public.get_user_unidade_id()
--    (já versionada em 20260618140000_unidade_id_rls.sql):
--      - get_user_unidade_id  → uuid               (sem parâmetro, usa auth.uid())
--      - fn_get_user_unidade  → json {id, nome}     (recebe p_user_id explícito)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fornada.fn_get_user_unidade(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, fornada
AS $$
    SELECT json_build_object('id', u.id, 'nome', u.nome)
    FROM fornada.usuario_unidade uu
    JOIN public.unidade u ON u.id = uu.unidade_id
    WHERE uu.user_id = p_user_id
    ORDER BY uu.created_at
    LIMIT 1;
$$;

COMMENT ON FUNCTION fornada.fn_get_user_unidade(uuid) IS
    'Retorna {id, nome} da unidade padrão do usuário. '
    'Chamada pelo módulo de transferências para pré-preencher origem/destino.';
