-- ============================================================
-- Módulo Atendimento (agente WhatsApp) — Fase 1: fundação
-- Data: 05/07/2026
-- Origem: carta de passagem do projeto agente-whatsapp
--   (Agente-whatsapp/docs/plano-modulo-atendimento-fornada.md)
--
--   1. Campos no `produto` para o agente vender melhor:
--      - sempre_disponivel: produto "de sempre" (pão francês) — marcado 1x, fixo
--      - disponivel_hoje:   toggle diário tem/acabou (NULL = não informado →
--                           o agente confirma com a equipe antes de prometer)
--      - foto_url:          foto no Supabase Storage (o agente envia no WhatsApp)
--      - sugestao_do_dia:   ⭐ o agente só OFERECE produtos marcados aqui
--   2. Tabelas do módulo (conversas, mensagens, encomendas anotadas)
--      com empresa_id/unidade_id + RLS por loja como o resto do sistema.
--   3. Bucket público `produto-fotos` no Storage.
--
--   Permissão RBAC `atendimento` NÃO precisa de migration: telas são
--   registradas no app (app/lib/permissions.ts) e as linhas em `permissao`
--   nascem pela tela de Configurações.
-- ============================================================

-- ── 1. Campos novos no produto ───────────────────────────────
ALTER TABLE public.produto
  ADD COLUMN IF NOT EXISTS sempre_disponivel BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disponivel_hoje   BOOLEAN,
  ADD COLUMN IF NOT EXISTS foto_url          TEXT,
  ADD COLUMN IF NOT EXISTS sugestao_do_dia   BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.produto.sempre_disponivel IS
  'Produto "de sempre" (ex.: pão francês): o agente considera disponível sem checar disponivel_hoje.';
COMMENT ON COLUMN public.produto.disponivel_hoje IS
  'Toggle diário tem/acabou. NULL = não informado (agente confirma com a equipe antes de prometer).';
COMMENT ON COLUMN public.produto.foto_url IS
  'URL pública da foto (bucket produto-fotos) que o agente envia no WhatsApp.';
COMMENT ON COLUMN public.produto.sugestao_do_dia IS
  '⭐ Sugestão do dia: o agente só oferece espontaneamente produtos marcados (máx. 1 por conversa).';

-- ── 2. Tabelas do módulo de atendimento ──────────────────────

-- Conversa: 1 por número de WhatsApp por loja.
CREATE TABLE IF NOT EXISTS public.atendimento_conversa (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID        NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  unidade_id    UUID        NOT NULL REFERENCES public.unidade(id) ON DELETE CASCADE,
  numero        TEXT        NOT NULL,
  nome          TEXT,
  pausada_ate   TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_atendimento_conversa_unidade
  ON public.atendimento_conversa(unidade_id, atualizado_em DESC);

COMMENT ON TABLE public.atendimento_conversa IS
  'Conversas do agente WhatsApp, por loja. pausada_ate != NULL e no futuro = humano assumiu (robô calado).';

-- Mensagem: histórico da conversa (contexto do agente = últimas 24h).
CREATE TABLE IF NOT EXISTS public.atendimento_mensagem (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID        NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  unidade_id  UUID        NOT NULL REFERENCES public.unidade(id) ON DELETE CASCADE,
  conversa_id UUID        NOT NULL REFERENCES public.atendimento_conversa(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  conteudo    TEXT        NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atendimento_mensagem_conversa
  ON public.atendimento_mensagem(conversa_id, criado_em);

COMMENT ON TABLE public.atendimento_mensagem IS
  'Mensagens trocadas com o agente (role user = cliente, assistant = robô/humano pelo painel).';

-- Encomenda anotada pelo agente (marcação #ENCOMENDA# da IA).
-- "virou_pedido" liga na encomenda oficial do módulo de encomendas.
CREATE TABLE IF NOT EXISTS public.atendimento_encomenda (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID        NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  unidade_id   UUID        NOT NULL REFERENCES public.unidade(id) ON DELETE CASCADE,
  conversa_id  UUID        NOT NULL REFERENCES public.atendimento_conversa(id) ON DELETE CASCADE,
  produto      TEXT        NOT NULL,
  quantidade   TEXT,
  data_texto   TEXT,
  nome         TEXT,
  status       TEXT        NOT NULL DEFAULT 'anotada'
               CHECK (status IN ('anotada', 'confirmada', 'virou_pedido')),
  encomenda_id UUID        REFERENCES public.encomenda(id) ON DELETE SET NULL,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atendimento_encomenda_unidade
  ON public.atendimento_encomenda(unidade_id, status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_atendimento_encomenda_conversa
  ON public.atendimento_encomenda(conversa_id);

COMMENT ON TABLE public.atendimento_encomenda IS
  'Encomendas anotadas pelo agente na conversa. quantidade/data_texto são texto livre do cliente; ao "virar pedido" liga em encomenda_id.';

-- ── RLS por loja (padrão fn_is_admin_global / fn_user_unidades) ──
ALTER TABLE public.atendimento_conversa  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_mensagem  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_encomenda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atendimento_conversa_loja ON public.atendimento_conversa;
CREATE POLICY atendimento_conversa_loja ON public.atendimento_conversa FOR ALL
  USING      (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()))
  WITH CHECK (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()));

DROP POLICY IF EXISTS atendimento_mensagem_loja ON public.atendimento_mensagem;
CREATE POLICY atendimento_mensagem_loja ON public.atendimento_mensagem FOR ALL
  USING      (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()))
  WITH CHECK (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()));

DROP POLICY IF EXISTS atendimento_encomenda_loja ON public.atendimento_encomenda;
CREATE POLICY atendimento_encomenda_loja ON public.atendimento_encomenda FOR ALL
  USING      (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()))
  WITH CHECK (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()));

-- ── 3. Bucket de fotos de produto (Storage) ──────────────────
-- Público para leitura (o WhatsApp precisa baixar a imagem pela URL).
-- Upload/remoção passam pelo service role (Server Action) — sem policy de escrita.
INSERT INTO storage.buckets (id, name, public)
VALUES ('produto-fotos', 'produto-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- ── Verificação ──────────────────────────────────────────────
--   select column_name from information_schema.columns
--     where table_name = 'produto' and column_name in
--     ('sempre_disponivel','disponivel_hoje','foto_url','sugestao_do_dia');
--   select tablename, policyname from pg_policies where tablename like 'atendimento_%';
--   select id, public from storage.buckets where id = 'produto-fotos';
