-- ============================================================
-- Migration: Módulo Transferência entre Unidades
-- Data: 18/06/2026
-- Executar diretamente no Supabase SQL Editor
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 0. Schema (cria se ainda não existir)
-- ────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS fornada;


-- ────────────────────────────────────────────────────────────
-- 1. Sequences de numeração anual
--    fn_gerar_codigo_transferencia cria sequences de anos futuros
--    automaticamente — estas cobrem 2026.
-- ────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS fornada.seq_transferencia_trf_2026 START 1;
CREATE SEQUENCE IF NOT EXISTS fornada.seq_transferencia_dev_2026 START 1;


-- ────────────────────────────────────────────────────────────
-- 2. Tabela principal: transferencia
--    Tabelas do projeto (empresa, unidade, produto) vivem no
--    schema public — referenciadas com o prefixo public.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fornada.transferencia (
    id                      uuid            NOT NULL DEFAULT gen_random_uuid(),
    empresa_id              uuid            NOT NULL,
    unidade_origem_id       uuid            NOT NULL,
    unidade_destino_id      uuid            NOT NULL,
    tipo                    varchar(20)     NOT NULL,
    codigo                  varchar(20)     NOT NULL,
    status                  varchar(30)     NOT NULL DEFAULT 'PENDENTE',
    responsavel_origem_id   uuid            NOT NULL,
    responsavel_destino_id  uuid,
    observacao              text,
    created_at              timestamptz     NOT NULL DEFAULT now(),
    confirmed_at            timestamptz,

    CONSTRAINT pk_transferencia
        PRIMARY KEY (id),

    CONSTRAINT uq_transferencia_codigo
        UNIQUE (codigo),

    CONSTRAINT fk_transferencia_empresa
        FOREIGN KEY (empresa_id) REFERENCES public.empresa(id),

    CONSTRAINT fk_transferencia_unidade_origem
        FOREIGN KEY (unidade_origem_id) REFERENCES public.unidade(id),

    CONSTRAINT fk_transferencia_unidade_destino
        FOREIGN KEY (unidade_destino_id) REFERENCES public.unidade(id),

    CONSTRAINT fk_transferencia_responsavel_origem
        FOREIGN KEY (responsavel_origem_id) REFERENCES auth.users(id),

    CONSTRAINT fk_transferencia_responsavel_destino
        FOREIGN KEY (responsavel_destino_id) REFERENCES auth.users(id),

    CONSTRAINT ck_transferencia_tipo
        CHECK (tipo IN ('TRANSFERENCIA', 'DEVOLUCAO')),

    CONSTRAINT ck_transferencia_status
        CHECK (status IN ('PENDENTE', 'EM_TRANSITO', 'RECEBIDO', 'RECEBIDO_COM_DIVERGENCIA')),

    -- Não faz sentido transferir para a mesma unidade
    CONSTRAINT ck_transferencia_unidades_distintas
        CHECK (unidade_origem_id <> unidade_destino_id),

    -- confirmed_at obrigatório quando status é final
    CONSTRAINT ck_transferencia_confirmed_at
        CHECK (
            NOT (
                status IN ('RECEBIDO', 'RECEBIDO_COM_DIVERGENCIA')
                AND confirmed_at IS NULL
            )
        ),

    -- Devolução exige motivo
    CONSTRAINT ck_transferencia_devolucao_motivo
        CHECK (
            NOT (tipo = 'DEVOLUCAO' AND observacao IS NULL)
        )
);

COMMENT ON TABLE fornada.transferencia IS
    'Registro de transferências e devoluções de produtos entre unidades da empresa.';
COMMENT ON COLUMN fornada.transferencia.tipo IS
    'TRANSFERENCIA = envio normal; DEVOLUCAO = retorno ao ponto de origem.';
COMMENT ON COLUMN fornada.transferencia.codigo IS
    'Código legível gerado por fn_gerar_codigo_transferencia. Ex: TRF-001/2026, DEV-003/2026.';
COMMENT ON COLUMN fornada.transferencia.status IS
    'Ciclo: PENDENTE → EM_TRANSITO → RECEBIDO ou RECEBIDO_COM_DIVERGENCIA.';
COMMENT ON COLUMN fornada.transferencia.observacao IS
    'Obrigatório para devoluções (motivo). Opcional para transferências normais.';
COMMENT ON COLUMN fornada.transferencia.confirmed_at IS
    'Preenchido pelo responsável de destino ao confirmar recebimento.';


