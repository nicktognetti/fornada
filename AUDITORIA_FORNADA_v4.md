# AUDITORIA FORNADA v4 — pente fino completo

> **Data:** 2026-09-10 · **Método:** 6 auditores em paralelo (fluxo insumo→receita · dashboard 1 · dashboard 2 · segurança/banco · verificação das auditorias v1–v3 · atendimento/componentes), todos somente leitura sobre o código de `master` (`8d278a0`).
> **Motivação:** Natali reporta "lancei X e não apareceu em Y" e travamentos no uso diário.
> **Regra desta v4 (do ROTEIRO-AUDITORIA-AGENTES.md):** só entra o que foi **verificado no código**, com `arquivo:linha`. O que depende do dashboard do Supabase está marcado como NÃO VERIFICADO.

Estado determinístico no dia da auditoria: `tsc --noEmit` 0 erros · `vitest` 137/137 · `eslint` **5 erros + 1 warning (regressão — v3 registrava limpo)**.

---

## ⚡ Adendo 11–13/09 — o que a validação EM PRODUÇÃO mudou

Testado ao vivo na base real (Morada do Sol, 1112 insumos, 933 fichas), na branch `fix/auditoria-v4-lote-a`:

| | Achado | Estado |
|---|---|---|
| 🔴 | **Causa-raiz do "lancei e não apareceu":** o filtro `.in(ids)` vai na URL; com 1000+ UUIDs o PostgREST rejeitava a request e o `{error}` era engolido → **100% dos insumos apareciam "Sem preço"** na listagem e no grid de precificar → a Natali reprecificava → preço duplicado no mesmo dia → custo dobrado (§1.1). O ciclo completo do bug, reproduzido | ✅ `6d92d6e` — `app/lib/in-lotes.ts` (lotes de 150 ids, lança em erro) aplicado em insumos, precificar, resumo, painel, compras |
| 🔴 | **Max Rows da API do Supabase estava em 1000** — o `range(0,4999)` do código nunca passou de 1000 (insumo nº 1001+ por nome sumia) | ✅ Elevado para 10000 no dashboard (Nicholas, 11/09). É config do projeto, não código |
| 🔴 | **Drift P1-8 confirmado 2×** ao aplicar as migrations: `insumo_preco.created_at` não existia no banco real (a migration de junho declara); `fn_get_user_unidade` tinha tipo de retorno divergente (REPLACE falhou) | ✅ `a26200b` (ADD COLUMN IF NOT EXISTS) e `0f9c762` (DROP+CREATE). Aplicadas em produção por Nicholas |
| 🟠 | **Ficha excluída continuava na lista** — `deleteReceita` é soft delete (`ativo=false`), mas `receitas/page.tsx` lia `vw_custo_receita` sem `.eq('ativo', true)` | ✅ `6fdf180` |
| 🟡 | **Não existe excluir/inativar insumo** — `insumos/actions.ts` só tem criar, editar, preço. Insumo cadastrado errado fica para sempre (só SQL tira) | ⬜ Backlog — decidir: botão "Inativar" (soft, como ficha) ou excluir quando sem uso |
| ✅ | Desempate do §1.1 validado: insumo com R$ 10 e R$ 20 no mesmo dia → ficha de 100 g custou **R$ 2,00** (seria R$ 3,00 com o bug) | provado em tela |
| ✅ | Remover ingrediente, criar insumo (aparece na hora), troca de loja, filtro "Com preço" | provados em tela |

**Não testado em tela** (fica para a Natali no uso): transferências à noite (§1.3), conferência com NaN (§1.6), mensagens novas em conversa 200+ (§1.7), pedido repetido do robô (§1.8).

---

## 0. Leitura executiva

O núcleo está bom: dinheiro com `round2` consistente, custo calculado no banco com guarda de ciclo, RLS em todas as 36 tabelas das migrations, views com `security_invoker`, webhook do WhatsApp bem defendido, 7 dos 8 P1 da v3 confirmados corrigidos **no código** (não só no papel).

Os bugs que a Natali sente vêm de **5 padrões repetidos nas bordas**:

| # | Padrão | Sintoma para ela |
|---|---|---|
| A | Teto de 1000 linhas do supabase-js em queries sem `.range()` | item novo "some" da lista/painel |
| B | `{error}` do supabase-js ignorado (ele **não lança**, retorna) | clicou, nada aconteceu, nenhuma mensagem — ou "excluí e voltou" |
| C | Data UTC (`toISOString`) em vez de `hojeBR()` | depois das 21h tudo cai no dia errado |
| D | Estado client congelado (`useState(props)`) + revalidação estreita + cache do back/forward | tela mostra dado velho até F5 |
| E | Criação em 2 inserts sem transação | cabeçalho órfão sem itens + duplicata no re-clique |

