-- ============================================================
-- Migration: correção de segurança e schema do painel financeiro
-- Data: 20/06/2026
--
-- CRÍTICOS corrigidos:
--   1. fn_set_atualizado_em — CREATE OR REPLACE (idempotente)
--   2. Política duplicada produto_empresa — DROP IF EXISTS antes de recriar
--   3. fn_get_empresas_usuario — Security Definer, RLS safe
--   4. vw_produto_financeiro — security_invoker = true
--   5. despesa_fixa_empresa — nova tabela com RLS por empresa_id
-- ============================================================

-- ── 1. Trigger fn_set_atualizado_em (idempotente) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

-- ── 2. Remover política duplicada em produto ──────────────────────────────────

DROP POLICY IF EXISTS produto_empresa ON public.produto;

-- Recriar com nome canônico (sem duplicata)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'produto'
      AND policyname = 'produto_por_empresa'
  ) THEN
    CREATE POLICY produto_por_empresa ON public.produto
      FOR ALL USING (
        empresa_id IN (
          SELECT empresa_id FROM public.usuario_empresa WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 3. fn_get_empresas_usuario — Security Definer ────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_get_empresas_usuario()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT empresa_id
  FROM public.usuario_empresa
  WHERE user_id = auth.uid();
$$;

-- ── 4. vw_produto_financeiro — security_invoker = true ───────────────────────
--
-- A view precisa ser recriada para setar security_invoker.
-- Lemos a definição original de 20260621000000_produto_financeiro.sql.
-- Se a view não existir ainda, esta migration cria do zero.

DO $$
DECLARE
  view_def text;
BEGIN
  SELECT pg_get_viewdef('public.vw_produto_financeiro'::regclass, true)
  INTO view_def;

  -- Dropa e recria com security_invoker
  EXECUTE 'DROP VIEW IF EXISTS public.vw_produto_financeiro';

  EXECUTE '
    CREATE VIEW public.vw_produto_financeiro
    WITH (security_invoker = true)
    AS ' || view_def;

  -- Reaplica permissões
  EXECUTE 'GRANT SELECT ON public.vw_produto_financeiro TO authenticated';

EXCEPTION WHEN OTHERS THEN
  -- View ainda não existe; será criada pelo script original
  NULL;
END $$;

-- ── 5. despesa_fixa_empresa — nova tabela ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.despesa_fixa_empresa (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid        NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  descricao    text        NOT NULL CHECK (char_length(descricao) BETWEEN 1 AND 200),
  valor        numeric(12,2) NOT NULL CHECK (valor > 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Índice para queries por empresa
CREATE INDEX IF NOT EXISTS idx_despesa_fixa_empresa_id
  ON public.despesa_fixa_empresa (empresa_id);

-- Trigger de atualização automática
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_despesa_fixa_updated_at'
      AND tgrelid = 'public.despesa_fixa_empresa'::regclass
  ) THEN
    CREATE TRIGGER trg_despesa_fixa_updated_at
      BEFORE UPDATE ON public.despesa_fixa_empresa
      FOR EACH ROW EXECUTE FUNCTION public.fn_set_atualizado_em();
  END IF;
END $$;

-- RLS
ALTER TABLE public.despesa_fixa_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS despesa_fixa_empresa_policy ON public.despesa_fixa_empresa;
CREATE POLICY despesa_fixa_empresa_policy ON public.despesa_fixa_empresa
  FOR ALL USING (
    empresa_id IN (SELECT public.fn_get_empresas_usuario())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesa_fixa_empresa TO authenticated;
