-- ============================================================
-- Migration: criação de transferência é transacional
-- Data: 14/09/2026
--
-- PROBLEMA: criar transferência fazia, em chamadas separadas:
--   1. rpc fn_gerar_codigo_transferencia (consome a sequence)
--   2. INSERT em transferencia (cabeçalho)
--   3. INSERT em transferencia_item
-- Se o passo 3 falhasse (rede, constraint, RLS), ficava um cabeçalho
-- EM_TRANSITO sem item nenhum, e o re-clique do operador criava outra
-- transferência — duas com o mesmo conteúdo, códigos diferentes.
--
-- SOLUÇÃO: uma função, mesma receita de atualizar_*_com_itens
-- (20260802020000). Cada requisição PostgREST roda em UMA transação:
-- erro em qualquer ponto desfaz cabeçalho e itens juntos.
--
-- SECURITY INVOKER (padrão): executa com os direitos de quem chamou,
-- então a RLS continua valendo — transferencia_insert exige empresa do
-- usuário E responsavel_origem_id = auth.uid(); transferencia_item_insert
-- exige transferência da empresa do usuário. Por isso responsavel_origem_id
-- NÃO é parâmetro: é sempre auth.uid().
-- A geração do código (fn_gerar_codigo_transferencia, SECURITY DEFINER
-- por causa das sequences) é chamada aqui dentro, DEPOIS de todas as
-- validações — assim erro de negócio não gasta número. Constraint que
-- estoure no INSERT ainda consome o nextval (sequence não faz rollback
-- no Postgres); a numeração pode ter buraco, nunca duplicata.
--
-- RBAC dentro da função espelha app/lib/authz-core.ts (avaliaAcesso):
-- admin global (tela '*', admin, unidade null) OU tela 'transferencias'
-- com acesso escrita/admin, global ou na unidade de ORIGEM. A Server
-- Action continua checando antes de chamar; aqui é a segunda trava, para
-- quem chegar direto pelo PostgREST.
-- ============================================================

CREATE OR REPLACE FUNCTION public.criar_transferencia_com_itens(
  p_empresa_id         UUID,
  p_unidade_origem_id  UUID,
  p_unidade_destino_id UUID,
  p_tipo               VARCHAR,
  p_observacao         TEXT,
  p_itens              JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_observacao  TEXT := NULLIF(btrim(p_observacao), '');
  v_codigo      VARCHAR(20);
  v_id          UUID;
  v_valor_total NUMERIC(12,2);
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Não autenticado');
  END IF;

  -- ── Validações de negócio (antes de gastar código) ──────────
  IF p_tipo NOT IN ('TRANSFERENCIA', 'DEVOLUCAO') THEN
    RETURN jsonb_build_object('error', 'Tipo inválido: use TRANSFERENCIA ou DEVOLUCAO');
  END IF;

  IF p_empresa_id IS NULL OR p_unidade_origem_id IS NULL OR p_unidade_destino_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Empresa, unidade de origem e de destino são obrigatórias');
  END IF;

  IF p_unidade_origem_id = p_unidade_destino_id THEN
    RETURN jsonb_build_object('error', 'Unidade de origem e destino devem ser diferentes');
  END IF;

  IF p_tipo = 'DEVOLUCAO' AND v_observacao IS NULL THEN
    RETURN jsonb_build_object('error', 'Informe o motivo da devolução');
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('error', 'Adicione pelo menos um item');
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_itens) AS i
    WHERE NULLIF(i->>'produto_id', '') IS NULL
       OR COALESCE((i->>'quantidade_enviada')::NUMERIC, 0) <= 0
  ) THEN
    RETURN jsonb_build_object('error', 'Todo item precisa de produto e quantidade maior que zero');
  END IF;

  -- ── Posse: o chamador pertence à empresa informada ──────────
  IF NOT EXISTS (
    SELECT 1 FROM public.usuario_empresa ue
    WHERE ue.user_id = v_uid AND ue.empresa_id = p_empresa_id
  ) THEN
    RETURN jsonb_build_object('error', 'Sem permissão para criar transferências nesta empresa');
  END IF;

  -- ── RBAC: mesma regra de temAcesso(user, ['transferencias'], {unidadeId: origem}) ──
  IF NOT EXISTS (
    SELECT 1 FROM public.permissao p
    WHERE p.usuario_id = v_uid
      AND (
        (p.tela = '*' AND p.acesso = 'admin' AND p.unidade_id IS NULL)
        OR (
          p.tela = 'transferencias'
          AND p.acesso IN ('escrita', 'admin')
          AND (p.unidade_id IS NULL OR p.unidade_id = p_unidade_origem_id)
        )
      )
  ) THEN
    RETURN jsonb_build_object('error', 'Sem permissão para criar transferências nesta unidade');
  END IF;

  -- ── Total do cabeçalho = soma dos itens (fonte única) ───────
  SELECT ROUND(SUM(
           (i->>'quantidade_enviada')::NUMERIC
           * COALESCE((i->>'preco_unitario')::NUMERIC, 0)
         ), 2)
  INTO v_valor_total
  FROM jsonb_array_elements(p_itens) AS i;

  -- ── Código só agora: tudo validado ──────────────────────────
  v_codigo := public.fn_gerar_codigo_transferencia(p_tipo);

  INSERT INTO public.transferencia (
    empresa_id, unidade_origem_id, unidade_destino_id, tipo, codigo, status,
    responsavel_origem_id, observacao, valor_total, status_financeiro
  ) VALUES (
    p_empresa_id, p_unidade_origem_id, p_unidade_destino_id, p_tipo, v_codigo, 'EM_TRANSITO',
    v_uid, v_observacao, COALESCE(v_valor_total, 0), 'pendente'
  )
  RETURNING id INTO v_id;

  INSERT INTO public.transferencia_item
    (transferencia_id, produto_id, quantidade_enviada, preco_unitario, status_item)
  SELECT
    v_id,
    (i->>'produto_id')::UUID,
    (i->>'quantidade_enviada')::NUMERIC,
    COALESCE((i->>'preco_unitario')::NUMERIC, 0),
    'PENDENTE'
  FROM jsonb_array_elements(p_itens) AS i;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'codigo', v_codigo);
END $$;

COMMENT ON FUNCTION public.criar_transferencia_com_itens IS
  'Criação atômica de transferência (código + cabeçalho + itens). SECURITY INVOKER: '
  'a RLS do chamador continua valendo; responsavel_origem_id é sempre auth.uid(). '
  'Retorna {success,id,codigo} ou {error}.';

GRANT EXECUTE ON FUNCTION public.criar_transferencia_com_itens(
  UUID, UUID, UUID, VARCHAR, TEXT, JSONB
) TO authenticated;

-- ============================================================
-- FIM
-- ============================================================
