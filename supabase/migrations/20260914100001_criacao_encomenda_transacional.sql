-- ============================================================
-- Migration: criação de encomenda é transacional
-- Complementa 20260802020000 (edição transacional, Lote 3).
--
-- PROBLEMA: criarEncomenda fazia, em chamadas separadas:
--   1. INSERT em encomenda (cabeçalho, com total)
--   2. INSERT em encomenda_item
--   3. INSERT em encomenda_status_log ('pendente')
-- Se o passo 2 falhasse (rede, constraint, RLS), ficava um cabeçalho
-- ÓRFÃO com total e zero itens — e a comanda saía vazia. Se o passo 3
-- falhasse, a encomenda nascia sem histórico e a tela de acompanhamento
-- não calculava a duração da primeira etapa.
--
-- SOLUÇÃO: uma função, mesma receita da atualizar_encomenda_com_itens.
-- Cada requisição PostgREST roda em UMA transação: erro em qualquer
-- ponto desfaz tudo (cabeçalho, itens e log).
--
-- SECURITY INVOKER (padrão): executa com os direitos de quem chamou, a
-- RLS por loja continua valendo (o WITH CHECK das 3 tabelas barra a
-- gravação em loja que o usuário não tem). A permissão de tela/nível e a
-- resolução de empresa/unidade seguem na Server Action.
--
-- Numeração: `encomenda.numero` continua vindo do DEFAULT
-- nextval('encomenda_numero_seq') — a função não informa a coluna.
--
-- Orçamento de origem (p_orcamento_id): a checagem "existe, é visível
-- para mim (RLS) e é da MESMA loja" entra na transação. O status do
-- orçamento NÃO é alterado — comportamento atual preservado: o aviso
-- "já virou encomenda Nº X" é derivado de encomenda.orcamento_id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.criar_encomenda_com_itens(
  p_empresa_id      UUID,
  p_unidade_id      UUID,
  p_cliente_nome    TEXT,
  p_cliente_contato TEXT,
  p_data_entrega    DATE,
  p_hora_entrega    TEXT,
  p_com_valor       BOOLEAN,
  p_rastrear_status BOOLEAN,
  p_observacao      TEXT,
  p_total           NUMERIC,
  p_orcamento_id    UUID,
  p_itens           JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id       UUID;
  v_numero   BIGINT;
  v_orc_unid UUID;
BEGIN
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('error', 'Adicione ao menos um item');
  END IF;

  -- Origem vem do cliente: confirma que o orçamento existe, é visível para
  -- este usuário (a RLS por loja filtra) e é da MESMA loja da encomenda —
  -- senão dava para amarrar a encomenda a um orçamento de outra loja.
  IF p_orcamento_id IS NOT NULL THEN
    SELECT unidade_id INTO v_orc_unid
      FROM public.orcamento
     WHERE id = p_orcamento_id;
    IF v_orc_unid IS NULL OR v_orc_unid <> p_unidade_id THEN
      RETURN jsonb_build_object('error', 'Orçamento de origem inválido');
    END IF;
  END IF;

  INSERT INTO public.encomenda
    (empresa_id, unidade_id, cliente_nome, cliente_contato, data_entrega,
     hora_entrega, com_valor, rastrear_status, total, observacao,
     orcamento_id, status)
  VALUES
    (p_empresa_id, p_unidade_id, p_cliente_nome, p_cliente_contato, p_data_entrega,
     -- a coluna é TIME; o app manda 'HH:MM' como texto
     NULLIF(p_hora_entrega, '')::TIME, p_com_valor, p_rastrear_status, p_total, p_observacao,
     p_orcamento_id, 'pendente')
  RETURNING id, numero INTO v_id, v_numero;

  INSERT INTO public.encomenda_item
    (encomenda_id, produto_id, descricao, quantidade, preco_unitario, subtotal, observacao, local)
  SELECT
    v_id,
    NULLIF(i->>'produto_id', '')::UUID,
    i->>'descricao',
    (i->>'quantidade')::NUMERIC,
    (i->>'preco_unitario')::NUMERIC,
    (i->>'subtotal')::NUMERIC,
    NULLIF(i->>'observacao', ''),
    NULLIF(i->>'local', '')
  FROM jsonb_array_elements(p_itens) AS i;

  -- Status inicial no histórico (a tela de acompanhamento calcula as
  -- durações a partir dele). changed_by = quem chamou.
  INSERT INTO public.encomenda_status_log
    (empresa_id, unidade_id, encomenda_id, status, changed_by)
  VALUES
    (p_empresa_id, p_unidade_id, v_id, 'pendente', auth.uid());

  RETURN jsonb_build_object('success', true, 'id', v_id, 'numero', v_numero);
END $$;

COMMENT ON FUNCTION public.criar_encomenda_com_itens IS
  'Criação atômica da encomenda (cabeçalho + itens + status_log inicial, com validação '
  'do orçamento de origem). SECURITY INVOKER: a RLS por loja do chamador continua valendo.';

GRANT EXECUTE ON FUNCTION public.criar_encomenda_com_itens(
  UUID, UUID, TEXT, TEXT, DATE, TEXT, BOOLEAN, BOOLEAN, TEXT, NUMERIC, UUID, JSONB
) TO authenticated;

-- ============================================================
-- FIM — criação transacional de encomenda
-- ============================================================
