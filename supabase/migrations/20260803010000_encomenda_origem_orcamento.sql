-- ============================================================
-- Migration: encomenda guarda de qual orçamento veio
-- Data: 03/08/2026
--
-- Fecha o elo que faltava no fluxo comercial: até aqui, orçamento
-- aprovado NÃO virava encomenda — a Natali redigitava cliente, itens e
-- preços na mão (gap nº 1 do mapeamento de arquitetura).
--
-- A coluna é opcional: encomenda avulsa, do balcão ou vinda do robô
-- segue com orcamento_id NULL. ON DELETE SET NULL porque excluir o
-- orçamento não pode derrubar uma encomenda que já está em produção —
-- ela só perde a referência à origem.
-- ============================================================

ALTER TABLE public.encomenda
  ADD COLUMN IF NOT EXISTS orcamento_id UUID
    REFERENCES public.orcamento(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.encomenda.orcamento_id IS
  'Orçamento que originou esta encomenda (NULL = encomenda avulsa/balcão/robô). '
  'Usado para mostrar "já virou encomenda Nº X" na tela do orçamento e evitar '
  'gerar a mesma encomenda duas vezes.';

-- Consulta típica: "este orçamento já virou encomenda?" (por orcamento_id).
-- Parcial porque a grande maioria das encomendas tem NULL aqui.
CREATE INDEX IF NOT EXISTS idx_encomenda_orcamento
  ON public.encomenda (orcamento_id)
  WHERE orcamento_id IS NOT NULL;

-- ============================================================
-- FIM
-- ============================================================
