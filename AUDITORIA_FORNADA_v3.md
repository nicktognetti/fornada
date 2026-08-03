# Auditoria Técnica + Produto — Fornada (Flor do Trigo) — **v3**

> Data: 02/08/2026 · Branch: `master` · Último commit: `5824bfa`
> Método: 5 varreduras paralelas independentes (segurança/authz, módulos comerciais, atendimento WhatsApp, banco/migrations, produto/arquitetura) + verificações determinísticas locais. Passada **somente leitura** de código; o estado efetivo do banco **não** foi introspectado (afirmações sobre RLS baseiam-se nas migrations versionadas — onde importa, está indicado "confirmar com `pg_policies`").
> Auditorias anteriores: [AUDITORIA_FORNADA.md](AUDITORIA_FORNADA.md) (18-20/06) e [AUDITORIA_FORNADA_v2.md](AUDITORIA_FORNADA_v2.md) (21/06, score 7,0).

---

## 1. Sumário executivo

**Qualidade determinística — tudo verde (melhor da história do projeto):**

| Verificação | v2 (21/06) | Hoje (02/08) |
|---|---|---|
| `tsc --noEmit` | ✅ 0 erros | ✅ 0 erros |
| Testes (vitest) | 26/26 | ✅ **105/105** (8 arquivos) |
| ESLint | ❌ 1 erro | ✅ limpo |
| `next build` | 17 rotas | ✅ ~30 rotas |
| `any` no código | — | ✅ zero |

Desde a v2 o sistema mais que dobrou: orçamentos, encomendas, clientes, atendimento WhatsApp com IA (em produção), caderno de receitas, RBAC por setor, comanda térmica. A camada de **aplicação** amadureceu muito: RBAC granular consistente na maioria das actions, RLS por loja nas tabelas novas, preço fora do alcance da conversa do robô, cliente unificado entre módulos.

**Onde mora o risco agora: a camada de banco.** O padrão que se repete nos achados críticos é: *a Server Action valida, mas o objeto de banco por baixo (RPC, view, policy) não* — e tudo em `public` é alcançável direto via PostgREST com o JWT de qualquer usuário logado, pulando as actions. Para o cenário atual (1 empresa, equipe pequena e confiável) nada disso é incêndio; para crescer (mais usuários, multi-empresa real), o **Lote 1** abaixo é pré-requisito.

**Score subjetivo: 7,5/10** (v2: 7,0). Subiu pela saúde de build/testes e maturidade dos módulos novos; não subiu mais porque os P1 de banco anulam na prática garantias que a UI promete (isolamento por loja, permissões).

---

## 2. Verificação dos P1 da auditoria v2

| Achado v2 | Status | Evidência |
|---|---|---|
| (a) RLS por unidade anulado por policies empilhadas (OR permissivo) | **PARCIAL** | `20260626000001_rls_por_loja.sql` consolidou de verdade as 6 tabelas core (1 policy `*_loja` por tabela). Porém: leftovers de `20260618140000` têm nomes divergentes dos `DROP POLICY` escritos (seguem empilhados no replay — inofensivos mas sujos); `compra`/`compra_item` ficaram no modelo legado; `transferencia` segue por empresa; e o **self-insert em `usuario_unidade` (P1-2 abaixo) anula o isolamento por loja por outro caminho**. Confirmar estado real com `SELECT tablename, policyname FROM pg_policies`. |
| (b) `confirmarRecebimentoAction` sem ownership | **PARCIAL / ABERTO no banco** | A action foi corrigida ([transferencia.ts:154-192](app/actions/transferencia.ts)) — valida empresa + RBAC. **Mas a RPC `confirmar_recebimento` continua `SECURITY DEFINER`, sem checagem interna e com `GRANT EXECUTE TO authenticated`** — o ataque original permanece viável chamando `/rest/v1/rpc/confirmar_recebimento` direto (P1-1 abaixo). |
| (c) Migrations não reproduzem banco limpo | **ABERTO (piorou)** | Novos casos além dos conhecidos: função usada antes de criada, sintaxe inválida (`ADD CONSTRAINT IF NOT EXISTS`), e **drift** comprovado entre migrations e banco real (`ativa`×`ativo`, `unidade_medida`×`unidade_uso`, `empresa.documento`). Ver P1-8. |
| (d) `vw_custo_receita` recursiva inválida | **PARCIAL** | No banco: corrigida via `20260625000000` (função + view com invoker). Na cadeia: o SQL inválido segue em `20260618170000` (quebra replay); a solução nova herda vazamento da `vw_insumo_custo_atual` sem invoker (P1-4) e não tem guarda de ciclo (P2-14). |
| (e) parseFloat sem parseDecimalBR | **QUASE FECHADO** | Restou 1 ocorrência: [virar-pedido-modal.tsx:32](app/dashboard/atendimento/components/virar-pedido-modal.tsx) (quantidade, impacto baixo). |
| (f) Lint quebrado + console.log debug | **FECHADO** (lint) / console.log de PII persiste no atendimento (P3-3) |

