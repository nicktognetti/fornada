-- ============================================================
-- Correções da auditoria v2 — parte SEGURA (backfill unidade_id)
-- Data: 24/06/2026
--
-- ✅ CONFIRMADO contra o banco do Fornada (slug 'flor-do-trigo', 25/06): insumo e
--    receita têm unidade_id. (O "susto do sac_agrindus" foi alarme falso.)
--    Backfill OPCIONAL — aplicar quando quiser, com BACKUP. As guardas (IF EXISTS) protegem.
--    ⚠️ TESTAR + BACKUP.
--
-- Revisado após diagnóstico do banco de produção:
--   - A vw_insumo_custo_atual NÃO é recriada aqui (faltou confirmar a definição
--     completa/colunas; o desempate de vigência fica para depois, com a def real).
--   - A vw_produto_financeiro NÃO existe no banco hoje (o security_invoker abaixo
--     vira no-op via guard) — ela será criada num passo separado, junto da
--     vw_custo_receita, para o Painel/Produtos novo funcionar.
--   - O backfill de unidade_id é guardado por existência da coluna.
-- ============================================================

-- 1. security_invoker — só se a view existir (hoje não existe → no-op seguro)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='vw_produto_financeiro') THEN
    EXECUTE 'ALTER VIEW public.vw_produto_financeiro SET (security_invoker = true)';
  END IF;
END $$;

-- 2. Backfill de unidade_id NULL (registros antigos somem sob o filtro por unidade)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='insumo' AND column_name='unidade_id') THEN
    UPDATE public.insumo i
    SET unidade_id = (SELECT u.id FROM public.unidade u
                      WHERE u.empresa_id = i.empresa_id AND u.ativo = true
                      ORDER BY u.nome LIMIT 1)
    WHERE i.unidade_id IS NULL AND i.empresa_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.unidade u2 WHERE u2.empresa_id = i.empresa_id AND u2.ativo = true);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='receita' AND column_name='unidade_id') THEN
    UPDATE public.receita r
    SET unidade_id = (SELECT u.id FROM public.unidade u
                      WHERE u.empresa_id = r.empresa_id AND u.ativo = true
                      ORDER BY u.nome LIMIT 1)
    WHERE r.unidade_id IS NULL AND r.empresa_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.unidade u2 WHERE u2.empresa_id = r.empresa_id AND u2.ativo = true);
  END IF;
END $$;

-- Diagnóstico pós-aplicação:
--   select count(*) filter (where unidade_id is null) from public.insumo;
--   select count(*) filter (where unidade_id is null) from public.receita;
--   -- Esperado: 0 (quando a empresa tem ao menos 1 unidade ativa).
