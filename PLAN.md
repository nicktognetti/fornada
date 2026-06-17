# Fornada — Custos & Preços · Padaria Flor do Trigo — PLAN

> Sistema de ficha técnica, custo e precificação para a **Padaria Flor do Trigo** (Unidades Centro e Morada do Sol).
> Calcula o custo de produtos **produzidos** (receita item a item, com sub-receitas) e **revendidos** (comprados prontos), aplica markup por linha e mostra preço sugerido, margem, ponto de equilíbrio e curva ABC.
>
> Marca exibida no app: **Flor do Trigo**. Nome do sistema/produto: **Fornada**. Responsável: **Nicholas Tognetti**.

**Última atualização:** 17/06/2026

---

## Stack

| Camada | Tecnologia | Observação |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Server Components + Server Actions |
| UI | Tailwind CSS + shadcn/ui | identidade oficial Flor (Marron Croissant / Azul Madrugada / Creme / Demerara) |
| Validação | Zod + (React Hook Form) | |
| Banco / Auth | Supabase (Postgres, RLS, Auth) — sa-east-1 | **custo calculado no banco** (função recursiva + views) |
| Gráficos | Recharts | histórico de preço, painel, ABC |
| IA | Anthropic API (Claude) | curadoria de insumos, OCR de nota, consulta em linguagem natural |
| Deploy | Vercel + Supabase | |

**Auth enxuto:** 2 usuários (Natali + você). Modelo nasce multi-empresa por baixo (RLS por empresa) para reúso como produto.

---

## Reality check

- **Identidade visual oficial recebida e aplicada** (manual da Natali): Marron Croissant `#ac6137`, Azul Madrugada `#16161d`, Creme `#ede9e1`, Demerara `#9f9383`; fontes Mont/Mewatonia/Emmascript (protótipo via Outfit/Playfair/Sacramento; no Next.js instalar as pagas). Aplicado no `flor_do_trigo_app_v6.html` e no app real.
- A **migration de produção** (`supabase_migration_v2.sql`) está validada em Postgres real: conversão de unidade, custo de embalagem, preço/volume por unidade, ponto de equilíbrio ponderado e RLS multi-empresa.
- A **carga real** depende da Natali devolver a `Curadoria_Insumos_Flor.xlsx` preenchida (71 insumos suspeitos).
- Metodologia confere na vírgula: desp. fixa 26,00%; markup Prata 1,8216; PE ponderado ~R$61.007.
- **Build real em andamento** (Claude Code, projeto `fornada`, Supabase `lwwukouqakyaainnoqdh`, empresa "Padaria Flor do Trigo" com unidades Morada do Sol + Centro já cadastradas): **Etapa 1 — Auth ✅**, **Etapa 2 — Layout + identidade ✅**, **Etapa 3 — CRUD Insumos ✅**, **Polimento visual/design system ✅**. **Etapa 4 — Fichas/Receitas (CRUD completo): implementada, EM VALIDAÇÃO** (4 cenários de teste a rodar antes do commit). **Dados reais: 1.164 insumos ✅ + 2.182 receitas ✅** importados e validados (zero órfãos, recursão testada). Pendente: 71 insumos suspeitos (Natali, ~11h) + 1.782 itens "(pendente de definição)" pra corrigir na tela. **Último commit válido: `eb8a74f`** (uma tentativa de Etapa 4 fora do fluxo combinado foi revertida sem perdas).

**Prática de trabalho que está funcionando (manter):** para cada etapa, dar um prompt único e detalhado pro Claude Code → testar → validar com prints → atualizar este PLAN.md → comitar. Evitar prompts/ferramentas externas ao fluxo (geram arquivos especulativos com nomes chutados). Nunca colar chave `service_role` ou senha de banco no chat. **O PLAN.md que vale é o gerado no chat e salvo manualmente na raiz da pasta `fornada` — não deixar o Claude Code criar um PLAN.md do zero (ele chuta o estado do projeto).**

---

