-- ============================================================
-- Migration: Hardening Lote 1 (Auditoria v3, 02/08/2026)
-- Fecha os P1 de banco: objetos alcançáveis direto via PostgREST
-- que confiavam apenas na validação das Server Actions.
-- Ref: AUDITORIA_FORNADA_v3.md §3 e §8 (Lote 1)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. P1-1: confirmar_recebimento valida ownership INTERNAMENTE
--    Antes: SECURITY DEFINER sem checagem + p_usuario_id livre.
--    Agora: usa auth.uid(), exige vínculo com a empresa da
--    transferência e RBAC (admin global OU receber/transferencias
--    escrita/admin na unidade de destino).
--    Assinatura mantida por compatibilidade; p_usuario_id é IGNORADO.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.confirmar_recebimento(
  p_transferencia_id UUID,
  p_usuario_id       UUID,
  p_itens            JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_uid             UUID := auth.uid();
  v_transferencia   RECORD;
  v_item_input      JSONB;
  v_qtd_recebida    NUMERIC;
  v_tem_divergencia BOOLEAN := false;
  v_status_final    TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Não autenticado');
  END IF;

  SELECT * INTO v_transferencia
  FROM public.transferencia
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transferência não encontrada');
  END IF;

  -- Ownership: o chamador precisa pertencer à empresa da transferência
  IF NOT EXISTS (
    SELECT 1 FROM public.usuario_empresa ue
    WHERE ue.user_id = v_uid
      AND ue.empresa_id = v_transferencia.empresa_id
  ) THEN
    RETURN jsonb_build_object('error', 'Sem permissão para confirmar esta transferência');
  END IF;

  -- RBAC: admin global OU receber/transferencias (escrita/admin) na unidade destino
  IF NOT EXISTS (
    SELECT 1 FROM public.permissao p
    WHERE p.usuario_id = v_uid
      AND (
        (p.tela = '*' AND p.acesso = 'admin' AND p.unidade_id IS NULL)
        OR (
          p.tela IN ('receber', 'transferencias')
          AND p.acesso IN ('escrita', 'admin')
          AND (p.unidade_id IS NULL OR p.unidade_id = v_transferencia.unidade_destino_id)
        )
      )
  ) THEN
    RETURN jsonb_build_object('error', 'Você não tem permissão para confirmar recebimento nesta unidade');
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
    responsavel_destino_id = v_uid,  -- auth.uid(), não mais o parâmetro
    status_financeiro      = 'a_receber'
  WHERE id = p_transferencia_id;

  RETURN jsonb_build_object('success', true, 'status', v_status_final);
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. P1-2: usuario_unidade — remover self-insert/self-delete
--    A tabela é a BASE do RLS por loja (fn_user_unidades). Com o
--    self-insert, qualquer autenticado se vinculava a qualquer loja
--    via PostgREST. Toda escrita legítima usa service_role (que
--    bypassa RLS), então basta remover as policies permissivas.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS usuario_unidade_insert_admin ON public.usuario_unidade;
DROP POLICY IF EXISTS usuario_unidade_delete_admin ON public.usuario_unidade;
-- (usuario_unidade_select_own permanece: usuário lê os próprios vínculos)

-- ────────────────────────────────────────────────────────────
-- 3. P1-3: fn_listar_usuarios — porta dormente de PII
--    SECURITY DEFINER lendo auth.users sem checagem, sem nenhum
--    uso no app. Remover.
-- ────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.fn_listar_usuarios();

-- ────────────────────────────────────────────────────────────
-- 4. P1-4: views que rodavam como owner (bypassando RLS)
-- ────────────────────────────────────────────────────────────

ALTER VIEW public.vw_insumo_custo_atual SET (security_invoker = true);
DROP VIEW IF EXISTS public.vw_painel_financeiro;  -- morta (0 usos no app) e com GRANT

-- ────────────────────────────────────────────────────────────
-- 5. P2-6: transferencia sem policy DELETE → exclusão retornava
--    "sucesso" com 0 linhas. Espelha a regra da action:
--    mesma empresa + status PENDENTE/CANCELADA.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS transferencia_delete ON public.transferencia;
CREATE POLICY transferencia_delete ON public.transferencia
  FOR DELETE USING (
    public.fn_is_admin_global()
    OR (
      empresa_id IN (SELECT public.fn_get_empresas_usuario())
      AND status IN ('PENDENTE', 'CANCELADA')
    )
  );

DROP POLICY IF EXISTS transferencia_item_delete ON public.transferencia_item;
CREATE POLICY transferencia_item_delete ON public.transferencia_item
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.transferencia t
      WHERE t.id = transferencia_item.transferencia_id
        AND (
          public.fn_is_admin_global()
          OR (
            t.empresa_id IN (SELECT public.fn_get_empresas_usuario())
            AND t.status IN ('PENDENTE', 'CANCELADA')
          )
        )
    )
  );

-- ────────────────────────────────────────────────────────────
-- 6. P2-13: permissao global (unidade_id NULL) — NULLs não
--    conflitam no UNIQUE, então os seeders duplicaram linhas.
--    Dedup (mantém a mais recente) + índice único parcial.
-- ────────────────────────────────────────────────────────────

DELETE FROM public.permissao a
USING public.permissao b
WHERE a.unidade_id IS NULL
  AND b.unidade_id IS NULL
  AND a.usuario_id = b.usuario_id
  AND a.tela = b.tela
  AND a.id <> b.id
  AND (a.criado_em < b.criado_em
       OR (a.criado_em = b.criado_em AND a.id < b.id));

CREATE UNIQUE INDEX IF NOT EXISTS uk_permissao_global
  ON public.permissao (usuario_id, tela)
  WHERE unidade_id IS NULL;

-- ────────────────────────────────────────────────────────────
-- 7. Índices para as queries reais do app (auditoria §5)
--    Obs.: cliente(unidade_id, telefone) fica NÃO-único por ora —
--    pode haver duplicata pré-existente; o índice único entra no
--    Lote 2 junto com o dedup de clientes do webhook.
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_encomenda_unidade_data
  ON public.encomenda (unidade_id, data_entrega);
CREATE INDEX IF NOT EXISTS idx_encomenda_unidade_status
  ON public.encomenda (unidade_id, status);
CREATE INDEX IF NOT EXISTS idx_orcamento_unidade_created
  ON public.orcamento (unidade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cliente_unidade_telefone
  ON public.cliente (unidade_id, telefone)
  WHERE telefone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_atendimento_conversa_unidade_canal
  ON public.atendimento_conversa (unidade_id, canal, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_permissao_usuario_tela
  ON public.permissao (usuario_id, tela);
CREATE INDEX IF NOT EXISTS idx_insumo_unidade_ativo_nome
  ON public.insumo (unidade_id, nome) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_receita_unidade_ativo_nome
  ON public.receita (unidade_id, nome) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_produto_unidade_ativo_nome
  ON public.produto (unidade_id, nome) WHERE ativo;

-- ============================================================
-- FIM — Lote 1
-- ============================================================
