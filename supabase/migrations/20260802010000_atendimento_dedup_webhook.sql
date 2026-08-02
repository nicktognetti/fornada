-- ============================================================
-- Migration: Hardening Lote 2 — idempotência do webhook WhatsApp
-- Ref: AUDITORIA_FORNADA_v3.md §3 (P1-7) e §8 (Lote 2)
--
-- PROBLEMA: o `wamid` (id da mensagem na Meta) nunca era persistido.
-- A Meta reenvia webhooks (timeout, erro de rede, redelivery), e cada
-- reentrega rodava a IA de novo: cliente recebia resposta duplicada,
-- mensagem era salva em dobro e pedido podia ser anotado 2×.
--
-- SOLUÇÃO: tabela de eventos já processados, com o wamid como PK.
-- O webhook tenta inserir ANTES de processar; violação de unicidade
-- (23505) = reentrega → descarta silenciosamente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.atendimento_webhook_evento (
  wamid      TEXT        PRIMARY KEY,
  unidade_id UUID        REFERENCES public.unidade(id) ON DELETE CASCADE,
  canal      TEXT,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Limpeza/diagnóstico por data (a tabela só cresce; ver comentário abaixo).
CREATE INDEX IF NOT EXISTS idx_webhook_evento_criado
  ON public.atendimento_webhook_evento (criado_em);

COMMENT ON TABLE public.atendimento_webhook_evento IS
  'Idempotência do webhook: wamid das mensagens já processadas. Só o service '
  'role (webhook) escreve. Purga sugerida: DELETE WHERE criado_em < now() - 30 days.';

-- RLS ligada SEM policy: nenhum usuário autenticado lê/escreve.
-- O webhook usa service_role, que bypassa RLS.
ALTER TABLE public.atendimento_webhook_evento ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FIM
-- ============================================================
