-- ============================================================
-- Migration: remove views legadas do schema `fornada`
-- Data: 03/08/2026
--
-- CONTEXTO: em 20/06 todas as tabelas saíram de `fornada` para `public`
-- (20260620000008_mover_fornada_para_public.sql). Estas 3 views ficaram
-- para trás apontando para as tabelas antigas — que hoje estão congeladas
-- ou vazias. O mapeamento de arquitetura (03/08) confirmou:
--
--   * ZERO referências em TypeScript (grep por vw_transferencias/vw_dashboard
--     em app/ e lib/ não retorna nada);
--   * nenhum `.schema('fornada')` no código — e o schema `fornada` nem está
--     exposto no PostgREST, o que já foi o motivo da migração para `public`.
--
-- Ou seja: código morto que só confunde quem lê o schema. Nenhuma delas tem
-- `security_invoker`, então também não deixa dúvida de segurança para trás.
--
-- ESCOPO: apenas VIEWS (não guardam dado). As TABELAS do schema `fornada`
-- seguem intocadas — têm dados históricos e sua remoção é decisão à parte,
-- depois de conferir que tudo foi migrado.
-- ============================================================

DROP VIEW IF EXISTS fornada.vw_transferencias_pendentes;
DROP VIEW IF EXISTS fornada.vw_transferencias_recentes;
DROP VIEW IF EXISTS fornada.vw_dashboard_transferencias;

-- ============================================================
-- FIM
-- ============================================================
