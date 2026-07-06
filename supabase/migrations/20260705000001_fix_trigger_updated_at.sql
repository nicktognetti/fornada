-- ============================================================
-- Fix: triggers de updated_at quebrados em produto e despesa_fixa_empresa
-- Data: 05/07/2026
--
-- Bug (pré-existente, descoberto ao testar o toggle tem/acabou do
-- módulo Atendimento): `trg_produto_updated_at` e
-- `trg_despesa_fixa_updated_at` executam fn_set_atualizado_em(), que faz
-- NEW.atualizado_em = now() — mas essas tabelas têm coluna `updated_at`.
-- Resultado: TODO UPDATE direto nelas falhava com 42703
-- ("record new has no field atualizado_em"). Afetava setProdutoLocal,
-- linkProdutoReceita, saveDespesaFixa (update) e os novos toggles do agente.
-- A UI otimista escondia o erro.
--
-- fn_set_atualizado_em() segue existindo para as tabelas que TÊM a coluna
-- (config_geral, receita_preco). Aqui criamos a gêmea para `updated_at`.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_produto_updated_at ON public.produto;
CREATE TRIGGER trg_produto_updated_at
  BEFORE UPDATE ON public.produto
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_despesa_fixa_updated_at ON public.despesa_fixa_empresa;
CREATE TRIGGER trg_despesa_fixa_updated_at
  BEFORE UPDATE ON public.despesa_fixa_empresa
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── Verificação ──────────────────────────────────────────────
--   update public.produto set local = local where id = (select id from public.produto limit 1);
--   (deve executar sem erro 42703)
