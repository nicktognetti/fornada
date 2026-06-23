-- ============================================================
-- CNPJ por loja (unidade) — Fornada
-- Data: 26/06/2026
--
-- Cada loja (Morada do Sol / Centro) tem CNPJ próprio. Adiciona a coluna
-- `documento` na unidade. Aditivo e idempotente — risco baixo.
-- (Preencher os CNPJs em si é cadastro, feito depois pela tela/Configurações.)
-- ============================================================

ALTER TABLE public.unidade
  ADD COLUMN IF NOT EXISTS documento text;

COMMENT ON COLUMN public.unidade.documento IS 'CNPJ da loja/unidade (cada loja tem o seu).';