## Legenda
`[x]` feito · `[~]` em andamento · `[ ]` pendente · `[!]` bloqueado (depende de terceiro)

## Milestones

| # | Milestone | Status | Entregável |
|---|---|---|---|
| M0 | Diagnóstico das 5 planilhas | [x] | censo de dados + decisão de arquitetura |
| M1 | Modelo de dados / arquitetura | [x] | `Arquitetura_…md` |
| M2 | Schema — custo recursivo | [x] | em `supabase_migration_v2.sql` (validado em PG) |
| M3 | Curadoria assistida por IA | [~] | `Curadoria_Insumos_Flor.xlsx` gerada; aguarda Natali preencher |
| M4 | Markup, precificação, indicadores | [x] | em `supabase_migration_v2.sql` (validado em PG) |
| M5 | Importador de seed | [x] | `importar_seed.py` + `seed_insumos.sql` |
| M6 | Protótipo UI — fichas/insumos/custo ao vivo | [x] | protótipo (v6) |
| M7 | Protótipo UI — preços/painel | [x] | protótipo (v6) |
| M8 | Carga de dados reais | [~] | **1.164 insumos ✅** + **2.182 receitas reais importadas** (`importar_receitas_reais.sql`) — 7.774 itens ligados a insumo, 302 a sub-receita, 160 de embalagem excluídos (vão para `custo_embalagem` do produto depois). **1.782 itens (massa/recheio/base/calda — nomes genéricos sem solução automática) entram como insumo placeholder "(pendente de definição)", custo zero, visíveis na tela para correção manual com contexto da receita.** Validado em Postgres real: zero itens órfãos, motor recursivo testado com sub-receita real. Pendente: 71 insumos suspeitos com a Natali (~11h) |
| M9 | Produtos revendidos (compra/revenda) | [x] | protótipo v6 + schema v2 |
| M10 | Setup no Supabase + scaffold Next.js | [~] | Supabase migrado; Next.js scaffoldado e rodando; **Etapa 1 (Auth) ✅** + **Etapa 2 (Layout+identidade) ✅** + **Etapa 3 (CRUD Insumos c/ conversão de unidade) ✅** + **Polimento visual / design system ✅** (hierarquia tipográfica, cards com elevação, cor de acento, componentes reutilizáveis `PageTitle`/`SectionLabel`/`card-surface`/`btn-primary`) + **Etapa 4 (Fichas/Receitas, CRUD completo) — IMPLEMENTADA, EM VALIDAÇÃO** (custo via `vw_custo_receita.custo_total` no banco; itens "(pendente de definição)" destacados em âmbar no topo; editar item via modal; criar receita com toggle insumo/sub-receita; exclusão bloqueada quando a receita é usada como sub-receita de outra; prevenção de referência circular; vírgula decimal pt-BR). **Aguarda rodar os 4 cenários de teste antes do commit.** Pendência menor: destacar mais o "Fornada" na sidebar (ficou pequeno comparado ao login) |
| M11 | Catálogo/cardápio, modo cozinha, etiquetas | [x] | protótipo v6 (ficha/etiqueta/cardápio impressos) |
| M12 | Identidade visual oficial | [x] | paleta + tipografia oficiais no protótipo v6 + app (fontes pagas a instalar no Next.js) |
| M13 | Histórico de preço de insumo + curva ABC | [x] | protótipo v6 |
| M14 | Simulador "e se" + cálculo reverso | [x] | protótipo v6 |
| M15 | IA: OCR de nota fiscal + consulta em linguagem natural | [ ] | atualizar custo via nota; perguntas da Natali |
| M16 | Preço separado por unidade (Centro × Morada) | [x] | protótipo v6 + schema v2 (`produto_preco`) |
| M17 | Transferência Morada → Centro | [ ] | registro de transferência |
| M18 | Multi-usuário leve (perfis) | [ ] | Natali + equipe consultando |

---

## Etapa 4 — Fichas/Receitas (CRUD completo) — cenários de validação