---

## 1. P1 — a Natali esbarra nisso (corrigir primeiro)

### 1.1 Dois preços no mesmo dia DOBRAM o custo do insumo em todas as fichas
- `supabase/migrations/20260618170000_views_custo.sql:27-47` — `vw_insumo_custo_atual` casa `vigente_desde = MAX(vigente_desde)`, e `vigente_desde` é DATE sem hora → 2 preços no mesmo dia = 2 linhas no join.
- `app/dashboard/insumos/actions.ts:160-166` (`addPreco`) e `:227` (`addPrecosLote`) sempre inserem com `vigente_desde = hoje`. Corrigir um preço digitado errado no mesmo dia é o caminho natural — e dispara o bug.
- Consequências: `fn_fornada_custo_receita` (`20260814010000`) faz SUM sobre o join → ingrediente conta 2× no custo de TODAS as fichas até o dia seguinte; `receitas/composicao.ts:55-57` e `insumos/page.tsx:44-56` pegam linha de ordem indefinida (pode exibir o preço velho).
- **Fix:** desempate por `created_at`/`id` na view (`row_number`) ou UNIQUE `(insumo_id, vigente_desde)` com upsert.

### 1.2 Fuso UTC nos preços manuais alimenta o 1.1 e grava "vigente desde amanhã"
- `app/dashboard/insumos/actions.ts:90, 165, 206` usam `new Date().toISOString().split('T')[0]` (UTC). Depois das 21h BRT o preço entra com data de amanhã. O módulo de compras usa `hojeBR()` (`app/actions/compra.ts:124`) — as duas fontes divergem e geram empate de data no dia seguinte (→ 1.1).
- **Fix:** `hojeBR()` em todos os pontos.

### 1.3 Transferências: filtro default de data em UTC esconde lançamentos
- `transferencias/components/transferencia-table.tsx:98` e `transferencias/receber/components/transferencias-tab.tsx:51` — default `dataFiltro = todayISO()` (UTC) + `startsWith` sobre `created_at`. Após 21h a lista filtra pelo dia seguinte → "Nenhuma transferência encontrada". Pendente de ontem também não aparece em Recebimentos até clicar "Todos".
- **Fix:** default sem filtro (ou 7 dias) + comparação em fuso local.

### 1.4 Encomendas: teto de 1000 + ordenação ascendente = encomenda nova some
- `app/actions/encomenda.ts:183-190` — `listarEncomendas` sem `.range()`, ordena `data_entrega` asc. Passando de 1000 linhas acumuladas, o corte silencioso descarta as datas mais futuras — exatamente a encomenda recém-lançada. Mesmo padrão em orçamentos.
- **Fix:** `.range()` explícito + paginar/filtrar entregues antigas.

### 1.5 Painel/Preços/Simulador/Produtos: `getPainelFinanceiro` capado em 1000
- `app/actions/painel.ts:114-128` — só aplica `.range` se `pagination` vier. Chamadas sem: `precos/page.tsx:12`, `simulador/page.tsx:17`, `produtos/page.tsx`, e `getProdutosParaOrcamento` (`orcamento.ts:79`) que alimenta o picker de produtos de orçamento/encomenda. Acima de 1000 produtos: KPIs calculados sobre subconjunto truncado + produto novo fora do picker.
- **Fix:** iterar `.range()` até `count` ou agregar no banco.

### 1.6 Conferência de recebimento: entrada inválida vira "RECEBIDO" com qtd 0
- `transferencias/components/confirmacao-drawer.tsx:77-87,104-115` — `parseDecimalBR` retorna `NaN` (nunca null, `lib/format.ts:19-24`) → o `?? -1` nunca dispara; `NaN` passa pelos ifs e no finalizar vira `0`. Item gravado RECEBIDO com quantidade 0, sem motivo, sem divergência.
- **Fix:** `Number.isNaN` → bloquear finalização.

### 1.7 Atendimento: conversa longa esconde as mensagens NOVAS
- `app/actions/atendimento.ts:139-144` — `getConversa` ordena asc + `limit(200)` = as 200 mais **antigas**. Cliente frequente passa de 200 → a mensagem que ele acabou de mandar nunca aparece no painel. (`memoria.ts:150-160` já faz certo: desc + reverte.)