---

## 3. Achados críticos — **Lote 1 (P1)** — corrigir antes de crescer

> Todos os P1 de segurança compartilham o mesmo antídoto: **mover a validação para dentro do objeto de banco** (função/policy), porque PostgREST expõe tudo que tem `GRANT authenticated`.

### P1-1 · RPC `confirmar_recebimento` aberta por chamada direta
`SECURITY DEFINER`, corpo sem checagem de `auth.uid()`/empresa, aceita `p_usuario_id` livre, `GRANT EXECUTE TO authenticated` ([20260620000012:25-89](supabase/migrations/20260620000012_fix_constraint_cancelada_rpc.sql)). Qualquer autenticado com o UUID confirma recebimento de **qualquer** transferência (altera saldo de insumos e status financeiro) e forja o responsável.
**Fix:** dentro da função, validar vínculo do `auth.uid()` com a empresa da transferência e ignorar `p_usuario_id` (usar `auth.uid()`).

### P1-2 · Self-insert em `usuario_unidade` anula o RLS por loja
Policy de INSERT aceita `user_id = auth.uid()` ([20260620000008:60-64](supabase/migrations/20260620000008_mover_fornada_para_public.sql)). Como TODO o modelo por loja deriva de `fn_user_unidades()` que lê essa tabela, qualquer autenticado pode se auto-vincular a qualquer loja da empresa via PostgREST e passar a ler/escrever nela.
**Fix:** migration dropando INSERT/DELETE self; deixar só `service_role` (as actions já usam `supabaseAdmin`).

### P1-3 · `fn_listar_usuarios` expõe PII de todos os usuários
`SECURITY DEFINER` lendo `auth.users` (email, last_sign_in, metadata) sem filtro nem checagem de admin, `GRANT TO authenticated` ([20260619030000:7-39](supabase/migrations/20260619030000_fn_listar_usuarios.sql)). O app nem usa mais (0 referências) — porta dormente.
**Fix:** `DROP FUNCTION` (ou revoke + checagem interna de `fn_is_admin_global()`).

### P1-4 · Views sem `security_invoker` vazam custos cross-empresa
`vw_insumo_custo_atual` ([20260618170000:27-47](supabase/migrations/20260618170000_views_custo.sql)) e `vw_painel_financeiro` ([20260620000000:57-93](supabase/migrations/20260620000000_receita_preco_painel.sql), com `GRANT SELECT` e **morta** — 0 usos) executam como owner → ignoram RLS. Qualquer autenticado lê custo de compra de todas as empresas via REST. E `fn_fornada_custo_receita` lê a primeira, tornando o invoker da `vw_custo_receita` parcialmente cosmético.
**Fix:** `ALTER VIEW vw_insumo_custo_atual SET (security_invoker = true)` + `DROP VIEW vw_painel_financeiro`. (Validar com produto: para usuário restrito, custo de sub-receita de loja não-visível vira 0.)

### P1-5 · `savePermissionsAction` aceita `usuario_id` do payload sem validar
Insere `permissoes[]` via `supabaseAdmin` sem conferir `p.usuario_id === targetUserId` ([permissoes.ts:210-213](app/actions/permissoes.ts)). Admin de uma empresa concede permissões a usuário de **outra** empresa — furo cross-tenant no único controle que barra isso.
**Fix:** forçar `usuario_id: targetUserId` ao montar os rows.

### P1-6 · Edição de orçamento/encomenda: DELETE + INSERT sem transação
[orcamento.ts:174-183](app/actions/orcamento.ts) e [encomenda.ts:263-273](app/actions/encomenda.ts): total atualizado, itens deletados, e se o insert falhar a encomenda fica **com total e zero itens** (comanda imprime vazia). Edições concorrentes intercalam.
**Fix:** RPC transacional (padrão `confirmar_recebimento` bem feito), ou insert-first + delete `not in`.