Rodar os 4 antes de comitar:

1. **Sub-receita / custo recursivo** — abrir uma receita que usa sub-receita e conferir se `vw_custo_receita.custo_total` bate.
2. **Editar pendente** — editar um item "(pendente de definição)", trocar pelo insumo certo, ver o custo subir.
3. **Criar do zero** — nova receita com 1 insumo direto + 1 sub-receita.
4. **Exclusão bloqueada** — tentar excluir uma receita que é sub-receita de outra (deve bloquear com aviso) + tentar criar referência circular (deve dar "Referência circular detectada").

Quando os 4 baterem → virar Etapa 4 para ✅ e comitar.

---

## Deliverables (arquivos atuais)

| Arquivo | O que é |
|---|---|
| `supabase_migration_v2.sql` | **Migration de produção** — rodar no Supabase (custo, markup, preço/unidade, PE ponderado, RLS) |
| `SETUP_Supabase_NextJS.md` | Guia de setup + prompt pro Claude Code |
| `flor_do_trigo_app_v6.html` | Protótipo de telas com identidade oficial — referência de UX/visual |
| `Arquitetura_Sistema_Padaria_Flor_do_Trigo.md` | Arquitetura e modelo de dados |
| `Curadoria_Insumos_Flor.xlsx` | Planilha de curadoria de insumos (com a Natali) |
| `importar_seed.py` / `seed_insumos.sql` | Importador e seed antigos (substituídos pelo fluxo abaixo) |
| `importar_insumos_reais.sql` | **Rodado ✅** — importa os 1.164 insumos reais (peso+unidade, conversão aplicada) |
| `importar_receitas_reais.sql` | **Rodado ✅** — importa as 2.182 receitas reais |
| `Revisao_71_Insumos_Suspeitos.xlsx` | **Com a Natali** — 71 casos de preço disperso/nome genérico pra ela esclarecer |
| `extracao_bruta_receitas.json` | Extração crua das 48 abas de receitas (2.182 blocos) |
| `PLAN.md` | Este documento — fonte de verdade, salvo na raiz da pasta `fornada` |

---

## Importação de dados reais — metodologia (M8)

A planilha `Planilha__Calculo_de_Preço.xlsx` da Natali (48 abas, ~2.182 blocos de receita) foi extraída e processada automaticamente:

1. **Extração:** cada bloco de receita (nome + tabela de itens + total) foi lido independente do rótulo de unidade do cabeçalho — descoberta importante: a planilha usa sempre quantidade em **fração de kg** e custo em **R$/kg**, mesmo quando o cabeçalho do bloco diz "(Gr)". Validado batendo `qtd × custo = valor_total` em 100% dos blocos testados.
2. **Deduplicação:** 1.283 nomes de insumo únicos identificados (normalizados sem acento/caixa).
3. **Detecção de inconsistência:** comparação de cluster de preços por insumo (não min/max bruto, que gera falsos positivos com variação normal de mercado) separou 1.212 "coerentes" (variação normal — preço ao longo do tempo, fica registrado como histórico em `insumo_preco`) de **71 "suspeitos"** reais (nome genérico usado pra produtos diferentes, ou preço disperso sem explicação aparente).
4. **Detecção de unidade de uso:** insumos com quantidades majoritariamente inteiras (1, 2, 3...) foram reclassificados como `unidade_uso = 'un'` em vez de peso — capturou casos como "ovo" (vendido por unidade, não por kg).
5. **Filtro de não-insumos:** ~48 itens identificados como sub-receita ou embalagem disfarçados de insumo (ex: "rec brownie", "embalagem P-32") foram excluídos da carga de insumos — entram depois como sub-receita real ou `custo_embalagem` do produto.
6. **Resultado:** 1.164 insumos importados (954 por peso + 210 por unidade) com categoria inferida por palavras-chave. 71 casos ficaram pendentes de validação humana (planilha de revisão enviada à Natali).

### Importação das receitas (continuação)