### 1.8 Atendimento: anti-duplicata de 15 min descarta pedido real em silêncio
- `lib/atendimento/memoria.ts:209-221` — mesmo `produto` na mesma conversa em 15 min → retorna `null`; o robô CONFIRMA ao cliente, mas o webhook (`webhook/route.ts:216-226`) não cria aviso nem pedido. Cliente espera 2 bolos, painel tem 1.
- **Fix:** comparar item completo (qtd) ou marcar "possível duplicata" no painel.

### 1.9 Atendimento: trocar de loja não recarrega as telas
- `atendimento-view.tsx:36` (`useState(conversasIniciais)` nunca ressincroniza; até 30s defasado), `relatorio-view.tsx:42` (**nunca** recarrega ao trocar loja), `pedidos-view.tsx:81` (só no poll). "Lancei na Morada e não apareceu" — apareceu, a tela era do Centro.
- **Fix:** `key={unidadeId}` no componente ou refetch em `useUnidade()`.

### 1.10 Relatório de atendimento subconta: `.limit(20000)` não passa do teto do PostgREST
- `app/actions/atendimento.ts:551-557` — max-rows corta em 1000; funil e mediana do mês saem errados em mês movimentado, fim do mês some.

### 1.11 Orçamento aceita item de catálogo a R$ 0,00 sem aviso
- `orcamentos/novo/orcamento-builder.tsx:78,188-192` + `app/actions/orcamento.ts:67` — produto sem preço definido entra a R$ 0, validação aceita (`< 0` é erro, `0` passa), orçamento sai impresso com total menor.

---

## 2. P2 — falha silenciosa e dado inconsistente

### 2.1 Família "resultado da action descartado" (padrão B) — clicou e nada aconteceu / "excluí e voltou"
| Onde | O quê |
|---|---|
| `encomendas/[id]/encomenda-view.tsx:65-75` · `orcamentos/[id]/orcamento-view.tsx:21-32` | mudar status/excluir ignoram `{error}`; excluir navega pra lista mesmo com delete falho |
| `caderno/.../caderno-receita-view.tsx:61-67` · `receitas/components/ficha-view.tsx:112-117` | remover ingrediente ignora erro — item "excluído" reaparece |
| `painel/components/painel-despesas.tsx:113-118` | delete de despesa some da tela mesmo recusado; volta no reload |
| `transferencias/components/transferencia-table.tsx:105-111` · `transferencias-tab.tsx:57-65` | excluir/confirmar transferência falham mudos |
| `atendimento-view.tsx:306` · `pedidos-view.tsx:89-92` | "Confirmada" ignora erro |
| `app/actions/atendimento.ts:228-234` | falha ao pausar robô → cliente recebe resposta da atendente E do robô |
| `app/actions/atendimento.ts:762-772` | `virarPedido`: anotação pode ficar `virou_pedido` sem `encomenda_id` (linha morta na UI) |
| `app/actions/orcamento.ts:276-281` | aviso "já virou encomenda" some se a query falhar → produção duplicada |
| Páginas server sem checar `error` | `insumos/page.tsx:14-15` · `precificar/page.tsx:13-14` · `transferencias/page.tsx:28-40` · `receitas/page.tsx:15-17` · `receitas/composicao.ts:26-53` · `atendimento.ts:133-150` — falha transitória renderiza "não há dados" |

**Fix estrutural:** helper único (`exigir(res)` / toast padrão) e varrer todos os call sites — é 1 padrão, não 15 bugs.

### 2.2 Criações não transacionais (padrão E)
- `app/actions/encomenda.ts:134-160` · `app/actions/orcamento.ts:122-142` · `app/actions/transferencia.ts:98-103` — cabeçalho salvo, itens falham → registro órfão com total e comanda vazia + duplicata no re-clique. A **edição** já usa RPC transacional (`20260802020000`); aplicar o mesmo no create.

