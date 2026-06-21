-- Correções de segurança pós-auditoria (20/06/2026)
-- 1. Remove política RLS duplicada em produto (criada por 20260621000000 e 20260622000000)
-- 2. Garante fn_set_atualizado_em() idempotente antes dos triggers
-- 3. Ativa security_invoker na vw_produto_financeiro
-- 4. Relatório de produtos sem unidade_id (diagnóstico)

-- ── 1. Política duplicada ─────────────────────────────────────────────────────
-- 20260621000000 criou "produto_empresa"; 20260622000000 criou "produto_empresa_rls".
-- Com ambas ativas, INSERT/UPDATE/DELETE combinam com AND podendo bloquear escritas.
DROP POLICY IF EXISTS produto_empresa ON public.produto;

-- ── 2. fn_set_atualizado_em() idempotente ─────────────────────────────────────
-- Garante que a função exista independente da ordem de execução das migrations.
CREATE OR REPLACE FUNCTION public.fn_set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END $$;

-- ── 3. vw_produto_financeiro com security_invoker ─────────────────────────────
-- Com security_invoker = true, a view executa com as permissões do usuário chamante,
-- o que faz com que as políticas RLS das tabelas subjacentes (produto, produto_preco)
-- se apliquem automaticamente, eliminando a dependência do filtro empresa_id no código.
ALTER VIEW public.vw_produto_financeiro SET (security_invoker = true);

-- ── 4. Diagnóstico: produtos sem unidade_id ───────────────────────────────────
-- savePrecoVenda falha silenciosamente para esses produtos.
-- Execute manualmente para verificar o estado do banco:
--   SELECT COUNT(*) FROM produto WHERE unidade_id IS NULL;
--   SELECT id, nome, tipo FROM produto WHERE unidade_id IS NULL LIMIT 20;
