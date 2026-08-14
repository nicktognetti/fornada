-- ============================================================
-- Migration: guarda de ciclo no cálculo de custo da receita
-- Data: 14/08/2026
-- Ref: P2-14 da auditoria v3
--
-- PROBLEMA: `fn_fornada_custo_receita` é recursiva e não tem limite de
-- profundidade. O schema não impede ficha A ⊃ B ⊃ A: a detecção de ciclo
-- vive só na aplicação (`hasCycle`, BFS em receitas/actions.ts) — e até
-- hoje ela podia ser burlada pelo `receita_id` vindo do formulário
-- (corrigido no mesmo lote, do lado do TypeScript).
--
-- Um ciclo que entrasse por qualquer via (import, SQL Editor, bug futuro)
-- derrubaria a função com "stack depth limit exceeded" — e como
-- vw_custo_receita e vw_produto_financeiro dependem dela, cairiam JUNTO
-- as telas de Receitas, Preços, Produtos, Painel, Simulador, Resumo e o
-- catálogo do robô. Um dado ruim apagaria meio sistema.
--
-- SOLUÇÃO: carregar o caminho percorrido e parar ao reencontrar um id.
-- Contribuição do ramo cíclico vira 0 em vez de estourar a pilha: o custo
-- fica subestimado naquela ficha (visível e corrigível), em vez de derrubar
-- tudo. Mantém assinatura, STABLE e o mesmo contrato de retorno.
-- ============================================================

-- Versão interna: recebe o caminho já visitado.
CREATE OR REPLACE FUNCTION public.fn_fornada_custo_receita(
  p_receita_id uuid,
  p_visitados  uuid[]
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total numeric := 0;
  v_caminho uuid[] := p_visitados || p_receita_id;
BEGIN
  -- Ciclo: esta receita já está no caminho até aqui.
  IF p_receita_id = ANY(p_visitados) THEN
    RETURN 0;
  END IF;

  -- Rede de segurança para aninhamento absurdo (não é ciclo, mas também
  -- não é receita de padaria — 30 níveis é ordens de grandeza acima do real).
  IF array_length(v_caminho, 1) > 30 THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN ri.insumo_id IS NOT NULL
        THEN ri.quantidade * COALESCE(ica.custo_uso, 0)
      WHEN ri.sub_receita_id IS NOT NULL
        THEN ri.quantidade * (
               public.fn_fornada_custo_receita(ri.sub_receita_id, v_caminho)
               / NULLIF(sub.rendimento, 0)
             )
      ELSE 0
    END
  ), 0)
  INTO v_total
  FROM public.receita_item ri
  LEFT JOIN public.vw_insumo_custo_atual ica ON ica.insumo_id = ri.insumo_id
  LEFT JOIN public.receita               sub ON sub.id        = ri.sub_receita_id
  WHERE ri.receita_id = p_receita_id;

  RETURN v_total;
END $$;

-- Entrada pública: assinatura inalterada, para as views não precisarem mudar.
CREATE OR REPLACE FUNCTION public.fn_fornada_custo_receita(p_receita_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT public.fn_fornada_custo_receita(p_receita_id, ARRAY[]::uuid[]);
$$;

COMMENT ON FUNCTION public.fn_fornada_custo_receita(uuid) IS
  'Custo total de uma receita (insumos diretos + sub-receitas por custo unitário). '
  'Recursiva, com guarda de ciclo: ramo cíclico contribui 0 em vez de estourar a pilha.';

-- ============================================================
-- FIM
-- ============================================================
