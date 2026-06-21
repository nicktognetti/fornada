-- ============================================================
-- Migration: config_geral — configurações JSONB por empresa
-- Data: 19/06/2026
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Tabela config_geral
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.config_geral (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID        NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  chave         TEXT        NOT NULL,
  valor         JSONB       NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uk_config_geral_empresa_chave UNIQUE (empresa_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_config_geral_empresa
  ON public.config_geral(empresa_id);

COMMENT ON TABLE public.config_geral IS
  'Configurações genéricas por empresa armazenadas como JSONB. '
  'Chaves conhecidas: tipos_receita, unidades_medida, categorias_insumo.';

COMMENT ON COLUMN public.config_geral.chave IS
  'Slug da configuração. Ex: ''tipos_receita'', ''unidades_medida'', ''categorias_insumo''.';

COMMENT ON COLUMN public.config_geral.valor IS
  'Valor JSONB. Estrutura depende da chave — ex: array de strings ou array de objetos.';


-- ────────────────────────────────────────────────────────────
-- 2. Trigger: atualizar atualizado_em automaticamente
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_set_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_config_geral_atualizado_em
  BEFORE UPDATE ON public.config_geral
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_atualizado_em();


-- ────────────────────────────────────────────────────────────
-- 3. RLS
--    SELECT / INSERT / UPDATE / DELETE apenas para usuários
--    que pertencem à mesma empresa (via usuario_empresa)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.config_geral ENABLE ROW LEVEL SECURITY;

CREATE POLICY config_geral_empresa ON public.config_geral
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.usuario_empresa ue
      WHERE ue.user_id = auth.uid()
        AND ue.empresa_id = config_geral.empresa_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuario_empresa ue
      WHERE ue.user_id = auth.uid()
        AND ue.empresa_id = config_geral.empresa_id
    )
  );
