-- ============================================================
-- Migration: receita_preco + views do painel financeiro
-- Data: 20/06/2026
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Tabela receita_preco
--    Guarda preço de venda por receita (definido manualmente)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.receita_preco (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  receita_id   UUID        NOT NULL REFERENCES public.receita(id) ON DELETE CASCADE,
  preco_venda  NUMERIC(12,4) NOT NULL CHECK (preco_venda > 0),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uk_receita_preco UNIQUE (receita_id)
);

CREATE INDEX IF NOT EXISTS idx_receita_preco_receita
  ON public.receita_preco(receita_id);

ALTER TABLE public.receita_preco ENABLE ROW LEVEL SECURITY;

-- Mesma empresa via receita → empresa_id
CREATE POLICY receita_preco_empresa ON public.receita_preco
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.receita r
      JOIN public.usuario_empresa ue ON ue.empresa_id = r.empresa_id
      WHERE r.id = receita_preco.receita_id
        AND ue.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.receita r
      JOIN public.usuario_empresa ue ON ue.empresa_id = r.empresa_id
      WHERE r.id = receita_preco.receita_id
        AND ue.user_id = auth.uid()
    )
  );

-- Trigger para atualizar atualizado_em
CREATE OR REPLACE TRIGGER trg_receita_preco_atualizado_em
  BEFORE UPDATE ON public.receita_preco
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_atualizado_em();


-- ────────────────────────────────────────────────────────────
-- 2. VIEW vw_painel_financeiro
--    Junta receita + custo (vw_custo_receita) + preço de venda
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.vw_painel_financeiro AS
SELECT
  r.id                                                      AS receita_id,
  r.nome                                                    AS receita_nome,
  r.rendimento,
  r.rendimento_unidade,
  r.unidade_id,
  u.nome                                                    AS unidade_nome,
  COALESCE(vcr.custo_total, 0)                              AS custo_total,
  COALESCE(vcr.custo_unitario, 0)                           AS custo_unitario,
  COALESCE(rp.preco_venda, 0)                               AS preco_venda,
  CASE WHEN COALESCE(rp.preco_venda, 0) > 0
       THEN rp.preco_venda - COALESCE(vcr.custo_total, 0)
       ELSE 0
  END                                                       AS margem_rs,
  CASE WHEN COALESCE(rp.preco_venda, 0) > 0
            AND COALESCE(vcr.custo_total, 0) > 0
       THEN ROUND(
         ((rp.preco_venda - vcr.custo_total) / rp.preco_venda) * 100,
         2)
       ELSE 0
  END                                                       AS margem_percentual,
  CASE WHEN COALESCE(vcr.custo_total, 0) > 0
            AND COALESCE(rp.preco_venda, 0) > 0
       THEN ROUND(
         ((rp.preco_venda - vcr.custo_total) / vcr.custo_total) * 100,
         2)
       ELSE 0
  END                                                       AS markup_percentual
FROM public.receita r
JOIN public.unidade u ON u.id = r.unidade_id
LEFT JOIN public.vw_custo_receita vcr ON vcr.id = r.id
LEFT JOIN public.receita_preco rp ON rp.receita_id = r.id
WHERE r.ativo = true
ORDER BY r.nome;

GRANT SELECT ON public.vw_painel_financeiro TO authenticated;
