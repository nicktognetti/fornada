-- ============================================================
-- Migration: unidade_id nas tabelas core + RLS por unidade
-- Data: 18/06/2026
-- Executar no Supabase SQL Editor
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Função helper: get_user_unidade_id()
--    Retorna a unidade padrão do usuário autenticado
--    (primeiro registro em fornada.usuario_unidade).
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_unidade_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT unidade_id
    FROM fornada.usuario_unidade
    WHERE user_id = auth.uid()
    ORDER BY created_at
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_unidade_id() IS
    'Retorna a unidade_id padrão do usuário autenticado via fornada.usuario_unidade.';


-- ────────────────────────────────────────────────────────────
-- 2. Tabela: insumo
--    Adiciona unidade_id com fallback na primeira unidade
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.insumo
    ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidade(id);

-- TODO: revisar unidade_id manualmente
UPDATE public.insumo
SET unidade_id = (SELECT id FROM public.unidade ORDER BY created_at LIMIT 1)
WHERE unidade_id IS NULL;

ALTER TABLE public.insumo
    ALTER COLUMN unidade_id SET NOT NULL;


-- ────────────────────────────────────────────────────────────
-- 3. Tabela: insumo_preco
--    Já existe campo unidade_id nullable no tipo TS —
--    garante que a coluna existe no banco e tem FK correto.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.insumo_preco
    ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidade(id);

-- TODO: revisar unidade_id manualmente
UPDATE public.insumo_preco
SET unidade_id = (
    SELECT i.unidade_id
    FROM public.insumo i
    WHERE i.id = insumo_preco.insumo_id
)
WHERE unidade_id IS NULL;

-- insumo_preco mantém unidade_id nullable (compatível com tipo TS existente)


-- ────────────────────────────────────────────────────────────
-- 4. Tabela: receita
--    Adiciona unidade_id com fallback na primeira unidade
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.receita
    ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidade(id);

-- TODO: revisar unidade_id manualmente
UPDATE public.receita
SET unidade_id = (SELECT id FROM public.unidade ORDER BY created_at LIMIT 1)
WHERE unidade_id IS NULL;

ALTER TABLE public.receita
    ALTER COLUMN unidade_id SET NOT NULL;


-- ────────────────────────────────────────────────────────────
-- 5. Tabela: produto
--    Adiciona unidade_id com fallback na primeira unidade
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.produto
    ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidade(id);

-- TODO: revisar unidade_id manualmente
UPDATE public.produto
SET unidade_id = (SELECT id FROM public.unidade ORDER BY created_at LIMIT 1)
WHERE unidade_id IS NULL;

ALTER TABLE public.produto
    ALTER COLUMN unidade_id SET NOT NULL;


-- ────────────────────────────────────────────────────────────
-- 6. Índices para as novas colunas
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_insumo_unidade
    ON public.insumo(unidade_id);

CREATE INDEX IF NOT EXISTS idx_insumo_preco_unidade
    ON public.insumo_preco(unidade_id);

CREATE INDEX IF NOT EXISTS idx_receita_unidade
    ON public.receita(unidade_id);

CREATE INDEX IF NOT EXISTS idx_produto_unidade
    ON public.produto(unidade_id);


-- ────────────────────────────────────────────────────────────
-- 7. RLS: insumo
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.insumo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.insumo;
DROP POLICY IF EXISTS select_insumo_unidade ON public.insumo;
DROP POLICY IF EXISTS insert_insumo_unidade ON public.insumo;
DROP POLICY IF EXISTS update_insumo_unidade ON public.insumo;

CREATE POLICY "Usuarios veem apenas registros da propria unidade"
    ON public.insumo
    FOR SELECT
    USING (unidade_id = public.get_user_unidade_id());

CREATE POLICY insert_insumo_unidade
    ON public.insumo
    FOR INSERT
    WITH CHECK (unidade_id = public.get_user_unidade_id());

CREATE POLICY update_insumo_unidade
    ON public.insumo
    FOR UPDATE
    USING (unidade_id = public.get_user_unidade_id())
    WITH CHECK (unidade_id = public.get_user_unidade_id());


-- ────────────────────────────────────────────────────────────
-- 8. RLS: insumo_preco
--    Herda acesso via insumo_id → insumo.unidade_id
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.insumo_preco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.insumo_preco;
DROP POLICY IF EXISTS select_insumo_preco_unidade ON public.insumo_preco;
DROP POLICY IF EXISTS insert_insumo_preco_unidade ON public.insumo_preco;

CREATE POLICY "Usuarios veem apenas registros da propria unidade"
    ON public.insumo_preco
    FOR SELECT
    USING (
        insumo_id IN (
            SELECT id FROM public.insumo
            WHERE unidade_id = public.get_user_unidade_id()
        )
    );

CREATE POLICY insert_insumo_preco_unidade
    ON public.insumo_preco
    FOR INSERT
    WITH CHECK (
        insumo_id IN (
            SELECT id FROM public.insumo
            WHERE unidade_id = public.get_user_unidade_id()
        )
    );


