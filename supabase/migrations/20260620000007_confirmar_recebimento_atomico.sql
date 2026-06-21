-- ============================================================
-- Migration: tabelas de saldo de insumo + RPC atômica de
--            confirmação de recebimento de transferência
-- Data: 20/06/2026
-- ============================================================

-- ── 1. insumo_saldo ──────────────────────────────────────────
-- Saldo atual de cada insumo por unidade.
CREATE TABLE IF NOT EXISTS public.insumo_saldo (
  insumo_id    UUID        NOT NULL REFERENCES public.insumo(id)   ON DELETE CASCADE,
  unidade_id   UUID        NOT NULL REFERENCES public.unidade(id)  ON DELETE CASCADE,
  saldo        NUMERIC(14,4) NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (insumo_id, unidade_id)
);

CREATE INDEX IF NOT EXISTS idx_insumo_saldo_unidade ON public.insumo_saldo(unidade_id);

ALTER TABLE public.insumo_saldo ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'insumo_saldo' AND policyname = 'insumo_saldo_empresa'
  ) THEN
    CREATE POLICY insumo_saldo_empresa ON public.insumo_saldo
      FOR ALL
      USING (
        unidade_id IN (
          SELECT u.id FROM public.unidade u
          WHERE u.empresa_id IN (SELECT public.fn_get_empresas_usuario())
        )
      );
  END IF;
END $$;

-- ── 2. insumo_saldo_historico ─────────────────────────────────
-- Registro imutável de cada movimentação de saldo.
CREATE TABLE IF NOT EXISTS public.insumo_saldo_historico (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id       UUID        NOT NULL REFERENCES public.insumo(id)   ON DELETE CASCADE,
  unidade_id      UUID        NOT NULL REFERENCES public.unidade(id)  ON DELETE CASCADE,
  tipo            TEXT        NOT NULL, -- 'entrada_transferencia' | 'saida_transferencia' | 'ajuste_manual'
  quantidade      NUMERIC(14,4) NOT NULL,
  saldo_anterior  NUMERIC(14,4) NOT NULL,
  saldo_novo      NUMERIC(14,4) NOT NULL,
  referencia_id   UUID,
  referencia_tipo TEXT,       -- 'transferencia'
  usuario_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saldo_hist_insumo  ON public.insumo_saldo_historico(insumo_id);
CREATE INDEX IF NOT EXISTS idx_saldo_hist_unidade ON public.insumo_saldo_historico(unidade_id);
CREATE INDEX IF NOT EXISTS idx_saldo_hist_ref     ON public.insumo_saldo_historico(referencia_id) WHERE referencia_id IS NOT NULL;

ALTER TABLE public.insumo_saldo_historico ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'insumo_saldo_historico' AND policyname = 'saldo_historico_empresa'
  ) THEN
    CREATE POLICY saldo_historico_empresa ON public.insumo_saldo_historico
      FOR SELECT
      USING (
        unidade_id IN (
          SELECT u.id FROM public.unidade u
          WHERE u.empresa_id IN (SELECT public.fn_get_empresas_usuario())
        )
      );
  END IF;
END $$;

