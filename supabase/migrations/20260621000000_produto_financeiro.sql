-- ============================================================
-- Migration: produto como entidade de 1ª classe
-- Data: 21/06/2026
-- Adapta ao schema real: produto.receita_id (FK direto),
-- produto_preco.preco_praticado (nome de coluna existente)
-- ============================================================

-- ── 1. Evoluir tabela produto (adicionar colunas ausentes) ────────────────────

ALTER TABLE public.produto
  ADD COLUMN IF NOT EXISTS categoria   TEXT,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT now();

-- Trigger updated_at (reusa função já existente fn_set_atualizado_em)
DROP TRIGGER IF EXISTS trg_produto_updated_at ON public.produto;
CREATE TRIGGER trg_produto_updated_at
  BEFORE UPDATE ON public.produto
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_atualizado_em();

-- ── 2. RLS em produto (se ainda não existir) ──────────────────────────────────

ALTER TABLE public.produto ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'produto' AND policyname = 'produto_empresa'
  ) THEN
    CREATE POLICY produto_empresa ON public.produto
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.usuario_empresa ue
          WHERE ue.empresa_id = produto.empresa_id
            AND ue.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.usuario_empresa ue
          WHERE ue.empresa_id = produto.empresa_id
            AND ue.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 3. RLS em produto_preco (se ainda não existir) ────────────────────────────

ALTER TABLE public.produto_preco ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'produto_preco' AND policyname = 'produto_preco_empresa'
  ) THEN
    CREATE POLICY produto_preco_empresa ON public.produto_preco
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.produto p
          JOIN public.usuario_empresa ue ON ue.empresa_id = p.empresa_id
          WHERE p.id = produto_preco.produto_id
            AND ue.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.produto p
          JOIN public.usuario_empresa ue ON ue.empresa_id = p.empresa_id
          WHERE p.id = produto_preco.produto_id
            AND ue.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 4. Popular produto a partir de receitas ativas ────────────────────────────
-- Apenas receitas que NÃO são sub-receitas (usadas como ingrediente por outras)
-- e têm nomes que parecem produtos reais (não começam com "- " que indica rendimento)

-- tipo real na constraint: 'produzido' (não 'fabricado')
INSERT INTO public.produto (nome, tipo, empresa_id, unidade_id, receita_id, ativo)
SELECT DISTINCT ON (r.nome, r.empresa_id)
  r.nome,
  'produzido',
  r.empresa_id,
  r.unidade_id,
  r.id,
  true
FROM public.receita r
WHERE r.ativo = true
  -- Exclui receitas auxiliares (rendimento, sem nome, só números)
  AND r.nome NOT LIKE '- %'
  AND r.nome NOT LIKE '%(sem nome)%'
  AND r.nome NOT LIKE '%RENDIMENTO%'
  AND r.nome NOT SIMILAR TO '[0-9.]+%'
  -- Exclui receitas que são sub-receitas de outras (usadas como ingrediente)
  AND NOT EXISTS (
    SELECT 1 FROM public.receita_item ri
    WHERE ri.sub_receita_id = r.id
  )
ON CONFLICT DO NOTHING;

-- ── 5. VIEW: vw_produto_financeiro ────────────────────────────────────────────
-- Usa produto_preco.preco_praticado (nome real da coluna)

CREATE OR REPLACE VIEW public.vw_produto_financeiro AS
SELECT
  p.id                                  AS produto_id,
  p.nome                                AS produto_nome,
  p.tipo                                AS produto_tipo,
  p.categoria,
  p.empresa_id,
  p.unidade_id,
  u.nome                                AS unidade_nome,
  COALESCE(vcr.custo_total, p.custo_compra, 0)  AS custo_total,
  COALESCE(pp.preco_praticado, 0)       AS preco_venda,
  CASE WHEN COALESCE(pp.preco_praticado, 0) > 0
       THEN pp.preco_praticado - COALESCE(vcr.custo_total, p.custo_compra, 0)
       ELSE 0
  END                                   AS margem_rs,
  CASE WHEN COALESCE(pp.preco_praticado, 0) > 0
            AND COALESCE(vcr.custo_total, p.custo_compra, 0) > 0
       THEN ROUND(
         ((pp.preco_praticado - COALESCE(vcr.custo_total, p.custo_compra, 0))
          / pp.preco_praticado) * 100, 2)
       ELSE 0
  END                                   AS margem_percentual,
  CASE WHEN COALESCE(vcr.custo_total, p.custo_compra, 0) > 0
            AND COALESCE(pp.preco_praticado, 0) > 0
       THEN ROUND(
         ((pp.preco_praticado - COALESCE(vcr.custo_total, p.custo_compra, 0))
          / COALESCE(vcr.custo_total, p.custo_compra, 0)) * 100, 2)
       ELSE 0
  END                                   AS markup_percentual
FROM public.produto p
LEFT JOIN public.unidade u ON u.id = p.unidade_id
LEFT JOIN public.vw_custo_receita vcr ON vcr.id = p.receita_id
LEFT JOIN public.produto_preco pp ON pp.produto_id = p.id
  AND (p.unidade_id IS NULL OR pp.unidade_id = p.unidade_id)
WHERE p.ativo = true
ORDER BY p.nome;

GRANT SELECT ON public.vw_produto_financeiro TO authenticated;

-- ── 6. Migrar preços de receita_preco → produto_preco ─────────────────────────
-- Para produtos que têm receita_id e a receita tem preço em receita_preco

INSERT INTO public.produto_preco (produto_id, unidade_id, preco_praticado, volume_mensal)
SELECT
  p.id,
  COALESCE(p.unidade_id, r.unidade_id),
  rp.preco_venda,
  0
FROM public.produto p
JOIN public.receita_preco rp ON rp.receita_id = p.receita_id
JOIN public.receita r ON r.id = p.receita_id
WHERE p.receita_id IS NOT NULL
  AND COALESCE(p.unidade_id, r.unidade_id) IS NOT NULL
ON CONFLICT (produto_id, unidade_id) DO NOTHING;
