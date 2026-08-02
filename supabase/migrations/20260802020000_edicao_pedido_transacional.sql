-- ============================================================
-- Migration: Hardening Lote 3 — edição de pedido é transacional
-- Ref: AUDITORIA_FORNADA_v3.md §3 (P1-6) e §8 (Lote 3)
--
-- PROBLEMA: editar orçamento/encomenda fazia, em chamadas separadas:
--   1. UPDATE do cabeçalho (com o total novo)
--   2. DELETE de todos os itens
--   3. INSERT dos itens novos
-- Se o passo 3 falhasse (rede, constraint, RLS), o pedido ficava com
-- TOTAL preenchido e ZERO ITENS — e a comanda imprimia vazia.
--
-- SOLUÇÃO: uma função por entidade. Cada requisição PostgREST roda em
-- UMA transação, então um erro em qualquer ponto desfaz tudo.
--
-- SECURITY INVOKER (padrão): a função executa com os direitos de quem
-- chamou, então a RLS por loja continua valendo — não é preciso (nem
-- correto) reimplementar as checagens de posse aqui dentro. A permissão
-- de tela/nível segue sendo validada na Server Action.
-- ============================================================

-- ── Orçamento ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.atualizar_orcamento_com_itens(
  p_id              UUID,
  p_cliente_nome    TEXT,
  p_cliente_contato TEXT,
  p_validade_dias   INT,
  p_observacao      TEXT,
  p_total           NUMERIC,
  p_itens           JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_linhas INT;
BEGIN
  UPDATE public.orcamento SET
    cliente_nome    = p_cliente_nome,
    cliente_contato = p_cliente_contato,
    validade_dias   = p_validade_dias,
    observacao      = p_observacao,
    total           = p_total
  WHERE id = p_id;

  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN
    -- Não existe, ou a RLS escondeu (orçamento de outra loja/empresa).
    RETURN jsonb_build_object('error', 'Orçamento não encontrado');
  END IF;

  DELETE FROM public.orcamento_item WHERE orcamento_id = p_id;

  INSERT INTO public.orcamento_item
    (orcamento_id, produto_id, descricao, quantidade, preco_unitario, subtotal)
  SELECT
    p_id,
    NULLIF(i->>'produto_id', '')::UUID,
    i->>'descricao',
    (i->>'quantidade')::NUMERIC,
    (i->>'preco_unitario')::NUMERIC,
    (i->>'subtotal')::NUMERIC
  FROM jsonb_array_elements(p_itens) AS i;

  RETURN jsonb_build_object('success', true);
END $$;

COMMENT ON FUNCTION public.atualizar_orcamento_com_itens IS
  'Edição atômica do orçamento (cabeçalho + troca de itens). SECURITY INVOKER: '
  'a RLS por loja do chamador continua valendo.';

GRANT EXECUTE ON FUNCTION public.atualizar_orcamento_com_itens(
  UUID, TEXT, TEXT, INT, TEXT, NUMERIC, JSONB
) TO authenticated;

-- ── Encomenda ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.atualizar_encomenda_com_itens(
  p_id              UUID,
  p_cliente_nome    TEXT,
  p_cliente_contato TEXT,
  p_data_entrega    DATE,
  p_hora_entrega    TEXT,
  p_com_valor       BOOLEAN,
  p_rastrear_status BOOLEAN,
  p_observacao      TEXT,
  p_total           NUMERIC,
  p_itens           JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_linhas INT;
BEGIN
  UPDATE public.encomenda SET
    cliente_nome    = p_cliente_nome,
    cliente_contato = p_cliente_contato,
    data_entrega    = p_data_entrega,
    -- a coluna é TIME; o app manda 'HH:MM' como texto
    hora_entrega    = NULLIF(p_hora_entrega, '')::TIME,
    com_valor       = p_com_valor,
    rastrear_status = p_rastrear_status,
    observacao      = p_observacao,
    total           = p_total
  WHERE id = p_id;

  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN
    RETURN jsonb_build_object('error', 'Encomenda não encontrada');
  END IF;

  DELETE FROM public.encomenda_item WHERE encomenda_id = p_id;

  INSERT INTO public.encomenda_item
    (encomenda_id, produto_id, descricao, quantidade, preco_unitario, subtotal, observacao, local)
  SELECT
    p_id,
    NULLIF(i->>'produto_id', '')::UUID,
    i->>'descricao',
    (i->>'quantidade')::NUMERIC,
    (i->>'preco_unitario')::NUMERIC,
    (i->>'subtotal')::NUMERIC,
    NULLIF(i->>'observacao', ''),
    NULLIF(i->>'local', '')
  FROM jsonb_array_elements(p_itens) AS i;

  RETURN jsonb_build_object('success', true);
END $$;

COMMENT ON FUNCTION public.atualizar_encomenda_com_itens IS
  'Edição atômica da encomenda (cabeçalho + troca de itens). SECURITY INVOKER: '
  'a RLS por loja do chamador continua valendo.';

GRANT EXECUTE ON FUNCTION public.atualizar_encomenda_com_itens(
  UUID, TEXT, TEXT, DATE, TEXT, BOOLEAN, BOOLEAN, TEXT, NUMERIC, JSONB
) TO authenticated;

-- ============================================================
-- FIM — Lote 3
-- ============================================================