Os 2.182 blocos de receita foram importados com `importar_receitas_reais.sql`, classificando cada um dos 10.018 itens em 4 categorias:
- **7.774 → insumo direto** (nome bate com um dos 1.164 insumos importados).
- **302 → sub-receita** (o item referencia outro bloco de receita pelo nome — ex: "Massa Brigadeiro" usada dentro de "Cento de Brigadeiro"). IDs pré-calculados em Python (não por `SELECT` textual no SQL) para eliminar perda silenciosa por divergência de grafia.
- **160 → embalagem** (sache, caixa, fita, cestinha, moeda, guardanapo) — excluídos da receita; tratados como `custo_embalagem` do produto na próxima fase.
- **1.782 → pendente de definição** (nomes genéricos como "massa", "recheio", "base", "calda", "tortinhas" — usados em centenas de receitas com significados *diferentes* a cada vez, sem solução automática confiável). Esses itens recebem um insumo placeholder `(pendente de definição)` com custo zero, criado automaticamente na importação — a receita existe e calcula, mas com custo visivelmente baixo até alguém (Natali, com o contexto da receita na tela) substituir pelo insumo ou sub-receita certos.

Validação: zero itens órfãos (toda referência aponta para algo existente), motor de cálculo recursivo testado com sucesso contra uma receita real que usa sub-receita.

## Audit — melhorias incorporadas (na migration v2)

- **Conversão de unidade** (compra em kg/fardo/caixa → uso em g/ml/un), derivando o custo automaticamente.
- **Custo de embalagem** por produto entrando no preço.
- **Preço e volume de venda por unidade** (Morada × Centro) em `produto_preco`.
- **Ponto de equilíbrio ponderado** pelo volume real de vendas.
- **RLS multi-empresa de verdade** (`usuario_empresa` + isolamento por empresa).
- Pendências de front (vírgula decimal, busca sem acento, alvos de toque, export/import) viraram requisitos no prompt do scaffold.

## Riscos & mitigação

1. **Casamento insumo ↔ nome (curadoria)** — grafias livres e sub-receitas misturadas. Mitigação: planilha de curadoria + sugestão por IA + memória do vínculo.
2. **Conversão de unidade** — receita em g/ml/un vs compra em kg/cx/fardo. Mitigação: `unidade_uso` + `insumo_preco` (resolvido na v2).
3. **Produzir vs revender** — modelos de custo diferentes. Mitigação: revenda como entidade própria (M9).
4. **Custo "landed" (futuro)** — frete/desconto/impostos da nota. Mitigação: rateio quando entrar o módulo de nota (M15).
5. **LGPD / dados fiscais** — CNPJ em notas. Storage privado + RLS quando entrar o módulo de nota.

---

## Antes de ir para produção

- [ ] Conferir custo calculado vs planilha antiga (validação cruzada por produto)
- [ ] Confirmar regime tributário e % reais de imposto/cartão na config
- [ ] Revisar políticas RLS com usuário logado real (nenhuma tabela aberta)
- [ ] Backup/export dos dados (insumos + receitas)
- [ ] Treino rápido com a Natali (curar → conferir preço → ler o painel)

---

## Decisões registradas

- Produção só na **Morada do Sol**; **Centro** mais PDV. Preços **separados por unidade**.
- Vendas majoritariamente no **cartão** (% exato a confirmar).
- Atender **produzidos** (receita item a item) **e revendidos** (compra/revenda).
- Stack Next.js + Supabase. Cálculo de custo no banco (recursivo + views).
- Foco do projeto: **custo e precificação** (este PLAN). Estoque/produção fora de escopo por ora.

## Preciso de você

1. **Rodar os 4 cenários de validação da Etapa 4** → virar pra ✅ e comitar.
2. **Curadoria preenchida** pela Natali → destrava M8.
3. **% de cartão e impostos** reais.
4. **Fontes oficiais** (Mont/Mewatonia/Emmascript) pra instalar no Next.js.
