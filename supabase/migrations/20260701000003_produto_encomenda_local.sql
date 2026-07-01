-- ============================================================
-- Campo "Local" (setor de produção). Data: 01/07/2026
--   - produto.local: onde o produto é feito (Produção, Confeitaria, Cozinha…).
--   - encomenda_item.local: snapshot do local no item da encomenda, para a
--     comanda sair agrupada/separada por setor na impressão.
-- A lista de locais é cadastrável em Cadastros (config_geral, sem migration).
-- ============================================================

ALTER TABLE public.produto
  ADD COLUMN IF NOT EXISTS local TEXT;

ALTER TABLE public.encomenda_item
  ADD COLUMN IF NOT EXISTS local TEXT;

COMMENT ON COLUMN public.produto.local        IS 'Setor de produção do produto (Produção, Confeitaria, Cozinha…).';
COMMENT ON COLUMN public.encomenda_item.local IS 'Setor do item na comanda (herdado do produto, editável).';
