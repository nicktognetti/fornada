-- ============================================================
-- Atendimento — melhorias operacionais (rodada 06/07 noite)
--
--   1. atendimento_loja_info: dados OFICIAIS da loja que o robô
--      pode informar (horários, endereço, pagamento, entrega).
--      Editável na aba "Robô" — sem mexer em código.
--   2. atendimento_canal.avisar_template: nome de template
--      aprovado na Meta para o aviso à equipe (elimina a janela
--      de 24h; template com {{1}} no corpo).
--   3. atendimento_encomenda.impresso_em: controle do agente de
--      impressão local (térmica silenciosa) — marca o que já saiu.
-- ============================================================

-- ── 1. Informações oficiais por loja ─────────────────────────
CREATE TABLE IF NOT EXISTS public.atendimento_loja_info (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID        NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  unidade_id    UUID        NOT NULL UNIQUE REFERENCES public.unidade(id) ON DELETE CASCADE,
  horarios      TEXT,
  endereco      TEXT,
  pagamento     TEXT,
  entrega       TEXT,
  extra         TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.atendimento_loja_info IS
  'Dados oficiais que o robô PODE informar ao cliente (horários, endereço, pagamento, taxa/área de entrega). Vazio = robô confirma com a equipe.';

ALTER TABLE public.atendimento_loja_info ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS atendimento_loja_info_loja ON public.atendimento_loja_info;
CREATE POLICY atendimento_loja_info_loja ON public.atendimento_loja_info FOR ALL
  USING      (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()))
  WITH CHECK (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()));

-- ── 2. Template aprovado para o aviso à equipe ───────────────
ALTER TABLE public.atendimento_canal
  ADD COLUMN IF NOT EXISTS avisar_template TEXT;

COMMENT ON COLUMN public.atendimento_canal.avisar_template IS
  'Nome do template aprovado na Meta (corpo com {{1}}) para o aviso à equipe. NULL = mensagem livre (janela de 24h).';

-- ── 3. Controle do agente de impressão local ─────────────────
ALTER TABLE public.atendimento_encomenda
  ADD COLUMN IF NOT EXISTS impresso_em TIMESTAMPTZ;

COMMENT ON COLUMN public.atendimento_encomenda.impresso_em IS
  'Quando o agente de impressão local imprimiu a comanda (NULL = ainda não saiu na térmica).';

CREATE INDEX IF NOT EXISTS idx_atendimento_encomenda_nao_impresso
  ON public.atendimento_encomenda(unidade_id, criado_em)
  WHERE impresso_em IS NULL;