-- ── 3. RPC confirmar_recebimento ─────────────────────────────
-- Executa toda a confirmação de recebimento em uma única
-- transação: atualiza itens, saldo, histórico e status.
-- SECURITY DEFINER para poder ler transferencia_item e escrever
-- em insumo_saldo com as permissões do owner da função.
CREATE OR REPLACE FUNCTION public.confirmar_recebimento(
  p_transferencia_id UUID,
  p_usuario_id       UUID,
  p_itens            JSONB  -- [{id, quantidade_recebida, status_item, motivo_divergencia?}]
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_transferencia RECORD;
  v_item_input    JSONB;
  v_item          RECORD;
  v_saldo_antigo  NUMERIC;
  v_saldo_novo    NUMERIC;
  v_qtd_recebida  NUMERIC;
  v_tem_divergencia BOOLEAN := false;
  v_status_final  TEXT;
BEGIN
  -- Bloquear a transferência para evitar confirmação dupla
  SELECT * INTO v_transferencia
  FROM public.transferencia
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transferência não encontrada');
  END IF;

  IF v_transferencia.status NOT IN ('EM_TRANSITO', 'enviada') THEN
    RETURN jsonb_build_object('error', 'Transferência já confirmada ou cancelada');
  END IF;

  -- Processar cada item do array JSON
  FOR v_item_input IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    -- Buscar o item da transferência (com insumo_id se existir)
    SELECT ti.*, p.insumo_id
    INTO v_item
    FROM public.transferencia_item ti
    LEFT JOIN public.produto p ON p.id = ti.produto_id
    WHERE ti.id = (v_item_input->>'id')::UUID
      AND ti.transferencia_id = p_transferencia_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Item não encontrado: ' || (v_item_input->>'id'));
    END IF;

    v_qtd_recebida := COALESCE((v_item_input->>'quantidade_recebida')::NUMERIC, 0);

    -- Verificar divergência
    IF (v_item_input->>'status_item') IN ('DIFERENCA', 'AUSENTE') THEN
      v_tem_divergencia := true;
    END IF;

    -- Atualizar transferencia_item
    UPDATE public.transferencia_item
    SET
      quantidade_recebida = v_qtd_recebida,
      status_item         = v_item_input->>'status_item',
      motivo_divergencia  = NULLIF(TRIM(COALESCE(v_item_input->>'motivo_divergencia', '')), '')
    WHERE id = (v_item_input->>'id')::UUID;

    -- Atualizar saldo de insumo apenas se houver insumo_id (produto vinculado a insumo)
    -- e houver quantidade recebida > 0
    IF v_item.insumo_id IS NOT NULL AND v_qtd_recebida > 0 THEN
      SELECT COALESCE(saldo, 0) INTO v_saldo_antigo
      FROM public.insumo_saldo
      WHERE insumo_id = v_item.insumo_id
        AND unidade_id = v_transferencia.unidade_destino_id;

      v_saldo_antigo := COALESCE(v_saldo_antigo, 0);
      v_saldo_novo   := v_saldo_antigo + v_qtd_recebida;

      INSERT INTO public.insumo_saldo (insumo_id, unidade_id, saldo, atualizado_em)
      VALUES (v_item.insumo_id, v_transferencia.unidade_destino_id, v_qtd_recebida, now())
      ON CONFLICT (insumo_id, unidade_id)
      DO UPDATE SET
        saldo         = public.insumo_saldo.saldo + v_qtd_recebida,
        atualizado_em = now();

      INSERT INTO public.insumo_saldo_historico (
        insumo_id, unidade_id, tipo, quantidade,
        saldo_anterior, saldo_novo,
        referencia_id, referencia_tipo, usuario_id
      ) VALUES (
        v_item.insumo_id, v_transferencia.unidade_destino_id,
        'entrada_transferencia', v_qtd_recebida,
        v_saldo_antigo, v_saldo_novo,
        p_transferencia_id, 'transferencia', p_usuario_id
      );
    END IF;
  END LOOP;

  -- Definir status final
  v_status_final := CASE WHEN v_tem_divergencia THEN 'RECEBIDO_COM_DIVERGENCIA' ELSE 'RECEBIDO' END;

  UPDATE public.transferencia
  SET
    status                   = v_status_final,
    confirmed_at             = now(),
    responsavel_destino_id   = p_usuario_id,
    status_financeiro        = 'a_receber'
  WHERE id = p_transferencia_id;

  RETURN jsonb_build_object('success', true, 'status', v_status_final);
END $$;

GRANT EXECUTE ON FUNCTION public.confirmar_recebimento(UUID, UUID, JSONB) TO authenticated;