-- ────────────────────────────────────────────────────────────
-- 3. Tabela de itens: transferencia_item
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fornada.transferencia_item (
    id                  uuid            NOT NULL DEFAULT gen_random_uuid(),
    transferencia_id    uuid            NOT NULL,
    produto_id          uuid            NOT NULL,
    quantidade_enviada  numeric(12, 4)  NOT NULL,
    quantidade_recebida numeric(12, 4),
    status_item         varchar(20)     NOT NULL DEFAULT 'PENDENTE',
    motivo_divergencia  text,

    CONSTRAINT pk_transferencia_item
        PRIMARY KEY (id),

    -- Cascade: remover itens quando a transferência for excluída
    CONSTRAINT fk_transferencia_item_transferencia
        FOREIGN KEY (transferencia_id)
        REFERENCES fornada.transferencia(id) ON DELETE CASCADE,

    CONSTRAINT fk_transferencia_item_produto
        FOREIGN KEY (produto_id) REFERENCES public.produto(id),

    CONSTRAINT ck_transferencia_item_qtd_enviada
        CHECK (quantidade_enviada > 0),

    CONSTRAINT ck_transferencia_item_status
        CHECK (status_item IN ('PENDENTE', 'RECEBIDO', 'DIFERENCA', 'AUSENTE')),

    -- Motivo obrigatório quando há divergência de quantidade
    CONSTRAINT ck_transferencia_item_motivo_divergencia
        CHECK (
            NOT (status_item = 'DIFERENCA' AND motivo_divergencia IS NULL)
        )
);

COMMENT ON TABLE fornada.transferencia_item IS
    'Itens de uma transferência: produto enviado e resultado da conferência no recebimento.';
COMMENT ON COLUMN fornada.transferencia_item.status_item IS
    'PENDENTE = aguarda conferência; RECEBIDO = ok; DIFERENCA = qtd divergente; AUSENTE = não chegou.';
COMMENT ON COLUMN fornada.transferencia_item.motivo_divergencia IS
    'Obrigatório quando status_item = DIFERENCA.';


-- ────────────────────────────────────────────────────────────
-- 4. Função: fn_gerar_codigo_transferencia
--    Marcada VOLATILE (não STABLE) pois usa nextval — efeito colateral.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fornada.fn_gerar_codigo_transferencia(p_tipo varchar)
RETURNS varchar
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_ano       text    := to_char(now(), 'YYYY');
    v_seq_name  text;
    v_num       text;
    v_codigo    varchar(20);
BEGIN
    IF p_tipo = 'TRANSFERENCIA' THEN
        v_seq_name := 'fornada.seq_transferencia_trf_' || v_ano;
    ELSIF p_tipo = 'DEVOLUCAO' THEN
        v_seq_name := 'fornada.seq_transferencia_dev_' || v_ano;
    ELSE
        RAISE EXCEPTION 'Tipo inválido: %. Use TRANSFERENCIA ou DEVOLUCAO.', p_tipo;
    END IF;

    -- Cria a sequence do ano corrente se ainda não existir (idempotente)
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %s START 1', v_seq_name);

    -- Avança e formata com zero-padding (3 dígitos)
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
END;
$$;

COMMENT ON FUNCTION fornada.fn_gerar_codigo_transferencia(varchar) IS
    'Gera código único por tipo e ano (TRF-NNN/AAAA ou DEV-NNN/AAAA). Cria a sequence anual automaticamente.';


-- ────────────────────────────────────────────────────────────
-- 5. Função: fn_validar_estoque (placeholder)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fornada.fn_validar_estoque(
    p_produto_id  uuid,
    p_quantidade  numeric,
    p_unidade_id  uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    -- Placeholder: validação real será implementada com controle de estoque futuro
    SELECT true;
$$;

COMMENT ON FUNCTION fornada.fn_validar_estoque(uuid, numeric, uuid) IS
    'Placeholder — retorna true. Implementar saldo real junto ao módulo de controle de estoque.';


-- ────────────────────────────────────────────────────────────
-- 6. Views
-- ────────────────────────────────────────────────────────────

-- 6.1 Transferências em trânsito aguardando recebimento
CREATE OR REPLACE VIEW fornada.vw_transferencias_pendentes AS
SELECT
    t.id,
    t.empresa_id,
    t.codigo,
    t.tipo,
    uo.nome                                         AS unidade_origem_nome,
    ud.nome                                         AS unidade_destino_nome,
    COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        au.email
    )                                               AS responsavel_origem_nome,
    (
        SELECT COUNT(*)::int
        FROM fornada.transferencia_item ti
        WHERE ti.transferencia_id = t.id
    )                                               AS total_itens,
    t.observacao,
    t.created_at
