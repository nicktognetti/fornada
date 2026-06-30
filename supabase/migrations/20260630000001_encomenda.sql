-- ============================================================
-- Módulo de Encomendas — pedidos de cliente com prazo + status
-- Data: 30/06/2026
-- Padrão: igual ao orcamento + RLS por LOJA
-- (helpers fn_is_admin_global() / fn_user_unidades())
-- ============================================================

-- ── Tabela: encomenda ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.encomenda (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID          NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  unidade_id      UUID          NOT NULL REFERENCES public.unidade(id) ON DELETE CASCADE,
  cliente_nome    TEXT          NOT NULL,
  cliente_contato TEXT,
  data_entrega    DATE          NOT NULL,
  hora_entrega    TIME,
  status          TEXT          NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','em_producao','pronto','entregue','cancelada')),
  com_valor       BOOLEAN       NOT NULL DEFAULT false,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacao      TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encomenda_unidade ON public.encomenda(unidade_id);
CREATE INDEX IF NOT EXISTS idx_encomenda_data    ON public.encomenda(data_entrega);
CREATE INDEX IF NOT EXISTS idx_encomenda_status  ON public.encomenda(status);

COMMENT ON TABLE public.encomenda IS
  'Encomendas de clientes (pedidos com prazo). Itens em encomenda_item. com_valor=true quando registra preço.';

-- ── Tabela: encomenda_item ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.encomenda_item (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  encomenda_id   UUID          NOT NULL REFERENCES public.encomenda(id) ON DELETE CASCADE,
  produto_id     UUID          REFERENCES public.produto(id) ON DELETE SET NULL,
  descricao      TEXT          NOT NULL,
  quantidade     NUMERIC(12,3) NOT NULL,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacao     TEXT
);

CREATE INDEX IF NOT EXISTS idx_encomenda_item_encomenda ON public.encomenda_item(encomenda_id);

COMMENT ON TABLE public.encomenda_item IS
  'Itens de uma encomenda. observacao = nota de produção do item (ex: "sem lactose").';

-- ── RLS por loja ─────────────────────────────────────────────
ALTER TABLE public.encomenda      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encomenda_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS encomenda_loja ON public.encomenda;
CREATE POLICY encomenda_loja ON public.encomenda FOR ALL
  USING      (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()))
  WITH CHECK (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()));

DROP POLICY IF EXISTS encomenda_item_loja ON public.encomenda_item;
CREATE POLICY encomenda_item_loja ON public.encomenda_item FOR ALL
  USING (public.fn_is_admin_global() OR encomenda_id IN (
    SELECT id FROM public.encomenda WHERE unidade_id IN (SELECT public.fn_user_unidades())))
  WITH CHECK (public.fn_is_admin_global() OR encomenda_id IN (
    SELECT id FROM public.encomenda WHERE unidade_id IN (SELECT public.fn_user_unidades())));