### P1-7 · Webhook WhatsApp: 4 furos operacionais em produção
1. **Fail-open sem `META_APP_SECRET`** ([assinatura.ts:21](lib/atendimento/assinatura.ts) + [webhook/route.ts:70-72](app/api/atendimento/webhook/route.ts)): sem o env, aceita qualquer POST forjado. Fix: 401 em produção + alerta.
2. **Zero idempotência**: `wamid` nunca é persistido; reentrega da Meta gera resposta e pedido duplicados. Fix: dedup por `wamid` com índice único.
3. **Só a 1ª mensagem do payload**: `entry[0].changes[0].value.messages[0]` — lote da Meta descarta as demais silenciosamente. Fix: iterar os arrays.
4. **Race na criação de conversa**: select-then-insert sem tratar `23505`; cliente novo que manda 2 msgs em <1s perde uma sem resposta ([memoria.ts:38-77](lib/atendimento/memoria.ts)). Fix: upsert `onConflict`.
   Correção-chave que resolve vários de uma vez: **salvar a mensagem do usuário ANTES de chamar a IA** (hoje, se a IA ou o envio falham, a mensagem do cliente não fica registrada em lugar nenhum — [webhook/route.ts:202-209](app/api/atendimento/webhook/route.ts)).

### P1-8 · Migrations não recriam o banco (disaster recovery comprometido)
Cadeia quebra em múltiplos pontos num banco vazio (FKs para tabelas futuras, `ADD CONSTRAINT IF NOT EXISTS` inválido, função usada antes de criada, view recursiva recusada) **e** diverge do banco real (`ativa`×`ativo`, `unidade_medida`×`unidade_uso`, `empresa.documento`). Hoje, se o projeto Supabase se perder, não há caminho reproduzível.
**Fix recomendado:** não remendar — gerar `supabase db dump --schema public` como baseline real (`20260801000000_baseline_real.sql`), mover a cadeia velha para `_descartadas/`, `supabase migration repair`, e a partir daí exigir `db reset` verde para toda migration nova.

---

## 4. Achados P2 (consistência, escopo e robustez)