FROM fornada.transferencia t
JOIN public.unidade uo ON uo.id = t.unidade_origem_id
JOIN public.unidade ud ON ud.id = t.unidade_destino_id
LEFT JOIN auth.users au ON au.id = t.responsavel_origem_id
WHERE t.status = 'EM_TRANSITO'
ORDER BY t.created_at ASC;

COMMENT ON VIEW fornada.vw_transferencias_pendentes IS
    'Transferências em trânsito aguardando conferência na unidade de destino.';


-- 6.2 Histórico das últimas 50 transferências
CREATE OR REPLACE VIEW fornada.vw_transferencias_recentes AS
SELECT
    t.id,
    t.empresa_id,
    t.codigo,
    t.tipo,
    uo.nome                                         AS origem_nome,
    ud.nome                                         AS destino_nome,
    t.status,
    COALESCE(
        au_orig.raw_user_meta_data->>'full_name',
        au_orig.raw_user_meta_data->>'name',
        au_orig.email
    )                                               AS responsavel_origem_nome,
    COALESCE(
        au_dest.raw_user_meta_data->>'full_name',
        au_dest.raw_user_meta_data->>'name',
        au_dest.email
    )                                               AS responsavel_destino_nome,
    (
        SELECT COUNT(*)::int
        FROM fornada.transferencia_item ti
        WHERE ti.transferencia_id = t.id
    )                                               AS total_itens,
    (
        SELECT COUNT(*)::int
        FROM fornada.transferencia_item ti
        WHERE ti.transferencia_id = t.id
          AND ti.status_item = 'DIFERENCA'
    )                                               AS divergencias,
    t.created_at,
    t.confirmed_at
FROM fornada.transferencia t
JOIN public.unidade uo    ON uo.id    = t.unidade_origem_id
JOIN public.unidade ud    ON ud.id    = t.unidade_destino_id
LEFT JOIN auth.users au_orig ON au_orig.id = t.responsavel_origem_id
LEFT JOIN auth.users au_dest ON au_dest.id = t.responsavel_destino_id
ORDER BY t.created_at DESC
LIMIT 50;

COMMENT ON VIEW fornada.vw_transferencias_recentes IS
    'Últimas 50 transferências com totais de itens e divergências.';


-- 6.3 Totalizadores por empresa para o dashboard
CREATE OR REPLACE VIEW fornada.vw_dashboard_transferencias AS
WITH base AS (
    SELECT
        t.empresa_id,
        t.id            AS transferencia_id,
        t.status,
        t.created_at,
        COALESCE(
            (
                SELECT SUM(ti.quantidade_enviada)
                FROM fornada.transferencia_item ti
                WHERE ti.transferencia_id = t.id
            ),
            0
        )               AS total_qtd_enviada
    FROM fornada.transferencia t
)
SELECT
    empresa_id,
    COUNT(*) FILTER (
        WHERE created_at::date = current_date
    )                                               AS transferencias_hoje,
    COUNT(*) FILTER (
        WHERE status = 'EM_TRANSITO'
    )                                               AS pendentes_recebimento,
    COUNT(*) FILTER (
        WHERE status = 'RECEBIDO_COM_DIVERGENCIA'
          AND created_at >= current_date - interval '7 days'
    )                                               AS com_divergencia_ultimos_7_dias,
    COALESCE(
        SUM(total_qtd_enviada) FILTER (
            WHERE created_at::date = current_date
        ),
        0
    )                                               AS total_itens_transferidos_hoje
FROM base
GROUP BY empresa_id;

COMMENT ON VIEW fornada.vw_dashboard_transferencias IS
    'Totalizadores por empresa: transferências hoje, pendentes, divergências recentes e volume do dia.';


-- ────────────────────────────────────────────────────────────
-- 7. Índices
-- ────────────────────────────────────────────────────────────

-- Consultas por empresa + status (caso de uso mais comum)
CREATE INDEX IF NOT EXISTS idx_transferencia_empresa_status
    ON fornada.transferencia(empresa_id, status);

-- Histórico por unidade de origem com ordenação temporal
CREATE INDEX IF NOT EXISTS idx_transferencia_origem
    ON fornada.transferencia(unidade_origem_id, created_at DESC);

-- Pendências por unidade de destino
CREATE INDEX IF NOT EXISTS idx_transferencia_destino
    ON fornada.transferencia(unidade_destino_id, status);