### 2.3 Fluxo insumo→receita (complementos ao §1)
- **Dropdown da ficha mistura as duas lojas:** `receitas/actions.ts:492-501,505-515` sem filtro de `unidade_id` (RLS é por empresa) — escolher a "Farinha" da outra loja faz o preço atualizado "não refletir". Modal não mostra a loja.
- **Teto 1000 nos `.in()` sobre `vw_insumo_custo_atual`:** `insumos/page.tsx:23` · `precificar/page.tsx:18-19` (insumo COM preço aparece como "sem preço" → convida a reprecificar → alimenta o 1.1) · `resumo/page.tsx:94,103` · `compra.ts:94-98`.
- **`produtos/page.tsx:21-25`:** `.range(0,4999)` seguido de `.limit(500)` — o limit sobrescreve; >500 fichas, ficha nova não aparece pra vincular.
- **Revalidação estreita + back cache:** mutações de preço só revalidam `/dashboard/insumos` (`insumos/actions.ts:95,129,170,230`); `revalidarReceita` (`receitas/actions.ts:603-607`) não inclui a lista `/dashboard/receitas`. Com `router.back()` (feature f2edc6a) o payload RSC do cache mostra custo velho. Confirmado na doc do Next: staleTime 0 **não** afeta back/forward.
- **"Último preço" ambíguo:** `insumos/page.tsx:24-28,44-56` + `insumos/actions.ts:236-244` sem desempate por `created_at` (mesmo empate do 1.1).
- **Trocar `unidade_uso` de insumo com preços/fichas:** `insumos/actions.ts:101-131` — g→un/kg distorce custo ~1000× sem aviso. Bloquear ou confirmar.

### 2.4 Atendimento/UX
- `virar-pedido-modal.tsx:16-17` — data default UTC (delivery à noite ganha amanhã); `:40` — clique no backdrop descarta o digitado; `:32` — parsing fora do padrão (`Number(replace)` em vez de `parseDecimalBR`).
- `pedidos-view.tsx:43,81-87` — filtro "hoje" congela na virada da meia-noite → **auto-print da térmica para** de imprimir pedidos da madrugada.
- Sessão expirada = tela congelada sem aviso nos polls (`atendimento-view.tsx:50` · `sidebar.tsx:92-113`) — modo quiosque da impressora fica mudo.
- `lib/atendimento/canal.ts:88-89` — canal inativo cai no fallback do número de TESTE (`PHONE_NUMBER_ID`) sem aviso.
- `atendimento.ts:88-104` — preview da lista: 400 msgs globais p/ 50 conversas; uma conversa longa apaga o preview das outras.
- Corrida ao abrir conversas / poll grava conversa errada — `atendimento-view.tsx:54-71` (descartar resposta obsoleta por id).
- `permissions-context.tsx:73` + `proxy.ts:94` — fail-open: mapa vazio (inclusive por erro de fetch) libera todos os menus.
- `unidade-context.tsx:33-34` + `unidade.ts:59-66` — primeira sessão sem cookie: nenhuma aba marcada, dados da loja 1 ("parece todas as lojas").
- Encomenda cancelada inacessível — `encomendas-list.tsx:20-26,37` (não há aba Cancelada).
- Itens de comanda sem `ORDER BY` — `encomenda.ts:205` · `orcamento.ts:225` (ordem muda entre impressões).
- N+1 no `hasCycle` — `receitas/actions.ts:251-276,358-367` (lote de 10 itens = dezenas de round-trips, convida duplo clique).

### 2.5 Segurança (nada explorável por anônimo; tudo exige conta da empresa)
- `app/actions/unidade.ts:131-325` — `copiarEntreUnidades` sem `temAcesso` por tela: usuário só-leitura grava em massa na loja destino.
- **`temAcesso` sem `unidadeId` no atendimento** — `atendimento.ts:65,130,182,201,259,314,347,457,530,590,625,672,694` + `producao.ts:34`, `encomenda.ts:181,211`, `config.ts:44`: usuário multi-vínculo lê/mexe em conversas da loja onde não tem a tela.
- `app/api/atendimento/comandas/route.ts:16-26,68-73` — PII (nome/endereço/telefone) com token estático em **query string**, comparação não constant-time, `unidade` opcional; `:86` `marcados` mente. (Já era o P2-19 da v3 — segue aberto.)
- `20260620000008:421-439` — `fn_get_user_unidade(p_user_id)` SECURITY DEFINER com GRANT a authenticated e parâmetro livre (enumeração). Trocar para `auth.uid()` interno.
- `empresa.ts:156-201` — meta de faturamento sem RBAC de tela (P2-20 da v3, aberto). `config.ts:37-60` — `chave` livre, whitelist. `permissoes.ts:333` — senha mínima 6.

---

## 3. P3 (registrados, não urgentes)

