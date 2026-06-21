-- ============================================================
-- Migration: move tudo do schema "fornada" para "public"
-- Data: 20/06/2026
--
-- MOTIVO: o PostgREST do Supabase só expõe o schema "public"
-- por padrão. O schema "fornada" não está habilitado nas
-- configurações da API, causando erro "Invalid schema: fornada"
-- em todas as chamadas .schema('fornada').
--
-- ESTRATÉGIA: recriar as tabelas em public (IF NOT EXISTS),
-- migrar dados existentes (INSERT ... SELECT), recriar índices,
-- RLS, funções e views. Idempotente — pode ser rodada mais de
-- uma vez com segurança.
-- ============================================================

-- ── 1. usuario_unidade ───────────────────────────────────────
-- Vínculo entre usuário Auth e unidade operacional
CREATE TABLE IF NOT EXISTS public.usuario_unidade (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unidade_id UUID        NOT NULL REFERENCES public.unidade(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_usuario_unidade UNIQUE (user_id, unidade_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_unidade_user
  ON public.usuario_unidade(user_id);

CREATE INDEX IF NOT EXISTS idx_usuario_unidade_unidade
  ON public.usuario_unidade(unidade_id);

-- Migrar dados existentes do schema fornada (sem duplicar)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'fornada' AND table_name = 'usuario_unidade'
  ) THEN
    INSERT INTO public.usuario_unidade (id, user_id, unidade_id, created_at)
    SELECT id, user_id, unidade_id, created_at
    FROM fornada.usuario_unidade
    ON CONFLICT (user_id, unidade_id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE public.usuario_unidade ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'usuario_unidade' AND schemaname = 'public' AND policyname = 'usuario_unidade_select_own'
  ) THEN
    CREATE POLICY usuario_unidade_select_own ON public.usuario_unidade
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'usuario_unidade' AND schemaname = 'public' AND policyname = 'usuario_unidade_insert_admin'
  ) THEN
    CREATE POLICY usuario_unidade_insert_admin ON public.usuario_unidade
      FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR user_id = auth.uid()
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'usuario_unidade' AND schemaname = 'public' AND policyname = 'usuario_unidade_delete_admin'
  ) THEN
    CREATE POLICY usuario_unidade_delete_admin ON public.usuario_unidade
      FOR DELETE USING (
        auth.role() = 'service_role' OR user_id = auth.uid()
      );
  END IF;
END $$;


-- ── 2. Sequences para numeração de transferências ─────────────
CREATE SEQUENCE IF NOT EXISTS public.seq_transferencia_trf_2026 START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_transferencia_dev_2026 START 1;


-- ── 3. transferencia ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transferencia (
  id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              UUID           NOT NULL REFERENCES public.empresa(id),
  unidade_origem_id       UUID           NOT NULL REFERENCES public.unidade(id),
  unidade_destino_id      UUID           NOT NULL REFERENCES public.unidade(id),
  tipo                    VARCHAR(20)    NOT NULL,
  codigo                  VARCHAR(20)    NOT NULL,
  status                  VARCHAR(30)    NOT NULL DEFAULT 'PENDENTE',
  responsavel_origem_id   UUID           NOT NULL REFERENCES auth.users(id),
  responsavel_destino_id  UUID           REFERENCES auth.users(id),
  observacao              TEXT,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
  confirmed_at            TIMESTAMPTZ,
  valor_total             DECIMAL(12,2)  NOT NULL DEFAULT 0,
  status_financeiro       TEXT           NOT NULL DEFAULT 'pendente',
  CONSTRAINT uq_transferencia_codigo UNIQUE (codigo),
  CONSTRAINT ck_transferencia_tipo CHECK (tipo IN ('TRANSFERENCIA', 'DEVOLUCAO')),
  CONSTRAINT ck_transferencia_status CHECK (status IN ('PENDENTE', 'EM_TRANSITO', 'RECEBIDO', 'RECEBIDO_COM_DIVERGENCIA')),
  CONSTRAINT ck_transferencia_unidades_distintas CHECK (unidade_origem_id <> unidade_destino_id),
  CONSTRAINT ck_transferencia_confirmed_at CHECK (
    NOT (status IN ('RECEBIDO', 'RECEBIDO_COM_DIVERGENCIA') AND confirmed_at IS NULL)
  ),
  CONSTRAINT ck_transferencia_devolucao_motivo CHECK (
    NOT (tipo = 'DEVOLUCAO' AND observacao IS NULL)
  ),
  CONSTRAINT ck_transferencia_status_financeiro CHECK (
    status_financeiro IN ('pendente', 'a_receber', 'recebido', 'cancelado')
  )
);

-- Migrar transferências existentes
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'fornada' AND table_name = 'transferencia'
  ) THEN
    INSERT INTO public.transferencia (
      id, empresa_id, unidade_origem_id, unidade_destino_id, tipo, codigo, status,
      responsavel_origem_id, responsavel_destino_id, observacao, created_at, confirmed_at,
      valor_total, status_financeiro
    )
    SELECT
      id, empresa_id, unidade_origem_id, unidade_destino_id, tipo, codigo, status,
      responsavel_origem_id, responsavel_destino_id, observacao, created_at, confirmed_at,
      COALESCE(valor_total, 0), COALESCE(status_financeiro, 'pendente')
    FROM fornada.transferencia
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transferencia_empresa_status
  ON public.transferencia(empresa_id, status);

