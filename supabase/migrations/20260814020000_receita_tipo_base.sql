-- ============================================================
-- Migration: receita.tipo passa a aceitar 'base' (sub-receita)
-- Data: 14/08/2026
--
-- BUG ATIVO: o CHECK real de `receita.tipo` aceita SÓ 'final'. A migration
-- que criou a tabela declara `CHECK (tipo IN ('final','base'))`, o Zod da
-- action aceita os dois e o modal oferece "Base — sub-receita" — mas
-- escolher Base devolve erro cru do banco. **Criar sub-receita é impossível
-- em produção**, e por isso as 5 receitas existentes são todas 'final'.
--
-- Isso deixou morta uma máquina inteira que já está construída e testada:
-- `receita_item.sub_receita_id`, a detecção de ciclo (BFS `hasCycle`), o
-- cálculo recursivo `fn_fornada_custo_receita` e a coluna de rendimento da
-- sub. Nada disso jamais rodou com dado real.
--
-- É o 5º drift entre migration e banco real (ver docs/baseline-migrations.md);
-- foi descoberto ao tentar montar um ciclo A⊃B⊃A para testar a guarda nova.
-- ============================================================

ALTER TABLE public.receita
  DROP CONSTRAINT IF EXISTS receita_tipo_check;

ALTER TABLE public.receita
  ADD CONSTRAINT receita_tipo_check
    CHECK (tipo IN ('final', 'base'));

COMMENT ON COLUMN public.receita.tipo IS
  'final = produto de venda; base = sub-receita/preparação usada dentro de '
  'outra ficha (massa, recheio, cobertura, calda...). Só estes dois: o cálculo '
  'de custo e a UI dependem dessa dicotomia.';

-- ============================================================
-- FIM
-- ============================================================
