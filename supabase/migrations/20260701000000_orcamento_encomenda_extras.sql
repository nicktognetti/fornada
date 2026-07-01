-- ============================================================
-- Orçamento/Encomenda v2 — status do orçamento, número sequencial,
-- e tabela de clientes (autocomplete). Data: 01/07/2026
-- Padrão RLS por loja (fn_is_admin_global / fn_user_unidades).
-- ============================================================

-- ── Orçamento: status + número ───────────────────────────────
ALTER TABLE public.orcamento
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('aguardando','aprovado','recusado')),
  ADD COLUMN IF NOT EXISTS numero BIGINT;

CREATE SEQUENCE IF NOT EXISTS public.orcamento_numero_seq;
ALTER TABLE public.orcamento ALTER COLUMN numero SET DEFAULT nextval('public.orcamento_numero_seq');
-- Backfill das linhas existentes (ordem de criação)
UPDATE public.orcamento SET numero = nextval('public.orcamento_numero_seq')
  WHERE numero IS NULL;
ALTER TABLE public.orcamento ALTER COLUMN numero SET NOT NULL;

-- ── Encomenda: número ────────────────────────────────────────
ALTER TABLE public.encomenda
  ADD COLUMN IF NOT EXISTS numero BIGINT;

CREATE SEQUENCE IF NOT EXISTS public.encomenda_numero_seq;
ALTER TABLE public.encomenda ALTER COLUMN numero SET DEFAULT nextval('public.encomenda_numero_seq');
UPDATE public.encomenda SET numero = nextval('public.encomenda_numero_seq')
  WHERE numero IS NULL;
ALTER TABLE public.encomenda ALTER COLUMN numero SET NOT NULL;

-- ── Tabela: cliente (por loja) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.cliente (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID        NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  unidade_id  UUID        NOT NULL REFERENCES public.unidade(id) ON DELETE CASCADE,
  nome        TEXT        NOT NULL,
  contato     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_cliente_unidade_nome UNIQUE (unidade_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_cliente_unidade ON public.cliente(unidade_id);

COMMENT ON TABLE public.cliente IS
  'Clientes por loja, alimentado automaticamente ao criar orçamentos/encomendas (autocomplete).';

ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cliente_loja ON public.cliente;
CREATE POLICY cliente_loja ON public.cliente FOR ALL
  USING      (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()))
  WITH CHECK (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()));
