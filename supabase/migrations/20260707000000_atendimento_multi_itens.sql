-- ============================================================
-- Atendimento: pedido com VÁRIOS itens
-- Data: 07/07/2026
--
-- "10 pães e 2 bolos" agora vira uma lista estruturada
-- (itens JSONB: [{produto, quantidade}, ...]) além do resumo em
-- texto (colunas produto/quantidade seguem como resumo/compat).
-- "Virar pedido" e o pedido automático criam um item por linha.
-- ============================================================

ALTER TABLE public.atendimento_encomenda
  ADD COLUMN IF NOT EXISTS itens JSONB;

COMMENT ON COLUMN public.atendimento_encomenda.itens IS
  'Itens estruturados do pedido: [{"produto":"...","quantidade":"..."}]. NULL = pedido antigo (usar colunas produto/quantidade).';
