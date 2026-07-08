-- ============================================================
-- Migration: Caderno de Receitas
--   Evolui a Ficha Técnica (custo) para incluir o "modo de fazer"
--   que a confeitaria hoje guarda no caderno:
--     - passos:             modo de preparo (lista numerada, JSONB)
--     - tempo_preparo_min:  tempo de mão na massa (minutos)
--     - temperatura_forno:  °C
--     - tempo_forno_min:    minutos no forno
--     - dificuldade:        facil | media | dificil
--     - foto_url:           foto do resultado (bucket receita-fotos)
-- Data: 08/07/2026
-- ============================================================

-- ── 1. Colunas novas em receita ──────────────────────────────
-- Aditivas e opcionais: fichas existentes seguem funcionando.
ALTER TABLE public.receita
  ADD COLUMN IF NOT EXISTS passos             JSONB   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tempo_preparo_min  INTEGER CHECK (tempo_preparo_min IS NULL OR tempo_preparo_min > 0),
  ADD COLUMN IF NOT EXISTS temperatura_forno  INTEGER CHECK (temperatura_forno IS NULL OR temperatura_forno > 0),
  ADD COLUMN IF NOT EXISTS tempo_forno_min    INTEGER CHECK (tempo_forno_min   IS NULL OR tempo_forno_min   > 0),
  ADD COLUMN IF NOT EXISTS dificuldade        TEXT    CHECK (dificuldade IS NULL OR dificuldade IN ('facil','media','dificil')),
  ADD COLUMN IF NOT EXISTS foto_url           TEXT;

COMMENT ON COLUMN public.receita.passos IS
  'Modo de preparo: array JSON de strings (passos numerados na ordem).';
COMMENT ON COLUMN public.receita.foto_url IS
  'URL pública da foto do resultado (bucket receita-fotos).';

-- ── 2. Bucket de fotos de receita (Storage) ──────────────────
-- Público para leitura; upload/remoção passam pelo service role
-- (Server Action) — sem policy de escrita, igual produto-fotos.
INSERT INTO storage.buckets (id, name, public)
VALUES ('receita-fotos', 'receita-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- ── Verificação ──────────────────────────────────────────────
--   select column_name from information_schema.columns
--     where table_name = 'receita' and column_name in
--     ('passos','tempo_preparo_min','temperatura_forno','tempo_forno_min','dificuldade','foto_url');
--   select id, public from storage.buckets where id = 'receita-fotos';
