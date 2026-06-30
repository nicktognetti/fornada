-- ============================================================
-- Módulo de Orçamento — orçamentos por loja (cliente + itens)
-- Data: 30/06/2026
-- Padrão: tabela como config_geral + RLS por LOJA (helpers
-- fn_is_admin_global() / fn_user_unidades() — ver 20260626000001_rls_por_loja.sql)
-- ============================================================

-- ── Tabela: orcamento ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orcamento (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID         NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  unidade_id      UUID         NOT NULL REFERENCES public.unidade(id) ON DELETE CASCADE,
  cliente_nome    TEXT         NOT NULL,
  cliente_contato TEXT,
  validade_dias   INT          NOT NULL DEFAULT 7,
  observacao      TEXT,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orcamento_unidade ON public.orcamento(unidade_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_empresa ON public.orcamento(empresa_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_cliente ON public.orcamento(cliente_nome);

COMMENT ON TABLE public.orcamento IS
  'Orçamentos para clientes, por loja. Itens em orcamento_item. total = soma dos subtotais.';

-- ── Tabela: orcamento_item ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orcamento_item (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id   UUID          NOT NULL REFERENCES public.orcamento(id) ON DELETE CASCADE,
  produto_id     UUID          REFERENCES public.produto(id) ON DELETE SET NULL,
  descricao      TEXT          NOT NULL,
  quantidade     NUMERIC(12,3) NOT NULL,
  preco_unitario NUMERIC(12,2) NOT NULL,
  subtotal       NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orcamento_item_orcamento ON public.orcamento_item(orcamento_id);

COMMENT ON TABLE public.orcamento_item IS
  'Itens de um orçamento. descricao = snapshot do nome do produto (preço pode ter sido ajustado).';

-- ── RLS por loja ─────────────────────────────────────────────
ALTER TABLE public.orcamento      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orcamento_loja ON public.orcamento;
CREATE POLICY orcamento_loja ON public.orcamento FOR ALL
  USING      (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()))
  WITH CHECK (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()));

DROP POLICY IF EXISTS orcamento_item_loja ON public.orcamento_item;
CREATE POLICY orcamento_item_loja ON public.orcamento_item FOR ALL
  USING (public.fn_is_admin_global() OR orcamento_id IN (
    SELECT id FROM public.orcamento WHERE unidade_id IN (SELECT public.fn_user_unidades())))
  WITH CHECK (public.fn_is_admin_global() OR orcamento_id IN (
    SELECT id FROM public.orcamento WHERE unidade_id IN (SELECT public.fn_user_unidades())));

-- ── Verificação ──────────────────────────────────────────────
--   select tablename, policyname from pg_policies where tablename in ('orcamento','orcamento_item');
