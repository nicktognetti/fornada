-- ============================================================
-- Migration: fn_get_user_unidade ignora o parâmetro e usa auth.uid()
-- Data: 10/09/2026 (Auditoria v4, Lote D)
--
-- Problema: a função é SECURITY DEFINER com GRANT a authenticated e
-- aceitava QUALQUER p_user_id — qualquer autenticado descobria a loja
-- padrão de qualquer usuário, atravessando o RLS de usuario_unidade
-- (mesmo padrão do fn_listar_usuarios removido no Lote 1).
--
-- Correção: mesmo tratamento do confirmar_recebimento — a assinatura
-- fica (compatível com o app, que passa p_user_id), mas o valor é
-- IGNORADO: a consulta usa sempre auth.uid().
-- ============================================================

CREATE OR REPLACE FUNCTION fornada.fn_get_user_unidade(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, fornada
AS $$
    -- p_user_id é ignorado de propósito: só a própria unidade do chamador.
    SELECT json_build_object('id', u.id, 'nome', u.nome)
    FROM fornada.usuario_unidade uu
    JOIN public.unidade u ON u.id = uu.unidade_id
    WHERE uu.user_id = auth.uid()
    ORDER BY uu.created_at
    LIMIT 1;
$$;

COMMENT ON FUNCTION fornada.fn_get_user_unidade(uuid) IS
    'Retorna {id, nome} da unidade padrão do CHAMADOR (auth.uid()). '
    'O parâmetro p_user_id é ignorado — mantido só por compatibilidade de assinatura.';
