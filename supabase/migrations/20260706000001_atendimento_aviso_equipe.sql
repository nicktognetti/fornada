-- ============================================================
-- Atendimento: aviso de pedido novo no WhatsApp da equipe
-- Data: 06/07/2026
--
-- Quando o robô anota um pedido/encomenda, pode avisar um número
-- interno da loja ("🛵 Pedido novo: ..."). Liga/desliga POR CANAL
-- e POR UNIDADE (ex.: delivery da Morada avisa, encomendas não).
-- Padrão: DESLIGADO (só mostra na tela do painel).
-- ============================================================

ALTER TABLE public.atendimento_canal
  ADD COLUMN IF NOT EXISTS avisar_ativo  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avisar_numero TEXT;

COMMENT ON COLUMN public.atendimento_canal.avisar_ativo IS
  'Avisar a equipe no WhatsApp quando o robô anotar um pedido neste canal.';
COMMENT ON COLUMN public.atendimento_canal.avisar_numero IS
  'Número de WhatsApp da equipe que recebe o aviso (com DDI, ex: 5511999999999).';