CREATE INDEX IF NOT EXISTS idx_transferencia_origem
  ON public.transferencia(unidade_origem_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transferencia_destino
  ON public.transferencia(unidade_destino_id, status);

CREATE INDEX IF NOT EXISTS idx_transferencia_codigo
  ON public.transferencia(codigo);

ALTER TABLE public.transferencia ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transferencia' AND schemaname = 'public' AND policyname = 'transferencia_select'
  ) THEN
    CREATE POLICY transferencia_select ON public.transferencia
      FOR SELECT USING (empresa_id IN (SELECT public.fn_get_empresas_usuario()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transferencia' AND schemaname = 'public' AND policyname = 'transferencia_insert'
  ) THEN
    CREATE POLICY transferencia_insert ON public.transferencia
      FOR INSERT WITH CHECK (
        empresa_id IN (SELECT public.fn_get_empresas_usuario())
        AND responsavel_origem_id = auth.uid()
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transferencia' AND schemaname = 'public' AND policyname = 'transferencia_update'
  ) THEN
    CREATE POLICY transferencia_update ON public.transferencia
      FOR UPDATE
      USING (empresa_id IN (SELECT public.fn_get_empresas_usuario()))
      WITH CHECK (empresa_id IN (SELECT public.fn_get_empresas_usuario()));
  END IF;
END $$;


-- ── 4. transferencia_item ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transferencia_item (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  transferencia_id    UUID           NOT NULL REFERENCES public.transferencia(id) ON DELETE CASCADE,
  produto_id          UUID           NOT NULL REFERENCES public.produto(id),
  quantidade_enviada  NUMERIC(12,4)  NOT NULL,
  quantidade_recebida NUMERIC(12,4),
  preco_unitario      DECIMAL(12,2)  NOT NULL DEFAULT 0,
  subtotal            DECIMAL(12,2)  GENERATED ALWAYS AS (quantidade_enviada * preco_unitario) STORED,
  status_item         VARCHAR(20)    NOT NULL DEFAULT 'PENDENTE',
  motivo_divergencia  TEXT,
  CONSTRAINT ck_transferencia_item_qtd_enviada CHECK (quantidade_enviada > 0),
  CONSTRAINT ck_transferencia_item_status CHECK (
    status_item IN ('PENDENTE', 'RECEBIDO', 'DIFERENCA', 'AUSENTE')
  ),
  CONSTRAINT ck_transferencia_item_motivo CHECK (
    NOT (status_item = 'DIFERENCA' AND motivo_divergencia IS NULL)
  )
);

-- Migrar itens existentes
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'fornada' AND table_name = 'transferencia_item'
  ) THEN
    INSERT INTO public.transferencia_item (
      id, transferencia_id, produto_id, quantidade_enviada, quantidade_recebida,
      preco_unitario, status_item, motivo_divergencia
    )
    SELECT
      ti.id, ti.transferencia_id, ti.produto_id, ti.quantidade_enviada, ti.quantidade_recebida,
      COALESCE(ti.preco_unitario, 0), ti.status_item, ti.motivo_divergencia
    FROM fornada.transferencia_item ti
    -- Só migrar itens cujas transferências já estão em public
    WHERE ti.transferencia_id IN (SELECT id FROM public.transferencia)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transferencia_item_transferencia
  ON public.transferencia_item(transferencia_id);

CREATE INDEX IF NOT EXISTS idx_transferencia_item_produto
  ON public.transferencia_item(produto_id);

