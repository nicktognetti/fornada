-- ============================================================
-- Migration: versionamento do schema central
-- Data: 20/06/2026
--
-- Versiona tabelas, índices e políticas RLS que existiam no
-- banco (criados manualmente via SQL Editor em 17/06/2026)
-- mas que não tinham definição em nenhuma migration anterior.
--
-- FILOSOFIA:
--   Todos os objetos usam IF NOT EXISTS / CREATE OR REPLACE.
--   Nada é dropado — apenas definições são registradas.
--
-- ORDEM DE CRIAÇÃO (respeita dependências de FK):
--   empresa → unidade → usuario_empresa
--   → insumo → insumo_preco
--   → receita → receita_item
--   → produto → produto_preco
--
-- As views e RPCs já estão em migrations separadas:
--   vw_custo_receita, vw_insumo_custo_atual, fn_get_user_unidade
--     → 20260618170000_views_custo.sql
--   vw_produto_financeiro
--     → 20260621000000_produto_financeiro.sql
-- ============================================================

-- ── Função utilitária (idempotente, já existe em produção) ────────────────────
CREATE OR REPLACE FUNCTION public.fn_set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END $$;

-- ────────────────────────────────────────────────────────────
-- 1. empresa
--    Tenant raiz do sistema. Cada padaria/rede é uma empresa.
--    Criada originalmente no banco em 17/06/2026.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.empresa (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT        NOT NULL UNIQUE,
  nome       TEXT        NOT NULL,
  ativa      BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empresa_slug ON public.empresa(slug);

ALTER TABLE public.empresa ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'empresa' AND policyname = 'empresa_usuario'
  ) THEN
    CREATE POLICY empresa_usuario ON public.empresa
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.usuario_empresa ue
          WHERE ue.empresa_id = empresa.id
            AND ue.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. unidade
--    Loja / filial dentro de uma empresa.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.unidade (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL,
  empresa_id UUID        NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  ativa      BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unidade_empresa ON public.unidade(empresa_id);

ALTER TABLE public.unidade ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'unidade' AND policyname = 'unidade_empresa'
  ) THEN
    CREATE POLICY unidade_empresa ON public.unidade
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.usuario_empresa ue
          WHERE ue.empresa_id = unidade.empresa_id
            AND ue.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3. usuario_empresa
