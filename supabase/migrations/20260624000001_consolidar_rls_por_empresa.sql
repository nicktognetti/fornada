-- ============================================================
-- Consolidação de RLS — isolamento POR EMPRESA (auditoria v2 §B1)
-- Data: 24/06/2026
--
-- ⚠️⚠️  REVISAR COM CUIDADO E TESTAR EM STAGING/BRANCH ANTES DE PRODUÇÃO.
--       FAÇA BACKUP. Não foi testado contra o banco real.
--
-- CONTEXTO
--   As tabelas core acumularam políticas POR UNIDADE (gen 1 —
--   20260618140000_unidade_id_rls) e POR EMPRESA (gen 2 —
--   20260620000004_schema_central). Sendo permissivas, combinam por OR:
--   o isolamento por unidade não vale (a de empresa, mais ampla, vence).
--
-- DECISÃO DE PRODUTO (21/06)
--   Isolar por EMPRESA no banco. O controle fino por unidade/módulo é
--   feito no servidor via RBAC (tabela `permissao` + app/lib/authz.ts
--   `temAcesso`), aplicado nas server actions de escrita.
--
-- ESTRATÉGIA SEGURA
--   1) Garantir que a política POR EMPRESA existe (idempotente) ANTES de
--   2) remover as políticas POR UNIDADE. Assim o acesso nunca é perdido.
--
-- NÃO TOCA em: compra/compra_item, transferencia/transferencia_item,
-- permissao, despesa_fixa_empresa, config_geral, meta_faturamento
-- (têm suas próprias políticas e estão fora deste escopo).
--
-- VERIFICAR ANTES E DEPOIS:
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('insumo','insumo_preco','receita','receita_item','produto','produto_preco')
--   ORDER BY tablename, policyname;
-- ============================================================

-- ── 1. Garantir políticas POR EMPRESA (idempotente) ──────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='insumo' AND policyname='insumo_empresa') THEN
    CREATE POLICY insumo_empresa ON public.insumo FOR ALL
      USING (EXISTS (SELECT 1 FROM public.usuario_empresa ue WHERE ue.empresa_id = insumo.empresa_id AND ue.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.usuario_empresa ue WHERE ue.empresa_id = insumo.empresa_id AND ue.user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='insumo_preco' AND policyname='insumo_preco_empresa') THEN
    CREATE POLICY insumo_preco_empresa ON public.insumo_preco FOR ALL
      USING (EXISTS (SELECT 1 FROM public.insumo i JOIN public.usuario_empresa ue ON ue.empresa_id = i.empresa_id WHERE i.id = insumo_preco.insumo_id AND ue.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.insumo i JOIN public.usuario_empresa ue ON ue.empresa_id = i.empresa_id WHERE i.id = insumo_preco.insumo_id AND ue.user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='receita' AND policyname='receita_empresa') THEN
    CREATE POLICY receita_empresa ON public.receita FOR ALL
      USING (EXISTS (SELECT 1 FROM public.usuario_empresa ue WHERE ue.empresa_id = receita.empresa_id AND ue.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.usuario_empresa ue WHERE ue.empresa_id = receita.empresa_id AND ue.user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='receita_item' AND policyname='receita_item_empresa') THEN
    CREATE POLICY receita_item_empresa ON public.receita_item FOR ALL
      USING (EXISTS (SELECT 1 FROM public.receita r JOIN public.usuario_empresa ue ON ue.empresa_id = r.empresa_id WHERE r.id = receita_item.receita_id AND ue.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.receita r JOIN public.usuario_empresa ue ON ue.empresa_id = r.empresa_id WHERE r.id = receita_item.receita_id AND ue.user_id = auth.uid()));
  END IF;
END $$;

-- produto: mantém produto_por_empresa como política canônica
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='produto' AND policyname='produto_por_empresa') THEN
    CREATE POLICY produto_por_empresa ON public.produto FOR ALL
      USING (empresa_id IN (SELECT empresa_id FROM public.usuario_empresa WHERE user_id = auth.uid()))
      WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.usuario_empresa WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='produto_preco' AND policyname='produto_preco_empresa') THEN
    CREATE POLICY produto_preco_empresa ON public.produto_preco FOR ALL
      USING (EXISTS (SELECT 1 FROM public.produto p JOIN public.usuario_empresa ue ON ue.empresa_id = p.empresa_id WHERE p.id = produto_preco.produto_id AND ue.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.produto p JOIN public.usuario_empresa ue ON ue.empresa_id = p.empresa_id WHERE p.id = produto_preco.produto_id AND ue.user_id = auth.uid()));
  END IF;
END $$;

-- ── 2. Remover políticas POR UNIDADE (gen 1) ─────────────────────────────────

DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.insumo;
DROP POLICY IF EXISTS insert_insumo_unidade ON public.insumo;
DROP POLICY IF EXISTS update_insumo_unidade ON public.insumo;

DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.insumo_preco;
DROP POLICY IF EXISTS insert_insumo_preco_unidade ON public.insumo_preco;

DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.receita;
DROP POLICY IF EXISTS insert_receita_unidade ON public.receita;
DROP POLICY IF EXISTS update_receita_unidade ON public.receita;

DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.receita_item;
DROP POLICY IF EXISTS insert_receita_item_unidade ON public.receita_item;
DROP POLICY IF EXISTS update_receita_item_unidade ON public.receita_item;
DROP POLICY IF EXISTS delete_receita_item_unidade ON public.receita_item;

DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.produto;
DROP POLICY IF EXISTS insert_produto_unidade ON public.produto;
DROP POLICY IF EXISTS update_produto_unidade ON public.produto;

DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.produto_preco;
DROP POLICY IF EXISTS insert_produto_preco_unidade ON public.produto_preco;
DROP POLICY IF EXISTS update_produto_preco_unidade ON public.produto_preco;

-- ── 3. Remover política POR EMPRESA duplicada em produto ──────────────────────
-- Mantém produto_por_empresa; remove as redundantes.
DROP POLICY IF EXISTS produto_empresa_rls ON public.produto;
DROP POLICY IF EXISTS produto_empresa ON public.produto;
