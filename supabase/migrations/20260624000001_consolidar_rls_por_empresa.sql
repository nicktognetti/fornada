-- ============================================================
-- Consolidação de RLS por EMPRESA — CORRIGIDO p/ o schema REAL
-- Data: 24/06/2026 (revisado após diagnóstico do banco de produção)
--
-- ⚠️ TESTAR EM STAGING/BRANCH + FAZER BACKUP. Não testado contra o banco.
--
-- ESTADO REAL (diagnóstico via pg_policies):
--   Cada tabela core tem:
--     - POR EMPRESA:  p_emp  → USING empresa_id IN (SELECT app_user_empresas())
--     - POR UNIDADE:  "Usuário vê ... da sua unidade" → unidade_id = get_user_unidade_id()
--   produto / produto_preco têm ainda duplicatas por empresa
--   (produto_por_empresa / produto_preco_empresa).
--   Sendo permissivas, combinam por OR → o isolamento por unidade não vale.
--
-- DECISÃO (21/06): manter SOMENTE p_emp (isolamento por empresa). O controle
-- fino por unidade/módulo é feito no app via RBAC (tabela permissao + temAcesso
-- nas server actions).
--
-- SEGURANÇA: cada DROP só roda se p_emp EXISTIR naquela tabela — nunca remove
-- a última política. Se alguma tabela não tiver p_emp, o DROP é pulado (e você
-- me avisa para tratá-la à parte).
--
-- VERIFICAR ANTES E DEPOIS:
--   select tablename, policyname, cmd from pg_policies
--   where schemaname='public'
--     and tablename in ('insumo','insumo_preco','receita','receita_item','produto','produto_preco')
--   order by 1,2;
-- ============================================================

-- insumo
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='insumo' AND policyname='p_emp') THEN
    DROP POLICY IF EXISTS "Usuário vê insumos da sua unidade" ON public.insumo;
  END IF;
END $$;

-- insumo_preco
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='insumo_preco' AND policyname='p_emp') THEN
    DROP POLICY IF EXISTS "Usuário vê preços de insumos da sua unidade" ON public.insumo_preco;
  END IF;
END $$;

-- receita
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='receita' AND policyname='p_emp') THEN
    DROP POLICY IF EXISTS "Usuário vê receitas da sua unidade" ON public.receita;
  END IF;
END $$;

-- receita_item
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='receita_item' AND policyname='p_emp') THEN
    DROP POLICY IF EXISTS "Usuário vê itens de receita da sua unidade" ON public.receita_item;
  END IF;
END $$;

-- produto (mantém p_emp; remove a por-unidade e a duplicata produto_por_empresa)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='produto' AND policyname='p_emp') THEN
    DROP POLICY IF EXISTS "Usuário vê produtos da sua unidade" ON public.produto;
    DROP POLICY IF EXISTS produto_por_empresa ON public.produto;
  END IF;
END $$;

-- produto_preco (mantém p_emp; remove a por-unidade e a duplicata produto_preco_empresa)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='produto_preco' AND policyname='p_emp') THEN
    DROP POLICY IF EXISTS "Usuário vê preços de produtos da sua unidade" ON public.produto_preco;
    DROP POLICY IF EXISTS produto_preco_empresa ON public.produto_preco;
  END IF;
END $$;

-- Resultado esperado: cada tabela acima fica APENAS com a política p_emp.
