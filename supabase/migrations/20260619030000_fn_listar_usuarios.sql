-- ============================================================
-- Migration: fn_listar_usuarios — acesso a auth.users via
-- SECURITY DEFINER para evitar bloqueio de RLS
-- Data: 19/06/2026
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_listar_usuarios()
RETURNS TABLE (
  id             uuid,
  email          text,
  nome           text,
  created_at     timestamptz,
  ultimo_acesso  timestamptz,
  meta_dados     jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT
    au.id,
    au.email::text,
    COALESCE(
      au.raw_user_meta_data->>'nome',
      au.raw_user_meta_data->>'full_name',
      ''
    )::text                  AS nome,
    au.created_at,
    au.last_sign_in_at       AS ultimo_acesso,
    au.raw_user_meta_data    AS meta_dados
  FROM auth.users au
  ORDER BY au.created_at DESC;
END;
$$;

REVOKE ALL   ON FUNCTION public.fn_listar_usuarios() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_listar_usuarios() TO authenticated;
