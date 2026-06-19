-- ============================================================
-- Migration: Tabelas de Compra/NFe
-- Data: 18/06/2026
-- Executar no Supabase SQL Editor
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Tabela: compra
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.compra (
    id          UUID            NOT NULL DEFAULT gen_random_uuid(),
    unidade_id  UUID            NOT NULL REFERENCES public.unidade(id),
    fornecedor  TEXT            NOT NULL,
    data_compra DATE            NOT NULL,
    valor_total DECIMAL(12,2)   NOT NULL,
    observacao  TEXT,
    xml_url     TEXT,                          -- reservado para upload futuro
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_compra PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_compra_unidade
    ON public.compra(unidade_id, data_compra DESC);

COMMENT ON TABLE public.compra IS
    'Registro de compras/NFe por unidade. xml_url reservado para upload real futuro.';


-- ────────────────────────────────────────────────────────────
-- 2. Tabela: compra_item
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.compra_item (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    compra_id       UUID            NOT NULL REFERENCES public.compra(id) ON DELETE CASCADE,
    descricao       TEXT            NOT NULL,
    quantidade      DECIMAL(12,4)   NOT NULL,
    preco_unitario  DECIMAL(12,2)   NOT NULL,
    subtotal        DECIMAL(12,2)
        GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,

    CONSTRAINT pk_compra_item PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_compra_item_compra
    ON public.compra_item(compra_id);

COMMENT ON TABLE public.compra_item IS
    'Itens detalhados de uma compra. Opcional — compra pode ter só valor_total sem itens.';


-- ────────────────────────────────────────────────────────────
-- 3. RLS: compra
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.compra;
DROP POLICY IF EXISTS insert_compra_unidade ON public.compra;
DROP POLICY IF EXISTS update_compra_unidade ON public.compra;
DROP POLICY IF EXISTS delete_compra_unidade ON public.compra;

CREATE POLICY "Usuarios veem apenas registros da propria unidade"
    ON public.compra
    FOR SELECT
    USING (unidade_id = public.get_user_unidade_id());

CREATE POLICY insert_compra_unidade
    ON public.compra
    FOR INSERT
    WITH CHECK (unidade_id = public.get_user_unidade_id());

CREATE POLICY update_compra_unidade
    ON public.compra
    FOR UPDATE
    USING (unidade_id = public.get_user_unidade_id())
    WITH CHECK (unidade_id = public.get_user_unidade_id());

CREATE POLICY delete_compra_unidade
    ON public.compra
    FOR DELETE
    USING (unidade_id = public.get_user_unidade_id());


-- ────────────────────────────────────────────────────────────
-- 4. RLS: compra_item (herda via compra_id)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.compra_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.compra_item;
DROP POLICY IF EXISTS insert_compra_item_unidade ON public.compra_item;
DROP POLICY IF EXISTS delete_compra_item_unidade ON public.compra_item;

CREATE POLICY "Usuarios veem apenas registros da propria unidade"
    ON public.compra_item
    FOR SELECT
    USING (
        compra_id IN (
            SELECT id FROM public.compra
            WHERE unidade_id = public.get_user_unidade_id()
        )
    );

CREATE POLICY insert_compra_item_unidade
    ON public.compra_item
    FOR INSERT
    WITH CHECK (
        compra_id IN (
            SELECT id FROM public.compra
            WHERE unidade_id = public.get_user_unidade_id()
        )
    );

CREATE POLICY delete_compra_item_unidade
    ON public.compra_item
    FOR DELETE
    USING (
        compra_id IN (
            SELECT id FROM public.compra
            WHERE unidade_id = public.get_user_unidade_id()
        )
    );


-- ────────────────────────────────────────────────────────────
-- FIM DA MIGRATION
-- ────────────────────────────────────────────────────────────