| # | Achado | Onde | Fix resumido |
|---|---|---|---|
| P2-1 | **`temAcesso` sem `unidadeId`** em ~10 mutações (orcamento, encomenda, cliente, setPausa, setProdutoLocal): usuário com a tela na loja A e vínculo na B edita registros da B | [orcamento.ts:154,260,274](app/actions/orcamento.ts), [encomenda.ts:239,288,313](app/actions/encomenda.ts), [cliente.ts:117,133](app/actions/cliente.ts), [atendimento.ts:183](app/actions/atendimento.ts), [painel.ts:538](app/actions/painel.ts) | passar `{ unidadeId: registro.unidade_id }` (padrão já usado em insumos/receitas) |
| P2-2 | **`linkProdutoReceita` sem RBAC nenhum** — religa produto→ficha mudando custo/preço | [painel.ts:548-566](app/actions/painel.ts) | mesma checagem do `createProdutoFabricado` |
| P2-3 | **`updateItem`/`removeItem` confiam no `receita_id` do form** — edita item de setor proibido e permite gravar ciclo real de sub-receitas | [receitas/actions.ts:395-465](app/dashboard/receitas/actions.ts) | derivar `receita_id` real do item |
| P2-4 | **IDOR leitura**: `getTransferenciaItensAction` via `supabaseAdmin` sem ownership | [transferencia.ts:282-315](app/actions/transferencia.ts) | validar empresa como cancelar/excluir |
| P2-5 | **Escalonamento**: admin "de Configurações" reseta senha do admin global | [permissoes.ts:298-316](app/actions/permissoes.ts) | alvo admin global ⇒ exigir `isAdminGlobal(caller)` |
| P2-6 | **Sem policy DELETE em `transferencia(_item)`** → `excluirTransferenciaAction` retorna `success:true` com 0 linhas (falso sucesso) | [20260620000008](supabase/migrations/20260620000008_mover_fornada_para_public.sql) | criar policies DELETE por empresa |
| P2-7 | **`compra`/`compra_item` no RLS legado** (`get_user_unidade_id()` = 1ª unidade) + `criarCompraAction` sem `temAcesso` | [20260618160000:66-126](supabase/migrations/20260618160000_compra.sql), [compra.ts](app/actions/compra.ts) | recriar policies no padrão `_loja` + RBAC na action |
| P2-8 | **Modal de ficha oferece tipos que o Zod/banco rejeitam** ("Massa", "Recheio" → impossível salvar) | [receita-modal.tsx:17-24](app/dashboard/receitas/components/receita-modal.tsx) | alinhar select ↔ enum ↔ CHECK |
| P2-9 | **`atualizarEncomenda` força `com_valor: true`** — não dá pra editar encomenda do robô sem precificar tudo | [encomenda.ts:256](app/actions/encomenda.ts) | propagar/preservar `com_valor` |
| P2-10 | **Corrida em `virarPedido`** duplica encomenda oficial (duplo clique/2 atendentes) | [atendimento.ts:663-735](app/actions/atendimento.ts) | update guardado `.eq('status','anotada')` antes de criar |
| P2-11 | **Timezone UTC** na expiração de orçamento e filtros de data (expira 21h; filtro desloca 1 dia) | [orcamento-status.ts:16-20](lib/orcamento-status.ts), [orcamentos-list.tsx:33](app/dashboard/orcamentos/components/orcamentos-list.tsx) | dia via `toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})` |
| P2-12 | **Itens inválidos descartados em silêncio no orçamento** (qtd vazia → NaN → item some, total menor) | [orcamento.ts:109-112](app/actions/orcamento.ts) | validação por linha (como encomenda-builder) + erro se `itensCalc.length !== itens.length` |
| P2-13 | **NULL/UNIQUE em `permissao`**: seeders `ON CONFLICT` nunca conflitam p/ permissão global → duplicatas (cadeia já rodou 2×) | [20260619000000:21-23,109-116](supabase/migrations/20260619000000_rbac_permissoes.sql) | dedup + índice único parcial `WHERE unidade_id IS NULL` |
| P2-14 | **`fn_fornada_custo_receita` sem guarda de ciclo** — ciclo de sub-receitas derruba todas as telas de custo | [20260625000000:31-55](supabase/migrations/20260625000000_views_custo_fornada.sql) | limite de profundidade / array de visitados |
| P2-15 | **Prompt injection armazenada** no atendimento: "nome"/"endereço" ditos pelo cliente voltam ao system prompt sem sanitização; e cliente consegue induzir `#ENCOMENDA#` forjada (spam operacional — preço NÃO é forjável, mitigação estrutural confirmada) | [cliente.ts:35-80](lib/atendimento/cliente.ts), [marcadores.ts](lib/atendimento/marcadores.ts) | truncar/sanitizar antes de gravar; validar itens contra catálogo; limitar itens/conversa |
| P2-16 | **Groq sem retry/timeout**; falha de envio WhatsApp ignorada (histórico registra resposta que o cliente nunca recebeu); rate-limit contornável por concorrência; `maxDuration` ausente na rota | [ia.ts:79-96](lib/atendimento/ia.ts), [webhook/route.ts:198-209](app/api/atendimento/webhook/route.ts) | AbortSignal.timeout + retry 429/5xx; checar retorno do envio; salvar msg antes da IA; `export const maxDuration = 60` |
| P2-17 | **Excluir ficha não bloqueia com produto fabricado ligado** → produto ativo órfão sem custo | [receitas/actions.ts:230-255](app/dashboard/receitas/actions.ts) | checar `produto.receita_id` ativo antes |
| P2-18 | **Catálogo de preços vaza** para quem "não vê valores" via página Nova Encomenda | [nova/page.tsx:10](app/dashboard/encomendas/nova/page.tsx) | decidir regra e aplicar dos dois lados |
| P2-19 | **Token de comandas em query string** + comparação não constante + escopo todas as lojas (PII de clientes) | [comandas/route.ts:16-40](app/api/atendimento/comandas/route.ts) | header Authorization + `timingSafeEqual` + token por unidade |
| P2-20 | **Meta de faturamento sem RBAC de tela** (qualquer usuário da empresa altera) | [empresa.ts:156-201](app/actions/empresa.ts) | exigir `temAcesso(['painel'])` |

---

## 5. Achados P3 (menores)