--    Mapeamento N:N usuário ↔ empresa (RBAC de tenant).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usuario_empresa (
  user_id    UUID NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_empresa_user    ON public.usuario_empresa(user_id);
CREATE INDEX IF NOT EXISTS idx_usuario_empresa_empresa ON public.usuario_empresa(empresa_id);

ALTER TABLE public.usuario_empresa ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'usuario_empresa' AND policyname = 'usuario_empresa_self'
  ) THEN
    CREATE POLICY usuario_empresa_self ON public.usuario_empresa
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. insumo
--    Matéria-prima / ingrediente.
--    unidade_id: qual loja/unidade possui este insumo.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.insumo (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           TEXT        NOT NULL,
  unidade_medida TEXT        NOT NULL DEFAULT 'kg',
  categoria      TEXT,
  observacao     TEXT,
  ativo          BOOLEAN     NOT NULL DEFAULT true,
  unidade_id     UUID        REFERENCES public.unidade(id) ON DELETE SET NULL,
  empresa_id     UUID        REFERENCES public.empresa(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insumo_unidade   ON public.insumo(unidade_id);
CREATE INDEX IF NOT EXISTS idx_insumo_empresa   ON public.insumo(empresa_id);
CREATE INDEX IF NOT EXISTS idx_insumo_nome      ON public.insumo(nome);
CREATE INDEX IF NOT EXISTS idx_insumo_ativo     ON public.insumo(ativo);

ALTER TABLE public.insumo ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'insumo' AND policyname = 'insumo_empresa'
  ) THEN
    CREATE POLICY insumo_empresa ON public.insumo
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.usuario_empresa ue
          WHERE ue.empresa_id = insumo.empresa_id
            AND ue.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.usuario_empresa ue
          WHERE ue.empresa_id = insumo.empresa_id
            AND ue.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_insumo_updated_at ON public.insumo;
CREATE TRIGGER trg_insumo_updated_at
  BEFORE UPDATE ON public.insumo
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_atualizado_em();

-- ────────────────────────────────────────────────────────────
-- 5. insumo_preco
--    Histórico de preços de compra do insumo.
--    Sempre INSERT (nunca UPDATE) para preservar trilha de auditoria.
--    O custo vigente é o registro com maior vigente_desde.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.insumo_preco (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id           UUID        NOT NULL REFERENCES public.insumo(id) ON DELETE CASCADE,
  preco_compra        NUMERIC(12,4) NOT NULL CHECK (preco_compra > 0),
  qtd_uso_por_compra  NUMERIC(12,4) NOT NULL CHECK (qtd_uso_por_compra > 0),
  unidade_compra      TEXT        NOT NULL,
  vigente_desde       DATE        NOT NULL DEFAULT CURRENT_DATE,
  observacao          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insumo_preco_insumo   ON public.insumo_preco(insumo_id);
CREATE INDEX IF NOT EXISTS idx_insumo_preco_vigencia ON public.insumo_preco(insumo_id, vigente_desde DESC);

ALTER TABLE public.insumo_preco ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'insumo_preco' AND policyname = 'insumo_preco_empresa'
  ) THEN
    CREATE POLICY insumo_preco_empresa ON public.insumo_preco
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.insumo i
          JOIN public.usuario_empresa ue ON ue.empresa_id = i.empresa_id
          WHERE i.id = insumo_preco.insumo_id
            AND ue.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.insumo i
          JOIN public.usuario_empresa ue ON ue.empresa_id = i.empresa_id
          WHERE i.id = insumo_preco.insumo_id
            AND ue.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 6. receita
--    Ficha técnica de um produto fabricado.
--    tipo: 'final' (produto de venda) | 'base' (sub-receita)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.receita (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              TEXT        NOT NULL,
  tipo              TEXT        NOT NULL DEFAULT 'final' CHECK (tipo IN ('final', 'base')),
  rendimento        NUMERIC(12,4) NOT NULL DEFAULT 1 CHECK (rendimento > 0),
  rendimento_unidade TEXT       NOT NULL DEFAULT 'un',
  observacao        TEXT,
  ativo             BOOLEAN     NOT NULL DEFAULT true,
  unidade_id        UUID        REFERENCES public.unidade(id) ON DELETE SET NULL,
  empresa_id        UUID        REFERENCES public.empresa(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receita_unidade ON public.receita(unidade_id);
CREATE INDEX IF NOT EXISTS idx_receita_empresa ON public.receita(empresa_id);
CREATE INDEX IF NOT EXISTS idx_receita_ativo   ON public.receita(ativo);

ALTER TABLE public.receita ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'receita' AND policyname = 'receita_empresa'
  ) THEN
    CREATE POLICY receita_empresa ON public.receita
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.usuario_empresa ue
          WHERE ue.empresa_id = receita.empresa_id
            AND ue.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.usuario_empresa ue
          WHERE ue.empresa_id = receita.empresa_id
            AND ue.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_receita_updated_at ON public.receita;
CREATE TRIGGER trg_receita_updated_at
  BEFORE UPDATE ON public.receita
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_atualizado_em();

-- ────────────────────────────────────────────────────────────
-- 7. receita_item
--    Linha de ingrediente de uma ficha técnica.
--    Exatamente um de insumo_id / sub_receita_id deve ser preenchido.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.receita_item (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  receita_id     UUID          NOT NULL REFERENCES public.receita(id) ON DELETE CASCADE,
  insumo_id      UUID          REFERENCES public.insumo(id) ON DELETE SET NULL,
  sub_receita_id UUID          REFERENCES public.receita(id) ON DELETE SET NULL,
  quantidade     NUMERIC(12,4) NOT NULL CHECK (quantidade > 0),
  observacao     TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Exatamente uma fonte por item
  CONSTRAINT ck_receita_item_fonte
    CHECK (
      (insumo_id IS NOT NULL AND sub_receita_id IS NULL)
      OR
      (insumo_id IS NULL AND sub_receita_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_receita_item_receita      ON public.receita_item(receita_id);
CREATE INDEX IF NOT EXISTS idx_receita_item_insumo       ON public.receita_item(insumo_id);
CREATE INDEX IF NOT EXISTS idx_receita_item_sub_receita  ON public.receita_item(sub_receita_id);

ALTER TABLE public.receita_item ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'receita_item' AND policyname = 'receita_item_empresa'
  ) THEN
    CREATE POLICY receita_item_empresa ON public.receita_item
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.receita r
          JOIN public.usuario_empresa ue ON ue.empresa_id = r.empresa_id
          WHERE r.id = receita_item.receita_id
            AND ue.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.receita r
          JOIN public.usuario_empresa ue ON ue.empresa_id = r.empresa_id
          WHERE r.id = receita_item.receita_id
            AND ue.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 8. produto
--    Entidade de 1ª classe para venda/precificação.
--    tipo 'produzido': tem ficha técnica (receita_id NOT NULL)
--    tipo 'revenda':   custo de compra direto (custo_compra NOT NULL)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.produto (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT        NOT NULL,
  tipo         TEXT        NOT NULL DEFAULT 'produzido'
                           CHECK (tipo IN ('produzido', 'revenda')),
  ativo        BOOLEAN     NOT NULL DEFAULT true,
  receita_id   UUID        REFERENCES public.receita(id) ON DELETE SET NULL,
  custo_compra NUMERIC(12,4) CHECK (custo_compra > 0),
  categoria    TEXT,
  unidade_id   UUID        REFERENCES public.unidade(id) ON DELETE SET NULL,
  empresa_id   UUID        NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Garante que cada tipo tem seu campo obrigatório preenchido
  CONSTRAINT chk_produto_origem
    CHECK (
      (tipo = 'produzido' AND receita_id IS NOT NULL)
      OR
      (tipo = 'revenda'   AND custo_compra IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_produto_empresa    ON public.produto(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produto_unidade    ON public.produto(unidade_id);
CREATE INDEX IF NOT EXISTS idx_produto_receita    ON public.produto(receita_id);
CREATE INDEX IF NOT EXISTS idx_produto_ativo      ON public.produto(ativo);

-- (RLS e trigger já adicionados em 20260621000000_produto_financeiro.sql)

-- ────────────────────────────────────────────────────────────
-- 9. produto_preco
--    Preço de venda por produto × unidade.
--    UNIQUE (produto_id, unidade_id) — upsert seguro.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.produto_preco (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id       UUID        NOT NULL REFERENCES public.produto(id) ON DELETE CASCADE,
  unidade_id       UUID        NOT NULL REFERENCES public.unidade(id) ON DELETE CASCADE,
  preco_praticado  NUMERIC(12,4) NOT NULL CHECK (preco_praticado >= 0),
  volume_mensal    INTEGER     NOT NULL DEFAULT 0,
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uk_produto_preco UNIQUE (produto_id, unidade_id)
);

CREATE INDEX IF NOT EXISTS idx_produto_preco_produto  ON public.produto_preco(produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_preco_unidade  ON public.produto_preco(unidade_id);

-- (RLS já adicionado em 20260621000000_produto_financeiro.sql)

DROP TRIGGER IF EXISTS trg_produto_preco_atualizado_em ON public.produto_preco;
CREATE TRIGGER trg_produto_preco_atualizado_em
  BEFORE UPDATE ON public.produto_preco
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_atualizado_em();
