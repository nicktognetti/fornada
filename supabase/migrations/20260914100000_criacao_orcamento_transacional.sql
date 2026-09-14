-- ============================================================
-- Migration: criação de orçamento é transacional
-- Complementa 20260802020000 (edição transacional — Lote 3).
--
-- PROBLEMA: criar orçamento fazia, em chamadas separadas:
--   1. INSERT do cabeçalho em `orcamento` (com o total)
--   2. INSERT dos itens em `orcamento_item`
-- Se o passo 2 falhasse (rede, constraint, RLS), ficava um orçamento
-- numerado, com TOTAL preenchido e ZERO ITENS — e a tela mostrava
-- "Orçamento criado, mas erro nos itens" sem desfazer nada.
--
-- SOLUÇÃO: mesma receita da edição — uma função, uma requisição
-- PostgREST, uma transação. Erro em qualquer ponto desfaz tudo,
-- inclusive o cabeçalho.
--
-- SECURITY INVOKER (padrão): a função executa com os direitos de quem
-- chamou, então a RLS por loja continua valendo nos dois INSERTs — não
-- é preciso (nem correto) reimplementar as checagens de posse aqui
-- dentro. Permissão de tela/nível e a escolha de empresa/unidade
-- seguem sendo validadas na Server Action (`criarOrcamento`).
--
-- NUMERAÇÃO: `numero` NÃO é informado no INSERT, exatamente como o
-- código antigo fazia — o banco continua preenchendo pelo mecanismo
-- atual (sequence `orcamento_numero_seq`, cf. 20260701000000).
-- ============================================================

CREATE OR REPLACE FUNCTION public.criar_orcamento_com_itens(
  p_empresa_id      UUID,
  p_unidade_id      UUID,
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
  v_id     UUID;
  v_numero BIGINT;
BEGIN
  -- Guarda do invariante que motivou a função: orçamento sem item não
  -- pode existir. A Server Action já valida, mas aqui é a última linha.
  IF p_itens IS NULL
     OR jsonb_typeof(p_itens) <> 'array'
     OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('error', 'Adicione ao menos um item');
  END IF;

  INSERT INTO public.orcamento
    (empresa_id, unidade_id, cliente_nome, cliente_contato,
     validade_dias, observacao, total)
  VALUES
    (p_empresa_id, p_unidade_id, p_cliente_nome, p_cliente_contato,
     p_validade_dias, p_observacao, p_total)
  RETURNING id, numero INTO v_id, v_numero;

  INSERT INTO public.orcamento_item
    (orcamento_id, produto_id, descricao, quantidade, preco_unitario, subtotal)
  SELECT
    v_id,
    NULLIF(i->>'produto_id', '')::UUID,
    i->>'descricao',
    (i->>'quantidade')::NUMERIC,
    (i->>'preco_unitario')::NUMERIC,
    (i->>'subtotal')::NUMERIC
  FROM jsonb_array_elements(p_itens) AS i;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'numero', v_numero);
END $$;

COMMENT ON FUNCTION public.criar_orcamento_com_itens IS
  'Criação atômica do orçamento (cabeçalho + itens). SECURITY INVOKER: '
  'a RLS por loja do chamador continua valendo. Devolve {success,id,numero} ou {error}.';

GRANT EXECUTE ON FUNCTION public.criar_orcamento_com_itens(
  UUID, UUID, TEXT, TEXT, INT, TEXT, NUMERIC, JSONB
) TO authenticated;

-- ============================================================
-- FIM
-- ============================================================
