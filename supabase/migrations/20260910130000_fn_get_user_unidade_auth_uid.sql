-- ============================================================
-- Migration: fn_get_user_unidade ignora o parâmetro e usa auth.uid()
-- Data: 10/09/2026 (Auditoria v4, Lote D; alvo corrigido pelo
-- revisor-pre-push: o app chama a versão do schema PUBLIC —
-- supabase.rpc() resolve em public — criada em 20260620000008.)
--
-- Problema: public.fn_get_user_unidade é SECURITY DEFINER com GRANT
-- a authenticated e aceitava QUALQUER p_user_id — qualquer autenticado
-- descobria a loja padrão de qualquer usuário, atravessando o RLS de
-- usuario_unidade (mesmo padrão do fn_listar_usuarios removido no Lote 1).
--
-- Correção: mesma assinatura (RETURNS jsonb — REPLACE não pode mudar o
-- tipo), mas o parâmetro é IGNORADO: a consulta usa sempre auth.uid().
-- O caller (app/actions/transferencia.ts) já passa o próprio id.
-- A cópia legada fornada.fn_get_user_unidade (mesmo padrão, tabela
-- parada) é dropada para não sobrar outra SECURITY DEFINER esquecida.
-- ============================================================

-- ⚠️ Drift confirmado em produção (11/09): a função viva retorna outro tipo
-- que o declarado na migration de junho — REPLACE falha (42P13). DROP+CREATE.
DROP FUNCTION IF EXISTS public.fn_get_user_unidade(uuid);

CREATE FUNCTION public.fn_get_user_unidade(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- p_user_id é ignorado de propósito: só a própria unidade do chamador.
  SELECT jsonb_build_object('id', u.id, 'nome', u.nome)
  INTO v_result
  FROM public.usuario_unidade uu
  JOIN public.unidade u ON u.id = uu.unidade_id
  WHERE uu.user_id = auth.uid()
  ORDER BY uu.created_at
  LIMIT 1;

  RETURN v_result;
END $$;

COMMENT ON FUNCTION public.fn_get_user_unidade(uuid) IS
    'Retorna {id, nome} da unidade padrão do CHAMADOR (auth.uid()). '
    'O parâmetro p_user_id é ignorado — mantido só por compatibilidade de assinatura.';

-- Recriada do zero: garante o EXECUTE de quem a usa (o app chama autenticado).
GRANT EXECUTE ON FUNCTION public.fn_get_user_unidade(uuid) TO authenticated;

DROP FUNCTION IF EXISTS fornada.fn_get_user_unidade(uuid);
