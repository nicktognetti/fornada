# Migrations descartadas — NÃO aplicar

Estes arquivos foram movidos para fora do caminho de execução do Supabase
(o CLI só lê `.sql` na raiz de `migrations/`, não em subpastas). Ficam aqui
apenas como histórico.

## Por que foram descartadas

O sistema migrou para **isolamento por LOJA** em `20260626000001_rls_por_loja.sql`
(políticas `*_loja`, baseadas em `usuario_unidade`). As migrations abaixo são da
geração anterior, **por EMPRESA**, e **conflitam** com esse modelo:

- **`20260624000001_consolidar_rls_por_empresa.sql`** — consolida a RLS mantendo
  só `p_emp` (isolamento por empresa). Aplicar isto **derruba o isolamento por
  loja** — um usuário de uma loja voltaria a ver dados das lojas-irmãs da mesma
  empresa. **Nunca reaplicar.**

- **`20260624000000_correcoes_auditoria_v2.sql`** — backfill opcional de
  `unidade_id` + `security_invoker` em views. Partes já cobertas por migrations
  posteriores (`20260625000000_views_custo_fornada.sql`). Guardado só por
  referência; o backfill é idempotente mas não é necessário.

Nenhuma das duas foi aplicada ao banco de produção (`flor-do-trigo`).
Confirmado em 26/06/2026.
