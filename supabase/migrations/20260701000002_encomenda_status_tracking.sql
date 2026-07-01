-- ============================================================
-- Encomenda: acompanhamento de produção opcional + histórico de status.
-- Data: 01/07/2026
--   - rastrear_status: liga/desliga o fluxo de produção por encomenda
--     (ex: revenda de suco não precisa de "produzindo/pronto").
--   - encomenda_status_log: registra cada mudança de status com data/hora,
--     permitindo calcular o tempo em cada etapa.
-- ============================================================

ALTER TABLE public.encomenda
  ADD COLUMN IF NOT EXISTS rastrear_status BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.encomenda_status_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID        NOT NULL REFERENCES public.empresa(id)  ON DELETE CASCADE,
  unidade_id    UUID        NOT NULL REFERENCES public.unidade(id)  ON DELETE CASCADE,
  encomenda_id  UUID        NOT NULL REFERENCES public.encomenda(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by    UUID
);
CREATE INDEX IF NOT EXISTS idx_encomenda_status_log_enc
  ON public.encomenda_status_log(encomenda_id, changed_at);

COMMENT ON TABLE public.encomenda_status_log IS
  'Histórico de mudanças de status da encomenda (para relatório de tempo por etapa).';

ALTER TABLE public.encomenda_status_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS encomenda_status_log_loja ON public.encomenda_status_log;
CREATE POLICY encomenda_status_log_loja ON public.encomenda_status_log FOR ALL
  USING      (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()))
  WITH CHECK (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()));

-- Backfill: uma entrada inicial por encomenda existente (status atual, no created_at).
INSERT INTO public.encomenda_status_log (empresa_id, unidade_id, encomenda_id, status, changed_at)
SELECT e.empresa_id, e.unidade_id, e.id, e.status, e.created_at
FROM public.encomenda e
WHERE NOT EXISTS (
  SELECT 1 FROM public.encomenda_status_log l WHERE l.encomenda_id = e.id
);