Painel: donut mistura bases e trunca margem negativa (`painel-graficos.tsx:59-63`) · ponto de equilíbrio usa média simples, existe a ponderada (`painel-client.tsx:53-59`, `painel-equilibrio.tsx:50`) · faixas de custo sobre valor por grama (`painel-kpis.tsx:17-21`, `painel-tabela.tsx:283-287`) · `unidade-filter.tsx` morto · despesa criada com `empresa_id:''` (`painel-despesas.tsx:39-46`).
Insumos/preços: `addPrecosLote` "N ignorado(s)" sem dizer quais + risco `25,000`→25 (`insumos/actions.ts:210-231`) · preço por margem salvo sem `round2` (`precos-sem-preco-list.tsx:28`, `definir-preco-modal.tsx:49,59`).
Fichas: filtros em sessionStorage escondem ficha nova (`receita-list.tsx:22-52`) · cache de opções do inline-edit nunca invalida (`ficha-view.tsx:84-93`) · cookie de loja cru vs validado (`unidade.ts:59-67` vs `escopo.ts:32-55`) · metadados sem filtro de unidade (`receitas/page.tsx:17`).
Atendimento: catálogo do robô capado em 1000 (`catalogo.ts:64-77`) · "últimos pedidos" da ficha do cliente quase sempre vazio (`cliente.ts:110-126`) · assimetria `vende_delivery` null-vende × `vende_encomenda` null-não-vende (`disponibilidade.ts:27`) · erros engolidos em `canais-view.tsx:69`, `copiar-unidade-modal.tsx:44-51`, `atendimento.ts:592-605,635-641` · toggle otimista sem serialização (`produto-detalhe-drawer.tsx:71-81`).
Outros: AUSENTE sem motivo obrigatório (`confirmacao-drawer.tsx:93-101`) · validade "0" vira 7 (`orcamento-builder.tsx:126`) · `hojeISO()` local divergente (`encomenda-builder.tsx:55-58`) · "PENDENTE" por substring · tokens de cor red/emerald fora do padrão · `loading.tsx` faltando em 4 rotas · sequence de numeração global sem UNIQUE · índices de FK: `encomenda_item.produto_id`, `orcamento_item.produto_id`, `atendimento_encomenda.encomenda_id`.

---

## 4. Verificação das auditorias v1–v3 (o que o papel dizia × o código de hoje)

**CORRIGIDO E PROVADO:** 7 dos 8 P1 da v3 (RPC recebimento com `auth.uid()` · self-insert `usuario_unidade` dropado · `fn_listar_usuarios` dropada · views com `security_invoker` · `savePermissionsAction` · edição transacional · os 4 furos do webhook) + 16 dos 20 P2 + parser decimal P0 com 137 testes.

**AINDA ABERTO:** P1-8 **migrations não recriam o banco** (baseline de 3 linhas, `views_custo.sql` inválida na cadeia, 5 drifts já documentados em `docs/baseline-migrations.md`) — maior risco estrutural · P2-18 catálogo de preços na Nova Encomenda sem gate "pode ver valores" · P2-19 token das comandas · P2-20 meta sem RBAC · conversão de unidades divergentes (desde a v1) · **regressão nova de lint: 5 erros** (`insumo-modal.tsx:141`, `inline-edit.tsx:29`, `receita-list.tsx:34-36` — veio do f2edc6a, `receitas/[id]/page.tsx:3`).

**NÃO VERIFICADO (exige dashboard do Supabase):**
1. Policies/views reais vs migrations (`pg_policies`, `reloptions` das `vw_%`) — drift já pegou 5×
2. Permissões `*` remanescentes do seeder de `20260619010000:39-43`
3. Backup/PITR ativo no plano (única rede de segurança enquanto P1-8 aberto)
4. `META_APP_SECRET` e `IMPRESSAO_TOKEN` na Vercel (fail-closed: se faltar, robô rejeita tudo em silêncio)
5. Drift `ativa`×`ativo` / `unidade_medida`×`unidade_uso`

---

## 5. Plano de correção sugerido (ordem)

1. **Lote A — o custo mente (1.1 + 1.2 + desempates):** view com row_number/UNIQUE + `hojeBR()` nos 3 pontos. Pequeno, cirúrgico, mata o pior bug financeiro.
2. **Lote B — "lancei e não apareceu":** filtros UTC das transferências (1.3) · `listarEncomendas` (1.4) · `getPainelFinanceiro` (1.5) · `getConversa` (1.7) · troca de loja no atendimento (1.9).
3. **Lote C — falhas silenciosas:** helper de erro único + varrer §2.1; NaN do drawer (1.6); anti-duplicata (1.8); creates transacionais (§2.2).
4. **Lote D — segurança:** `unidadeId` no atendimento + `copiarEntreUnidades` + rota de comandas + `fn_get_user_unidade`.
5. **Lote E — os 5 do dashboard do Supabase** (checklist §4, 15 min no painel) + regressão de lint.

Cada lote cabe numa sessão com teste; nada aqui exige mexer no banco em produção exceto o Lote A (1 migration de view) e o D (1 migration de function).
