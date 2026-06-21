-- ============================================================
-- MULTI-EMPRESA: tabela empresa + empresa_id nas tabelas core
-- Idempotente: IF NOT EXISTS em tudo
-- ============================================================

-- ── 1. Tabela empresa ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.empresa (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT        NOT NULL UNIQUE,
  nome       TEXT        NOT NULL,
  documento  TEXT,
  ativa      BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.empresa (slug, nome)
VALUES
  ('flor-do-trigo', 'Flor do Trigo'),
  ('agrindus',      'Agrindus / Letti'),
  ('freshmania',    'Freshmania')
ON CONFLICT (slug) DO NOTHING;

-- ── 2. empresa_id nas tabelas principais ──────────────────────────────────────

ALTER TABLE public.produto       ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.receita       ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.insumo        ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.receita_preco ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);

-- ── 3. Popular empresa_id existente (Flor do Trigo) ──────────────────────────

DO $$
DECLARE v_empresa_id UUID;
BEGIN
  SELECT id INTO v_empresa_id FROM public.empresa WHERE slug = 'flor-do-trigo';
  IF v_empresa_id IS NOT NULL THEN
    UPDATE public.produto       SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    UPDATE public.receita       SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    UPDATE public.insumo        SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    UPDATE public.receita_preco SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  END IF;
END $$;

-- ── 4. NOT NULL após popular ──────────────────────────────────────────────────
-- Apenas se todas as linhas já têm empresa_id (evita erro em banco com dados parciais)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.produto WHERE empresa_id IS NULL LIMIT 1) THEN
    ALTER TABLE public.produto ALTER COLUMN empresa_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.receita WHERE empresa_id IS NULL LIMIT 1) THEN
    ALTER TABLE public.receita ALTER COLUMN empresa_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.insumo WHERE empresa_id IS NULL LIMIT 1) THEN
    ALTER TABLE public.insumo ALTER COLUMN empresa_id SET NOT NULL;
  END IF;
END $$;

-- ── 5. empresa_id em usuario_empresa (já existe, mas garante índice) ──────────
-- A tabela usuario_empresa já tem empresa_id — só adiciona índice se não existir

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'usuario_empresa' AND indexname = 'idx_usuario_empresa_empresa_id'
  ) THEN
    CREATE INDEX idx_usuario_empresa_empresa_id ON public.usuario_empresa(empresa_id);
  END IF;
END $$;

-- ── 6. RLS: produto visível só para empresas do usuário ───────────────────────

ALTER TABLE public.produto ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'produto' AND policyname = 'produto_empresa_rls'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY produto_empresa_rls ON public.produto
        FOR ALL USING (
          empresa_id IN (
            SELECT ue.empresa_id FROM public.usuario_empresa ue
            WHERE ue.user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;
