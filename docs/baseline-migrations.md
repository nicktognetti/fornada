# Runbook — Baseline real das migrations (Lote 5 da auditoria v3)

> **Status: PENDENTE — bloqueado por ferramenta, não por decisão.**
> Ref.: `AUDITORIA_FORNADA_v3.md` §3 (P1-8) e §8 (Lote 5).

## O problema

As migrations em `supabase/migrations/` **documentam** o histórico, mas **não recriam
o banco do zero**. Num `supabase db reset` limpo a cadeia quebra em vários pontos:

| Bloqueio | Onde |
|---|---|
| FKs para `empresa`/`unidade`/`produto` antes dessas tabelas existirem | `20260618120000_transferencia_unidades.sql` |
| `ADD CONSTRAINT IF NOT EXISTS` — **sintaxe inválida** no Postgres | `20260618150000_transferencia_financeiro.sql:36` |
| CTE recursivo que o Postgres recusa (`vw_custo_receita`) | `20260618170000_views_custo.sql:74-165` |
| `fn_get_empresas_usuario()` usada em policies antes de ser criada | `20260620000007`, `20260620000008` vs `20260623000000:49` |
| `ALTER VIEW vw_produto_financeiro` antes do `CREATE VIEW` | `20260620000003:25` vs `20260621000000:109` |
| `usuario_empresa.usuario_id` (a coluna real é `user_id`) | `20260618120000` policies |
| **Drift**: migrations criam `unidade.ativa`, `insumo.unidade_medida`; o banco real (e o código) usam `unidade.ativo`, `insumo.unidade_uso` | vários |
| **Drift**: migration declara `insumo_preco.observacao` e `created_at`; o banco real **não tem `observacao`** e a coluna de data chama `criado_em`. Tem ainda `fornecedor_id`, `unidade_id` e `nota_fiscal_ref`, que a migration não declara (descoberto em 03/08 ao gravar reajuste de custo — quebrou com `PGRST204`) | `20260620000004_schema_central.sql:189-198` |
| `baseline.sql` é vazio — o schema original foi criado à mão no SQL Editor | `20260617150000_baseline.sql` |
| **Drift**: `meta_faturamento` constava como APLICADA no histórico (local e remoto) mas a tabela **nunca existiu** no banco — "salvar meta do mês" no Painel estava quebrado em silêncio. Descoberto em 14/08 no backup de dados; corrigido por `20260814000000_meta_faturamento_faltante.sql` | `20260622000001_meta_faturamento.sql` |

> ⚠️ **O histórico de migrations do Supabase NÃO prova que o SQL rodou.** Já apareceram
> 4 divergências. Ao mexer numa tabela que você não tocou recentemente, confirme que ela
> existe de verdade (um `select` simples resolve) antes de confiar no arquivo da migration.

**Consequência prática:** hoje o `db push` funciona normalmente para migrations novas
(usado nos Lotes 1–3), mas **se o projeto Supabase for perdido, não existe caminho
reproduzível para reconstruir o banco.** É um risco de continuidade, não de operação.

## Por que ainda não foi feito

Gerar a baseline exige `pg_dump` **compatível com o servidor**:

- `supabase db dump` roda o `pg_dump` dentro de um container → **exige Docker Desktop**
  (não instalado na máquina onde a auditoria rodou).
- O `pg_dump` nativo encontrado é **16.14**; o servidor é **PostgreSQL 17.6.1**.
  O `pg_dump` se recusa a exportar de um servidor mais novo que ele.

Poderíamos reconstruir o DDL por introspecção de catálogo, **mas isso foi descartado
de propósito**: sem Docker também não há como rodar o `db reset` que **prova** que a
baseline replica. Uma baseline não testada é pior do que nenhuma — cria confiança
falsa exatamente no cenário de desastre. E a introspecção exigiria criar no banco de
produção uma função que executa SQL arbitrário (backdoor), o que não se justifica.

> ⚠️ **NUNCA** rodar `supabase db reset --linked`: isso **apaga o banco de produção**.
> O `db reset` só pode ser usado contra a instância local (`supabase start`).

## Pré-requisito (escolha um)

