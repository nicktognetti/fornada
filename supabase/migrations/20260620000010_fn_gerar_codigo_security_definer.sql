-- ============================================================
-- Migration: fn_gerar_codigo_transferencia com SECURITY DEFINER
-- Data: 20/06/2026
--
-- MOTIVO: a role "authenticated" não tem permissão de uso nas
-- sequences do schema public por padrão. A função precisa de
-- SECURITY DEFINER para executar como o owner (postgres/service)
-- e assim criar + acessar as sequences sem exigir GRANT extra.
-- ============================================================

-- Garante acesso às sequences existentes (retroativo)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_gerar_codigo_transferencia(p_tipo varchar)
RETURNS varchar LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_ano      TEXT    := to_char(now(), 'YYYY');
  v_seq_name TEXT;
  v_num      TEXT;
  v_codigo   VARCHAR(20);
BEGIN
  IF p_tipo = 'TRANSFERENCIA' THEN
    v_seq_name := 'public.seq_transferencia_trf_' || v_ano;
  ELSIF p_tipo = 'DEVOLUCAO' THEN
    v_seq_name := 'public.seq_transferencia_dev_' || v_ano;
  ELSE
    RAISE EXCEPTION 'Tipo inválido: %. Use TRANSFERENCIA ou DEVOLUCAO.', p_tipo;
  END IF;

  -- Cria a sequence do ano corrente se ainda não existir e concede uso
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %s START 1', v_seq_name);
  EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated', v_seq_name);

  EXECUTE format(
    'SELECT to_char(nextval(%L), ''FM000'')',
    v_seq_name
  ) INTO v_num;

  IF p_tipo = 'TRANSFERENCIA' THEN
    v_codigo := 'TRF-' || v_num || '/' || v_ano;
  ELSE
    v_codigo := 'DEV-' || v_num || '/' || v_ano;
  END IF;

  RETURN v_codigo;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_gerar_codigo_transferencia(varchar) TO authenticated;
