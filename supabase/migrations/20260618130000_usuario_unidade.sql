-- Vínculo entre usuário Supabase Auth e unidade operacional
-- Usado para auto-preencher ORIGEM/DESTINO no módulo de Transferências
CREATE TABLE IF NOT EXISTS fornada.usuario_unidade (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unidade_id UUID        NOT NULL REFERENCES public.unidade(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_usuario_unidade UNIQUE (user_id, unidade_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_unidade_user
  ON fornada.usuario_unidade(user_id);

CREATE INDEX IF NOT EXISTS idx_usuario_unidade_unidade
  ON fornada.usuario_unidade(unidade_id);

ALTER TABLE fornada.usuario_unidade ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seu próprio vínculo
CREATE POLICY "usuario_unidade_select_own" ON fornada.usuario_unidade
  FOR SELECT USING (user_id = auth.uid());

-- Inserção: service_role (admin) ou o próprio usuário
CREATE POLICY "usuario_unidade_insert_admin" ON fornada.usuario_unidade
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR user_id = auth.uid()
  );

-- Remoção: service_role (admin) ou o próprio usuário
CREATE POLICY "usuario_unidade_delete_admin" ON fornada.usuario_unidade
  FOR DELETE USING (
    auth.role() = 'service_role' OR user_id = auth.uid()
  );

COMMENT ON TABLE fornada.usuario_unidade IS
  'Vínculo usuário → unidade. Popule via SQL Editor para cada operador:
   INSERT INTO fornada.usuario_unidade (user_id, unidade_id)
   SELECT au.id, u.id
   FROM auth.users au, public.unidade u
   WHERE au.email = ''operador@exemplo.com''
     AND u.nome   = ''Morada do Sol'';';
