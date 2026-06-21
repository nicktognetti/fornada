-- ============================================================
-- Migration: popular usuario_unidade para usuários existentes
-- Data: 20/06/2026
--
-- Para cada usuário em usuario_empresa, vincula o usuário a
-- TODAS as unidades da empresa. Isso permite que o
-- UnidadeSelector mostre as abas corretas sem configuração
-- manual por operador.
--
-- Idempotente: ON CONFLICT DO NOTHING.
-- ============================================================

INSERT INTO public.usuario_unidade (user_id, unidade_id)
SELECT DISTINCT
  ue.user_id,
  u.id AS unidade_id
FROM public.usuario_empresa ue
JOIN public.unidade u ON u.empresa_id = ue.empresa_id
WHERE u.ativa = true
ON CONFLICT (user_id, unidade_id) DO NOTHING;