ALTER TABLE public.transferencia_item ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transferencia_item' AND schemaname = 'public' AND policyname = 'transferencia_item_select'
  ) THEN
    CREATE POLICY transferencia_item_select ON public.transferencia_item
      FOR SELECT USING (
        transferencia_id IN (
          SELECT id FROM public.transferencia
          WHERE empresa_id IN (SELECT public.fn_get_empresas_usuario())
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transferencia_item' AND schemaname = 'public' AND policyname = 'transferencia_item_insert'
  ) THEN
    CREATE POLICY transferencia_item_insert ON public.transferencia_item
      FOR INSERT WITH CHECK (
        transferencia_id IN (
          SELECT id FROM public.transferencia
          WHERE empresa_id IN (SELECT public.fn_get_empresas_usuario())
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transferencia_item' AND schemaname = 'public' AND policyname = 'transferencia_item_update'
  ) THEN
    CREATE POLICY transferencia_item_update ON public.transferencia_item
      FOR UPDATE
      USING (
        transferencia_id IN (
          SELECT id FROM public.transferencia
          WHERE empresa_id IN (SELECT public.fn_get_empresas_usuario())
        )
      )
      WITH CHECK (
        transferencia_id IN (
          SELECT id FROM public.transferencia
          WHERE empresa_id IN (SELECT public.fn_get_empresas_usuario())
        )
      );
  END IF;
END $$;


-- ── 5. Função: fn_gerar_codigo_transferencia ──────────────────
-- Recriada em public.
CREATE OR REPLACE FUNCTION public.fn_gerar_codigo_transferencia(p_tipo varchar)
RETURNS varchar LANGUAGE plpgsql VOLATILE
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

  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %s START 1', v_seq_name);

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


-- ── 6. Atualizar confirmar_recebimento para referenciar public ─
-- A RPC da migration 20260620000007 já usa public.*, mas o loop
-- acessa public.transferencia_item.  Recriar para garantir.
CREATE OR REPLACE FUNCTION public.confirmar_recebimento(
  p_transferencia_id UUID,
  p_usuario_id       UUID,
  p_itens            JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_transferencia RECORD;
  v_item_input    JSONB;
  v_item          RECORD;
  v_saldo_antigo  NUMERIC;
  v_saldo_novo    NUMERIC;
  v_qtd_recebida  NUMERIC;
  v_tem_divergencia BOOLEAN := false;
  v_status_final  TEXT;
BEGIN
  SELECT * INTO v_transferencia
  FROM public.transferencia
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transferência não encontrada');
  END IF;

  IF v_transferencia.status NOT IN ('EM_TRANSITO', 'PENDENTE') THEN
    RETURN jsonb_build_object('error', 'Transferência já confirmada ou cancelada');
  END IF;

  FOR v_item_input IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    SELECT ti.*, p.insumo_id
    INTO v_item
    FROM public.transferencia_item ti
    LEFT JOIN public.produto p ON p.id = ti.produto_id
    WHERE ti.id = (v_item_input->>'id')::UUID
      AND ti.transferencia_id = p_transferencia_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Item não encontrado: ' || (v_item_input->>'id'));
    END IF;

    v_qtd_recebida := COALESCE((v_item_input->>'quantidade_recebida')::NUMERIC, 0);

    IF (v_item_input->>'status_item') IN ('DIFERENCA', 'AUSENTE') THEN
      v_tem_divergencia := true;
    END IF;

    UPDATE public.transferencia_item
    SET
      quantidade_recebida = v_qtd_recebida,
      status_item         = v_item_input->>'status_item',
      motivo_divergencia  = NULLIF(TRIM(COALESCE(v_item_input->>'motivo_divergencia', '')), '')
    WHERE id = (v_item_input->>'id')::UUID;

    IF v_item.insumo_id IS NOT NULL AND v_qtd_recebida > 0 THEN
      SELECT COALESCE(saldo, 0) INTO v_saldo_antigo
      FROM public.insumo_saldo
      WHERE insumo_id = v_item.insumo_id
        AND unidade_id = v_transferencia.unidade_destino_id;

      v_saldo_antigo := COALESCE(v_saldo_antigo, 0);
      v_saldo_novo   := v_saldo_antigo + v_qtd_recebida;

      INSERT INTO public.insumo_saldo (insumo_id, unidade_id, saldo, atualizado_em)
      VALUES (v_item.insumo_id, v_transferencia.unidade_destino_id, v_qtd_recebida, now())
      ON CONFLICT (insumo_id, unidade_id)
      DO UPDATE SET saldo = public.insumo_saldo.saldo + v_qtd_recebida, atualizado_em = now();

      INSERT INTO public.insumo_saldo_historico (
        insumo_id, unidade_id, tipo, quantidade,
        saldo_anterior, saldo_novo,
        referencia_id, referencia_tipo, usuario_id
      ) VALUES (
        v_item.insumo_id, v_transferencia.unidade_destino_id,
        'entrada_transferencia', v_qtd_recebida,
        v_saldo_antigo, v_saldo_novo,
        p_transferencia_id, 'transferencia', p_usuario_id
      );
    END IF;
  END LOOP;

  v_status_final := CASE WHEN v_tem_divergencia THEN 'RECEBIDO_COM_DIVERGENCIA' ELSE 'RECEBIDO' END;

  UPDATE public.transferencia
  SET
    status                 = v_status_final,
    confirmed_at           = now(),
    responsavel_destino_id = p_usuario_id,
    status_financeiro      = 'a_receber'
  WHERE id = p_transferencia_id;

  RETURN jsonb_build_object('success', true, 'status', v_status_final);
END $$;

GRANT EXECUTE ON FUNCTION public.confirmar_recebimento(UUID, UUID, JSONB) TO authenticated;


-- ── 7. fn_get_user_unidade: usar public.usuario_unidade ───────
-- Atualiza a função para buscar na tabela public em vez de fornada.
CREATE OR REPLACE FUNCTION public.fn_get_user_unidade(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object('id', u.id, 'nome', u.nome)
  INTO v_result
  FROM public.usuario_unidade uu
  JOIN public.unidade u ON u.id = uu.unidade_id
  WHERE uu.user_id = p_user_id
  ORDER BY uu.created_at
  LIMIT 1;

  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_get_user_unidade(uuid) TO authenticated;
