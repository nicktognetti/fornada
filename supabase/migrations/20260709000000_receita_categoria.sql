-- Setor/categoria da receita (Confeitaria, Padaria, Salgados…).
-- Texto livre com autocomplete pelas categorias já usadas — o cliente cria os
-- setores dele na mão, sem lista fixa (mesmo desenho da categoria de insumo).
ALTER TABLE public.receita ADD COLUMN IF NOT EXISTS categoria TEXT;
