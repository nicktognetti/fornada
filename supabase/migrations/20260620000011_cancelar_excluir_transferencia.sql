-- ============================================================
-- Migration: adicionar status CANCELADA + permissões
-- Data: 20/06/2026
-- ============================================================

-- Adicionar CANCELADA ao check constraint (idempotente via recreate)
ALTER TABLE public.transferencia
  DROP CONSTRAINT IF EXISTS ck_transferencia_status;

ALTER TABLE public.transferencia
  ADD CONSTRAINT ck_transferencia_status
    CHECK (status IN (
      'PENDENTE',
      'EM_TRANSITO',
      'RECEBIDO',
      'RECEBIDO_COM_DIVERGENCIA',
      'CANCELADA'
    ));

-- Garantir sequences acessíveis (idempotente)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