- **`ClientesList` espelha prop em estado** (antipadrão que dcf1562 removeu de produtos) — dados não atualizam após revalidate ([clientes-list.tsx:12](app/dashboard/clientes/components/clientes-list.tsx)).
- **`%` de ajuste em edição aplica sobre preço já ajustado** (juros compostos: +10% duas vezes = +21%) — [orcamento-builder.tsx:46](app/dashboard/orcamentos/components/orcamento-builder.tsx), [encomenda-builder.tsx:54](app/dashboard/encomendas/components/encomenda-builder.tsx).
- **PII em `console.log`**: telefone e conteúdo integral de mensagens nos logs da Vercel ([webhook/route.ts:97,158,239](app/api/atendimento/webhook/route.ts)).
- **Sequences de numeração globais** entre lojas/empresas e sem UNIQUE na coluna `numero`.
- **`cliente` sem índice único `(unidade_id, telefone)`** → duplicata por corrida no webhook.
- **`insumo` sem UNIQUE de nome** por loja (evitaria duplicar no próximo import).
- **Badge de revisões pendentes conta todas as lojas** ([receitas/actions.ts:766-776](app/dashboard/receitas/actions.ts)).
- **Schema `fornada` fantasma** (tabelas congeladas + views antigas sem invoker) nunca dropado.
- **`fn_get_user_unidade(p_user_id)`** aceita qualquer user id (leak menor de loja).
- **Convenção frágil "PENDENTE"** por substring de nome de insumo atravessando 2 módulos — merece flag booleano.
- **Timeline da encomenda usa `Date.now()` do client** (relógio do tablet).
- **`loading.tsx` faltando** em atendimento, caderno, clientes e simulador.
- **A11y**: só 30 `aria-label`; botões-ícone com `title` apenas; inputs sem label em painel-tabela.
- **Índices recomendados** (migration única): `encomenda(unidade_id, data_entrega)`, `encomenda(unidade_id, status)`, `orcamento(unidade_id, created_at DESC)`, `cliente(unidade_id, telefone) UNIQUE parcial`, `atendimento_conversa(unidade_id, canal, atualizado_em DESC)`, `permissao(usuario_id, tela)`, parciais `WHERE ativo` em insumo/receita/produto `(unidade_id, nome)`.

---

## 6. Débito arquitetural (não urgente, meio dia resolve o grosso)

1. **`ActionResult` definido 11×**, **`getEmpresaId` 7×**, **`getUnidadeEscrita` 5×** — consolidar em `app/lib`.
2. **3 toasts locais divergentes + 1 `alert()`** — falta toaster global.
3. **`formatData` repetido ~10×** + hack timezone `-03:00` em 3 lugares — centralizar em `lib/format.ts`.
4. **`revalidatePath` (91×) × `router.refresh()` (20×)** coexistindo — refresh duplo em alguns fluxos.
5. **Arquivos >450 linhas** que merecem quebra: `permissoes-tab.tsx` (822), `receitas/actions.ts` (776), `atendimento.ts` (735), `painel.ts` (659, 13 exports misturando 3 domínios), `ficha-view.tsx` (518), `painel-tabela.tsx` (510).
6. **Testes faltando no crítico**: cálculo de custo de ficha (`composicao.ts` — extrair função pura), conversão ×1000 base→unidade grande no orçamento, `getPainelFinanceiro`, fluxo builder→action com itens NaN.

**O que está bom e não deve ser mexido:** zero `any`; moeda centralizada; cliente unificado Atendimento↔Clientes; caderno reusa cozinha-view; BFS de ciclo nas actions; histórico de preço INSERT-only; webhook 200-rápido+`after()`; preço estruturalmente fora do alcance da conversa do robô; RLS das tabelas novas nasceu no padrão limpo.

---

## 7. Gaps de produto e roadmap de incrementos

### Gaps de coesão detectados
- **Orçamento aprovado NÃO vira encomenda** — usuário redigita tudo; o Atendimento já tem esse fluxo pronto (`virarPedido`). Gap nº 1, barato de fechar.
- **Estoque é write-only e invisível**: `insumo_saldo` só recebe de transferências, nada dá baixa, e nenhuma tela exibe. Compras não lançam itens nem alimentam saldo.
- **Financeiro é 100% "planejado"**: sem registro de venda/produção, margem real é impossível (o código admite em [painel.ts:40](app/actions/painel.ts)).
- **Funil do robô começa na anotação** — conversas que não geraram pedido (topo do funil) não são medidas.
- **4 telas definem preço** (Painel tabela, Precificação, Precificador, Preços) — consistentes no dado, confusas no fluxo.