-- ────────────────────────────────────────────────────────────
-- 9. RLS: receita
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.receita ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.receita;
DROP POLICY IF EXISTS select_receita_unidade ON public.receita;
DROP POLICY IF EXISTS insert_receita_unidade ON public.receita;
DROP POLICY IF EXISTS update_receita_unidade ON public.receita;

CREATE POLICY "Usuarios veem apenas registros da propria unidade"
    ON public.receita
    FOR SELECT
    USING (unidade_id = public.get_user_unidade_id());

CREATE POLICY insert_receita_unidade
    ON public.receita
    FOR INSERT
    WITH CHECK (unidade_id = public.get_user_unidade_id());

CREATE POLICY update_receita_unidade
    ON public.receita
    FOR UPDATE
    USING (unidade_id = public.get_user_unidade_id())
    WITH CHECK (unidade_id = public.get_user_unidade_id());


-- ────────────────────────────────────────────────────────────
-- 10. RLS: receita_item
--     Herda acesso via receita_id → receita.unidade_id
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.receita_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.receita_item;
DROP POLICY IF EXISTS select_receita_item_unidade ON public.receita_item;
DROP POLICY IF EXISTS insert_receita_item_unidade ON public.receita_item;
DROP POLICY IF EXISTS update_receita_item_unidade ON public.receita_item;
DROP POLICY IF EXISTS delete_receita_item_unidade ON public.receita_item;

CREATE POLICY "Usuarios veem apenas registros da propria unidade"
    ON public.receita_item
    FOR SELECT
    USING (
        receita_id IN (
            SELECT id FROM public.receita
            WHERE unidade_id = public.get_user_unidade_id()
        )
    );

CREATE POLICY insert_receita_item_unidade
    ON public.receita_item
    FOR INSERT
    WITH CHECK (
        receita_id IN (
            SELECT id FROM public.receita
            WHERE unidade_id = public.get_user_unidade_id()
        )
    );

CREATE POLICY update_receita_item_unidade
    ON public.receita_item
    FOR UPDATE
    USING (
        receita_id IN (
            SELECT id FROM public.receita
            WHERE unidade_id = public.get_user_unidade_id()
        )
    )
    WITH CHECK (
        receita_id IN (
            SELECT id FROM public.receita
            WHERE unidade_id = public.get_user_unidade_id()
        )
    );

CREATE POLICY delete_receita_item_unidade
    ON public.receita_item
    FOR DELETE
    USING (
        receita_id IN (
            SELECT id FROM public.receita
            WHERE unidade_id = public.get_user_unidade_id()
        )
    );


-- ────────────────────────────────────────────────────────────
-- 11. RLS: produto
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.produto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.produto;
DROP POLICY IF EXISTS select_produto_unidade ON public.produto;
DROP POLICY IF EXISTS insert_produto_unidade ON public.produto;
DROP POLICY IF EXISTS update_produto_unidade ON public.produto;

CREATE POLICY "Usuarios veem apenas registros da propria unidade"
    ON public.produto
    FOR SELECT
    USING (unidade_id = public.get_user_unidade_id());

CREATE POLICY insert_produto_unidade
    ON public.produto
    FOR INSERT
    WITH CHECK (unidade_id = public.get_user_unidade_id());

CREATE POLICY update_produto_unidade
    ON public.produto
    FOR UPDATE
    USING (unidade_id = public.get_user_unidade_id())
    WITH CHECK (unidade_id = public.get_user_unidade_id());


-- ────────────────────────────────────────────────────────────
-- 12. RLS: produto_preco
--     Herda acesso via produto_id → produto.unidade_id
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.produto_preco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.produto_preco;
DROP POLICY IF EXISTS select_produto_preco_unidade ON public.produto_preco;
DROP POLICY IF EXISTS insert_produto_preco_unidade ON public.produto_preco;
DROP POLICY IF EXISTS update_produto_preco_unidade ON public.produto_preco;

CREATE POLICY "Usuarios veem apenas registros da propria unidade"
    ON public.produto_preco
    FOR SELECT
    USING (
        produto_id IN (
            SELECT id FROM public.produto
            WHERE unidade_id = public.get_user_unidade_id()
        )
    );

CREATE POLICY insert_produto_preco_unidade
    ON public.produto_preco
    FOR INSERT
    WITH CHECK (
        produto_id IN (
            SELECT id FROM public.produto
            WHERE unidade_id = public.get_user_unidade_id()
        )
    );

CREATE POLICY update_produto_preco_unidade
    ON public.produto_preco
    FOR UPDATE
    USING (
        produto_id IN (
            SELECT id FROM public.produto
            WHERE unidade_id = public.get_user_unidade_id()
        )
    )
    WITH CHECK (
        produto_id IN (
            SELECT id FROM public.produto
            WHERE unidade_id = public.get_user_unidade_id()
        )
    );


-- ────────────────────────────────────────────────────────────
-- FIM DA MIGRATION
--
-- Verificação pós-execução:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND column_name = 'unidade_id'
--   ORDER BY table_name;
--
--   SELECT tablename, policyname
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
-- ────────────────────────────────────────────────────────────
