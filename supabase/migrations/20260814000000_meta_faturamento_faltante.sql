-- ============================================================
-- Migration: cria meta_faturamento, que nunca existiu no banco
-- Data: 14/08/2026
--
-- PROBLEMA: `20260622000001_meta_faturamento.sql` consta como APLICADA no
-- histórico (local e remoto), mas a tabela NÃO existe em produção — foi
-- marcada como aplicada sem ter rodado. Descoberto em 14/08 ao exportar
-- os dados para backup: `Could not find the table 'public.meta_faturamento'`.
--
-- IMPACTO ATIVO: `getMetaFaturamento` (app/actions/empresa.ts:125) não checa
-- o erro, então a leitura degrada em silêncio e o Painel cai na meta
-- automática. Mas `salvarMetaManual` e `limparMetaManual` (:168, :192)
-- QUEBRAM — definir a meta do mês no Painel simplesmente não funciona.
--
-- É o 4º drift entre migrations e banco real (ver docs/baseline-migrations.md).
-- Conteúdo idêntico ao da migration original, que é idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meta_faturamento (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID         NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  mes_ano       TEXT         NOT NULL,           -- 'YYYY-MM'
  valor_manual  NUMERIC(14,2),                   -- NULL = usar a meta calculada
  usuario_id    UUID         NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uk_meta_mes_empresa UNIQUE (empresa_id, mes_ano)
);

-- Trigger de atualizado_em (só se a função existir e o trigger ainda não)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_atualizado_em')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_meta_faturamento_updated_at')
  THEN
    CREATE TRIGGER trg_meta_faturamento_updated_at
      BEFORE UPDATE ON public.meta_faturamento
      FOR EACH ROW EXECUTE FUNCTION public.fn_set_atualizado_em();
  END IF;
END $$;

ALTER TABLE public.meta_faturamento ENABLE ROW LEVEL SECURITY;

-- Escopo por EMPRESA (a meta é do negócio, não de uma loja).
DROP POLICY IF EXISTS meta_empresa_rls ON public.meta_faturamento;
CREATE POLICY meta_empresa_rls ON public.meta_faturamento
  FOR ALL
  USING (
    empresa_id IN (
      SELECT ue.empresa_id FROM public.usuario_empresa ue WHERE ue.user_id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT ue.empresa_id FROM public.usuario_empresa ue WHERE ue.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_meta_faturamento_empresa_mes
  ON public.meta_faturamento (empresa_id, mes_ano DESC);

-- ============================================================
-- FIM
-- ============================================================
