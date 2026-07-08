-- Permissão do Caderno restringível por setor/local (Confeitaria, Produção…).
-- NULL ou vazio = todos os setores. Só é considerada para a tela 'caderno'.
-- O usuário de produção passa a ver/criar/editar só receitas dos setores liberados
-- (além do escopo por unidade que já existe).
ALTER TABLE public.permissao ADD COLUMN IF NOT EXISTS locais TEXT[];
