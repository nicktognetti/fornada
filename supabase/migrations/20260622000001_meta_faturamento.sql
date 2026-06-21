-- ============================================================
-- META DE FATURAMENTO por empresa × mês
-- Idempotente
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meta_faturamento (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID         NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  mes_ano      TEXT         NOT NULL,           -- formato 'YYYY-MM'
  valor_manual NUMERIC(14,2),                   -- NULL = usar calculado
  usuario_id   UUID         NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_meta_mes_empresa UNIQUE (empresa_id, mes_ano)
);

-- Trigger de atualizado_em
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_meta_faturamento_updated_at'
  ) THEN
    CREATE TRIGGER trg_meta_faturamento_updated_at
      BEFORE UPDATE ON public.meta_faturamento
      FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();
  END IF;
END $$;

-- RLS
ALTER TABLE public.meta_faturamento ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'meta_faturamento' AND policyname = 'meta_empresa_rls'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY meta_empresa_rls ON public.meta_faturamento
        FOR ALL USING (
          empresa_id IN (
            SELECT ue.empresa_id FROM public.usuario_empresa ue
            WHERE ue.user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;

-- Índice para leitura rápida
CREATE INDEX IF NOT EXISTS idx_meta_faturamento_empresa_mes
  ON public.meta_faturamento(empresa_id, mes_ano DESC);
