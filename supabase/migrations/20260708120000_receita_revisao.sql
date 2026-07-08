-- ============================================================
-- Migration: Fluxo Caderno → Ficha (revisão pela Natali)
--   Quando a produção cria/altera uma receita pelo Caderno, ela precisa
--   entrar no radar da Natali para conferir ingredientes e precificar.
--     - revisao_pendente: sinaliza "receita nova/alterada esperando preço"
-- Data: 08/07/2026
-- ============================================================

ALTER TABLE public.receita
  ADD COLUMN IF NOT EXISTS revisao_pendente BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.receita.revisao_pendente IS
  'Receita criada/alterada pela produção no Caderno, aguardando a Natali conferir ingredientes e definir o preço. A Natali dá baixa em "Marcar como revisada".';

-- ── Verificação ──────────────────────────────────────────────
--   select nome, revisao_pendente from public.receita where revisao_pendente;
