-- ============================================================
-- Migration: Campos financeiros nas transferências
-- Data: 18/06/2026
-- Executar no Supabase SQL Editor
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Tabela transferencia_item: preco_unitario + subtotal
-- ────────────────────────────────────────────────────────────

ALTER TABLE fornada.transferencia_item
    ADD COLUMN IF NOT EXISTS preco_unitario DECIMAL(12,2) NOT NULL DEFAULT 0;

-- subtotal calculado = quantidade_enviada * preco_unitario
ALTER TABLE fornada.transferencia_item
    ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2)
        GENERATED ALWAYS AS (quantidade_enviada * preco_unitario) STORED;

COMMENT ON COLUMN fornada.transferencia_item.preco_unitario IS
    'Preço unitário do produto no momento da transferência.';
COMMENT ON COLUMN fornada.transferencia_item.subtotal IS
    'Calculado: quantidade_enviada * preco_unitario.';


-- ────────────────────────────────────────────────────────────
-- 2. Tabela transferencia: valor_total + status_financeiro
-- ────────────────────────────────────────────────────────────

ALTER TABLE fornada.transferencia
    ADD COLUMN IF NOT EXISTS valor_total DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE fornada.transferencia
    ADD COLUMN IF NOT EXISTS status_financeiro TEXT NOT NULL DEFAULT 'pendente';

ALTER TABLE fornada.transferencia
    ADD CONSTRAINT IF NOT EXISTS ck_transferencia_status_financeiro
        CHECK (status_financeiro IN ('pendente', 'a_receber', 'recebido', 'cancelado'));

COMMENT ON COLUMN fornada.transferencia.valor_total IS
    'Soma dos subtotais dos itens. Atualizado pela Server Action ao criar/confirmar.';
COMMENT ON COLUMN fornada.transferencia.status_financeiro IS
    'pendente → a_receber (ao confirmar recebimento) → recebido → cancelado.';


-- ────────────────────────────────────────────────────────────
-- FIM DA MIGRATION
--
-- Verificação:
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_schema = 'fornada'
--     AND table_name IN ('transferencia', 'transferencia_item')
--     AND column_name IN ('preco_unitario', 'subtotal', 'valor_total', 'status_financeiro')
--   ORDER BY table_name, column_name;
-- ────────────────────────────────────────────────────────────
