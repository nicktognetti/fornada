-- ============================================================
-- Módulo Atendimento — Fase 2: canais Encomendas × Delivery
-- Data: 06/07/2026
--
-- Requisito da Natali: ENCOMENDAS é uma coisa (número de WhatsApp
-- próprio, produtos específicos, retirada com data e horário) e
-- DELIVERY é outra (outro número, praticamente todos os produtos,
-- pediu → já sai para entrega). Tudo separado por unidade.
--
--   1. atendimento_canal: mapeia cada número da Meta
--      (phone_number_id) para (unidade, canal). O webhook usa isso
--      para saber de qual loja/canal a mensagem veio.
--   2. produto: em quais canais o produto é vendido
--      (vende_delivery default TRUE — "praticamente todos";
--       vende_encomenda default FALSE — só os específicos).
--   3. atendimento_conversa/encomenda ganham `canal`
--      (conversa única por unidade+canal+numero) e `endereco`
--      (entrega do delivery).
-- ============================================================

-- ── 1. Canais (números de WhatsApp) por unidade ──────────────
CREATE TABLE IF NOT EXISTS public.atendimento_canal (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID        NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  unidade_id      UUID        NOT NULL REFERENCES public.unidade(id) ON DELETE CASCADE,
  canal           TEXT        NOT NULL CHECK (canal IN ('encomendas', 'delivery')),
  phone_number_id TEXT        NOT NULL UNIQUE,
  numero_exibicao TEXT,
  ativo           BOOLEAN     NOT NULL DEFAULT true,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, canal)
);

COMMENT ON TABLE public.atendimento_canal IS
  'Números de WhatsApp do agente: cada phone_number_id da Meta aponta para (unidade, canal). Cadastro manual/serviço por enquanto.';

ALTER TABLE public.atendimento_canal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS atendimento_canal_loja ON public.atendimento_canal;
CREATE POLICY atendimento_canal_loja ON public.atendimento_canal FOR ALL
  USING      (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()))
  WITH CHECK (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()));

-- ── 2. Em quais canais o produto é vendido ───────────────────
ALTER TABLE public.produto
  ADD COLUMN IF NOT EXISTS vende_delivery  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vende_encomenda BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.produto.vende_delivery IS
  'O agente de DELIVERY pode vender este produto (padrão: sim — praticamente todos).';
COMMENT ON COLUMN public.produto.vende_encomenda IS
  'O agente de ENCOMENDAS pode vender este produto (padrão: não — só os específicos marcados).';

-- ── 3. Canal na conversa e na encomenda anotada ──────────────
ALTER TABLE public.atendimento_conversa
  ADD COLUMN IF NOT EXISTS canal TEXT NOT NULL DEFAULT 'encomendas'
    CHECK (canal IN ('encomendas', 'delivery'));

-- Conversa passa a ser única por (unidade, canal, numero) — o mesmo
-- cliente pode conversar com os dois números da mesma loja.
ALTER TABLE public.atendimento_conversa
  DROP CONSTRAINT IF EXISTS atendimento_conversa_unidade_id_numero_key;
DROP INDEX IF EXISTS atendimento_conversa_unidade_id_numero_key;
CREATE UNIQUE INDEX IF NOT EXISTS uk_atendimento_conversa_unidade_canal_numero
  ON public.atendimento_conversa(unidade_id, canal, numero);

ALTER TABLE public.atendimento_encomenda
  ADD COLUMN IF NOT EXISTS canal    TEXT NOT NULL DEFAULT 'encomendas'
    CHECK (canal IN ('encomendas', 'delivery')),
  ADD COLUMN IF NOT EXISTS endereco TEXT;

COMMENT ON COLUMN public.atendimento_encomenda.endereco IS
  'Endereço de entrega (pedidos do canal delivery). NULL em encomendas para retirada.';

-- ── Verificação ──────────────────────────────────────────────
--   select canal, count(*) from public.atendimento_conversa group by canal;
--   select column_name from information_schema.columns
--     where table_name='produto' and column_name in ('vende_delivery','vende_encomenda');
