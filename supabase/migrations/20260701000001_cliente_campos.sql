-- ============================================================
-- Cliente: mais campos de cadastro. Data: 01/07/2026
-- Telefone/WhatsApp, e-mail, endereço, CPF/CNPJ e observações.
-- Todos opcionais; só "nome" segue obrigatório (e único por loja).
--
-- Estratégia sem downtime: ADICIONA "telefone" e copia de "contato"
-- (não renomeia), então o código antigo e o novo funcionam durante o
-- deploy, em qualquer ordem. A coluna "contato" fica como legado.
-- ============================================================

ALTER TABLE public.cliente
  ADD COLUMN IF NOT EXISTS telefone   TEXT,
  ADD COLUMN IF NOT EXISTS email      TEXT,
  ADD COLUMN IF NOT EXISTS endereco   TEXT,
  ADD COLUMN IF NOT EXISTS documento  TEXT,   -- CPF ou CNPJ
  ADD COLUMN IF NOT EXISTS observacao TEXT;

-- Backfill: aproveita o que já existia no campo "contato".
UPDATE public.cliente SET telefone = contato
  WHERE telefone IS NULL AND contato IS NOT NULL;

COMMENT ON COLUMN public.cliente.telefone   IS 'Celular / WhatsApp do cliente.';
COMMENT ON COLUMN public.cliente.documento  IS 'CPF (pessoa física) ou CNPJ (empresa).';
