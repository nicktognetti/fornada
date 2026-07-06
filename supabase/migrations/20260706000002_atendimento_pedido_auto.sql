-- ============================================================
-- Atendimento: criar encomenda oficial AUTOMATICAMENTE (delivery)
-- Data: 06/07/2026
--
-- Com o toggle ligado no canal, todo pedido anotado pelo robô já
-- vira uma encomenda oficial (sem valor, entrega hoje) no módulo
-- de Encomendas — a equipe só confirma o valor. Liga/desliga por
-- número na aba "Robô". Padrão: DESLIGADO.
-- ============================================================

ALTER TABLE public.atendimento_canal
  ADD COLUMN IF NOT EXISTS pedido_auto BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.atendimento_canal.pedido_auto IS
  'Criar encomenda oficial automaticamente quando o robô anotar um pedido neste canal (pensado para delivery).';