-- Busca por código (exibição, pesquisa)
CREATE INDEX IF NOT EXISTS idx_transferencia_codigo
    ON fornada.transferencia(codigo);

-- JOIN mais frequente: itens de uma transferência
CREATE INDEX IF NOT EXISTS idx_transferencia_item_transferencia
    ON fornada.transferencia_item(transferencia_id);

-- Relatórios de movimentação por produto
CREATE INDEX IF NOT EXISTS idx_transferencia_item_produto
    ON fornada.transferencia_item(produto_id);


-- ────────────────────────────────────────────────────────────
-- 8. Row Level Security (RLS)
--    Mesmo padrão das tabelas existentes: isolamento por empresa_id
--    via tabela public.usuario_empresa. Filtro fino por unidade
--    feito na Server Action, não aqui.
-- ────────────────────────────────────────────────────────────

ALTER TABLE fornada.transferencia      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornada.transferencia_item ENABLE ROW LEVEL SECURITY;


-- ── Políticas para fornada.transferencia ───────────────────

-- Leitura: usuário vê transferências da sua empresa
CREATE POLICY select_transferencia ON fornada.transferencia
    FOR SELECT
    USING (
        empresa_id IN (
            SELECT ue.empresa_id
            FROM public.usuario_empresa ue
            WHERE ue.usuario_id = auth.uid()
        )
    );

-- Criação: empresa deve ser a do usuário e ele deve ser o responsável de origem
CREATE POLICY insert_transferencia ON fornada.transferencia
    FOR INSERT
    WITH CHECK (
        empresa_id IN (
            SELECT ue.empresa_id
            FROM public.usuario_empresa ue
            WHERE ue.usuario_id = auth.uid()
        )
        AND responsavel_origem_id = auth.uid()
    );

-- Atualização: ex. confirmar recebimento, atualizar status
CREATE POLICY update_transferencia ON fornada.transferencia
    FOR UPDATE
    USING (
        empresa_id IN (
            SELECT ue.empresa_id
            FROM public.usuario_empresa ue
            WHERE ue.usuario_id = auth.uid()
        )
    )
    WITH CHECK (
        empresa_id IN (
            SELECT ue.empresa_id
            FROM public.usuario_empresa ue
            WHERE ue.usuario_id = auth.uid()
        )
    );


-- ── Políticas para fornada.transferencia_item ──────────────

-- Leitura: herda acesso via transferência pai (mesma empresa)
CREATE POLICY select_transferencia_item ON fornada.transferencia_item
    FOR SELECT
    USING (
        transferencia_id IN (
            SELECT t.id
            FROM fornada.transferencia t
            WHERE t.empresa_id IN (
                SELECT ue.empresa_id
                FROM public.usuario_empresa ue
                WHERE ue.usuario_id = auth.uid()
            )
        )
    );

-- Criação: item só pode ser criado em transferência da empresa do usuário
CREATE POLICY insert_transferencia_item ON fornada.transferencia_item
    FOR INSERT
    WITH CHECK (
        transferencia_id IN (
            SELECT t.id
            FROM fornada.transferencia t
            WHERE t.empresa_id IN (
                SELECT ue.empresa_id
                FROM public.usuario_empresa ue
                WHERE ue.usuario_id = auth.uid()
            )
        )
    );

-- Atualização: durante conferência de recebimento
CREATE POLICY update_transferencia_item ON fornada.transferencia_item
    FOR UPDATE
    USING (
        transferencia_id IN (
            SELECT t.id
            FROM fornada.transferencia t
            WHERE t.empresa_id IN (
                SELECT ue.empresa_id
                FROM public.usuario_empresa ue
                WHERE ue.usuario_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        transferencia_id IN (
            SELECT t.id
            FROM fornada.transferencia t
            WHERE t.empresa_id IN (
                SELECT ue.empresa_id
                FROM public.usuario_empresa ue
                WHERE ue.usuario_id = auth.uid()
            )
        )
    );


-- ────────────────────────────────────────────────────────────
-- FIM DA MIGRATION
--
-- Verificação pós-execução:
--   SELECT tablename FROM pg_tables
--   WHERE schemaname = 'fornada';
--
--   SELECT viewname FROM pg_views
--   WHERE schemaname = 'fornada';
--
--   SELECT proname FROM pg_proc
--   JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
--   WHERE n.nspname = 'fornada';
-- ────────────────────────────────────────────────────────────