### Roadmap priorizado (valor ÷ esforço)

| # | Incremento | Valor | Esforço | Dependências |
|---|---|---|---|---|
| 1 | Orçamento aprovado → Encomenda em 1 clique | Elimina redigitação no fluxo formal de venda | **P** | Nenhuma (reusar `criarEncomenda`) |
| 2 | Tela de Estoque (saldo por loja + histórico) | Torna visível dado que já existe | **P** | Nenhuma |
| 3 | Plano de produção do dia (encomendas × data × setor) | "Amanhã: 12kg pão de queijo (Confeitaria)" | **P** | Nenhuma |
| 4 | Métricas do robô nível conversa (funil completo, 1ª resposta) | Prova ROI do agente pra Natali | **P** | Nenhuma |
| 5 | Compra com itens + reajuste de custo via import ERP/NFe | Ataca a dor real: custo hoje é cadastro fixo | **M** | Formato do export; matching do import 14/07 |
| 6 | Registro de produção/venda diária | Pré-requisito de margem real e baixa de estoque | **M** | Decisão de UX com a Natali |
| 7 | Baixa de estoque por produção (explode ficha → debita saldo) | Fecha o ciclo; alerta "vai faltar farinha" | **M** | 5 + 6 |
| 8 | Margem real vs planejada no Painel | "Quanto ganhei de fato este mês?" | **M** | 6 (+5 ideal) |
| 9 | Curva ABC de produtos | Orienta o que promover no robô | **P** | Nenhuma p/ v1 |
| 10 | Auditoria de alterações (quem mudou preço, quando) | Confiança com 2 lojas e múltiplos usuários | **P/M** | `changed_by` + trigger |
| 11 | PWA do Modo Cozinha (standalone + wake-lock) | Tablet na bancada sem tela apagando | **P** | Nenhuma |
| 12 | Backup/export xlsx (insumos, fichas, preços, clientes) | Segurança percebida + porta de saída honesta | **P** | Nenhuma |

Sequência sugerida: **1-4** (semana de quick wins) → **5** (dor declarada do cliente) → **6+7+8** (bloco "operação real") → 9-12 conforme folga. Consolidado multi-empresa: adiar até existir 2ª empresa real.

---

## 8. Plano de ação recomendado

**Lote 1 — Hardening de banco (1 migration + 2 fixes de action, ~1 dia):**
P1-1 (RPC recebimento), P1-2 (self-insert), P1-3 (drop fn_listar_usuarios), P1-4 (invoker nas views), P1-5 (usuario_id forçado), P2-6 (DELETE policy), P2-13 (dedup permissao), + índices da seção 5.

**Lote 2 — Atendimento robusto (~1 dia):**
P1-7 completo (fail-closed, dedup wamid, iterar lote, upsert conversa, salvar msg antes da IA) + P2-16 (retry/timeout/maxDuration) + P2-10 (guarda no virarPedido).

**Lote 3 — Consistência comercial (~1 dia):**
P1-6 (RPC transacional de edição), P2-1 (unidadeId nos temAcesso), P2-8/P2-9 (modal tipos + com_valor), P2-11 (timezone), P2-12 (itens NaN).

**Lote 4 — Higiene (meio dia):**
Débitos da seção 6 (helpers, toaster, formatData) + P3s baratos.

**Lote 5 — Baseline real das migrations — ⚠️ BLOQUEADO POR FERRAMENTA:**
P1-8 exige `pg_dump` compatível com o servidor (PG 17.6). O `supabase db dump` roda em
container (**precisa de Docker Desktop**, não instalado) e o `pg_dump` nativo da máquina
é 16.14 — recusa servidor mais novo. Sem Docker também não há como rodar o `db reset`
local que **prova** que a baseline replica, e baseline não testada dá confiança falsa
justamente no cenário de desastre. Procedimento completo, com a lista exata das 50
versões para o `migration repair`, em **[docs/baseline-migrations.md](docs/baseline-migrations.md)** —
vira tarefa de ~15 min assim que houver Docker.

> Enquanto isso, o backup/PITR do plano Supabase é a **única** rede de segurança contra
> perda do projeto — vale confirmar no painel que está ativo e qual a janela de retenção.

Depois disso, roadmap da seção 7 começando pelos quick wins 1-4.
