-- Adiciona coluna is_pagadora na unidade para identificar qual loja é responsável
-- pelos pagamentos das transferências (ex: Centro paga as filiais).
-- Substitui a detecção frágil por nome.includes('centro') no código.

ALTER TABLE public.unidade
  ADD COLUMN IF NOT EXISTS is_pagadora BOOLEAN NOT NULL DEFAULT FALSE;

-- Migração de dados: marca como pagadora qualquer unidade cujo nome contenha "centro".
-- Depois de aplicar esta migration, o campo pode ser ajustado manualmente via
-- UPDATE public.unidade SET is_pagadora = TRUE/FALSE WHERE id = '...';
UPDATE public.unidade
  SET is_pagadora = TRUE
  WHERE nome ILIKE '%centro%';