- **Docker Desktop** instalado e rodando (caminho recomendado — habilita `db dump` e,
  principalmente, o `db reset` local que valida a baseline); **ou**
- **PostgreSQL 17 client tools** (`pg_dump` 17.x) para o dump, mas aí a validação do
  replay continua dependendo do Docker.

## Procedimento

```bash
# 1. Gerar a baseline a partir do banco REAL (só leitura)
#    Use um timestamp POSTERIOR à última migration aplicada (confira com
#    `npx supabase migration list --linked`) — o exemplo abaixo assume 04/08.
npx supabase db dump --linked --schema public -f supabase/migrations/20260804000000_baseline_real.sql
```

```bash
# 2. Conferir que o dump veio completo (tabelas, funcoes, policies, views)
grep -c "CREATE TABLE" supabase/migrations/20260804000000_baseline_real.sql
grep -c "CREATE POLICY" supabase/migrations/20260804000000_baseline_real.sql
grep -c "CREATE FUNCTION\|CREATE OR REPLACE FUNCTION" supabase/migrations/20260804000000_baseline_real.sql
```

Confira que aparecem os objetos críticos dos Lotes 1–3:
`confirmar_recebimento`, `atualizar_orcamento_com_itens`, `atualizar_encomenda_com_itens`,
`fn_user_unidades`, `fn_is_admin_global`, `fn_get_empresas_usuario`,
`vw_custo_receita`, `vw_produto_financeiro`, `vw_insumo_custo_atual` (esta com
`security_invoker=true`), `atendimento_webhook_evento`, e o índice `uk_permissao_global`.

```bash
# 3. Arquivar a cadeia antiga (histórico preservado, fora do caminho de replay)
mkdir -p supabase/migrations/_descartadas
git mv supabase/migrations/2026061*.sql supabase/migrations/2026062*.sql supabase/migrations/2026070*.sql supabase/migrations/_descartadas/
```

> Mantenha em `supabase/migrations/` **apenas** a baseline nova e as migrations
> posteriores a ela.

```bash
# 4. VALIDAR o replay num banco local limpo — este é o passo que dá o veredito
npx supabase start
npx supabase db reset            # SEM --linked. Roda a baseline do zero.
```

Se o `db reset` terminar sem erro, a baseline replica. Se falhar, **não prossiga**:
corrija o dump (ou regenere) antes do passo 5.

```bash
# 5. Sincronizar o histórico remoto com a nova realidade
#    (repair só mexe na tabela de controle — NÃO roda DDL)
npx supabase migration repair --status reverted --linked \
  20260617150000 20260618120000 20260618130000 20260618140000 20260618150000 \
  20260618160000 20260618170000 20260619000000 20260619010000 20260619020000 \
  20260619030000 20260620000000 20260620000003 20260620000004 20260620000005 \
  20260620000006 20260620000007 20260620000008 20260620000009 20260620000010 \
  20260620000011 20260620000012 20260621000000 20260622000000 20260622000001 \
  20260623000000 20260625000000 20260626000000 20260626000001 20260626000002 \
  20260630000000 20260630000001 20260701000000 20260701000001 20260701000002 \
  20260701000003 20260705000000 20260705000001 20260706000000 20260706000001 \
  20260706000002 20260706000003 20260707000000 20260708000000 20260708120000 \
  20260709000000 20260709100000 20260802000000 20260802010000 20260802020000 \
  20260803000000

npx supabase migration repair --status applied --linked 20260804000000
```

```bash
# 6. Conferir o estado final: local e remoto devem bater
npx supabase migration list --linked
```

## Depois disso

Passa a valer a regra: **toda migration nova só entra se `supabase db reset` local
passar**. Vale automatizar no CI (`supabase start && supabase db reset`) — é o que
impede a cadeia de apodrecer de novo.

## Verificação de que continua valendo

Quando a baseline existir, o teste de fumaça do disaster recovery é:
`supabase db reset` local + rodar a suíte (`npx vitest run`) apontando para o banco
local. Enquanto isso não for possível, o backup do Supabase (PITR do plano) é a
**única** rede de segurança — vale confirmar no painel que está ativo e qual a janela.
