-- ============================================================
-- Migration: corrigir constraint status + recriar confirmar_recebimento
-- Data: 20/06/2026
--
-- PROBLEMA 1: constraint ck_transferencia_status não incluía CANCELADA
-- PROBLEMA 2: versão anterior da RPC confirmar_recebimento tentava
--             acessar p.insumo_id que não existe na tabela produto
-- ============================================================

-- 1. Corrigir constraint de status
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

-- 2. Recriar RPC sem dependência em produto.insumo_id
CREATE OR REPLACE FUNCTION public.confirmar_recebimento(
  p_transferencia_id UUID,
  p_usuario_id       UUID,
  p_itens            JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_transferencia   RECORD;
  v_item_input      JSONB;
  v_qtd_recebida    NUMERIC;
  v_tem_divergencia BOOLEAN := false;
  v_status_final    TEXT;
BEGIN
  SELECT * INTO v_transferencia
  FROM public.transferencia
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transferência não encontrada');
  END IF;

  IF v_transferencia.status NOT IN ('EM_TRANSITO', 'PENDENTE') THEN
    RETURN jsonb_build_object('error', 'Transferência já confirmada ou cancelada');
  END IF;

  FOR v_item_input IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_qtd_recebida := COALESCE((v_item_input->>'quantidade_recebida')::NUMERIC, 0);

    IF (v_item_input->>'status_item') IN ('DIFERENCA', 'AUSENTE') THEN
      v_tem_divergencia := true;
    END IF;

    UPDATE public.transferencia_item
    SET
      quantidade_recebida = v_qtd_recebida,
      status_item         = v_item_input->>'status_item',
      motivo_divergencia  = NULLIF(TRIM(COALESCE(v_item_input->>'motivo_divergencia', '')), '')
    WHERE id              = (v_item_input->>'id')::UUID
      AND transferencia_id = p_transferencia_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Item não encontrado: ' || (v_item_input->>'id'));
    END IF;
  END LOOP;

  v_status_final := CASE
    WHEN v_tem_divergencia THEN 'RECEBIDO_COM_DIVERGENCIA'
    ELSE 'RECEBIDO'
  END;

  UPDATE public.transferencia
  SET
    status                 = v_status_final,
    confirmed_at           = now(),
    responsavel_destino_id = p_usuario_id,
    status_financeiro      = 'a_receber'
  WHERE id = p_transferencia_id;

  RETURN jsonb_build_object('success', true, 'status', v_status_final);
END $$;

GRANT EXECUTE ON FUNCTION public.confirmar_recebimento(UUID, UUID, JSONB) TO authenticated;

-- Garantir sequences acessíveis (idempotente)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
