# Auditoria Técnica + Produto/UX — Fornada (Flor do Trigo)

> Passada **somente leitura**. Nenhum código de aplicação foi alterado.
> Data: 18/06/2026 · Branch: `master` · Build: ✅ passa · `tsc --noEmit`: ✅ 0 erros · `eslint`: ❌ 17 erros
> Todas as conclusões abaixo citam `arquivo:linha` como evidência.

---

## 1. Visão geral do projeto

ERP enxuto de custo/preço para a padaria Flor do Trigo (unidades **Centro** e **Morada do Sol**), em Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind v4 + Supabase.

**Arquitetura real (verificada):**
- Tudo roda sob `proxy.ts` (middleware de auth — redireciona não-logados para `/login`).
- `app/dashboard/layout.tsx` → `DashboardShell` → `Sidebar` + `<main>`.
- Núcleo de custo: **Insumos** → **Fichas** (receitas/sub-receitas) → **Preços** → **Resumo**. A matemática de custo vive em **views SQL** (`vw_custo_receita`, `vw_insumo_custo_atual`), consumidas pelas páginas.
- Operação: **Transferências** entre unidades (schema `fornada`, módulo bem modelado no banco) + **Receber**.
- Gestão: **Painel**, **Simulador**, **Configurações** — atualmente **placeholders**.

**Estado de maturidade:** 6 das 9 telas do menu estão funcionais; 3 (Painel, Simulador, Configurações) são telas “em breve”/sem persistência. O sistema **compila e roda**, mas tem (a) um **risco real de corrupção de valores monetários** no parsing decimal, (b) uma **cisão visual** entre o núcleo (claro) e o módulo de Transferências (escuro), e (c) **schema de banco em grande parte não versionado**.

> ⚠️ **O `PLAN.md` está desatualizado e enganoso.** Ele descreve um “dark theme unificado” com accent `#f2994a` e fundo `#1a1a1a`. Esses valores **não existem em lugar nenhum do código** — `grep` por `#f2994a`/`#242424`/`#ffb380` só retorna o próprio `PLAN.md`. Tratei o **código como a verdade**, conforme instruído.

---

## 2. O que já está bom

| # | Ponto forte | Evidência |
|---|---|---|
| ✅ | **Migration de Transferências exemplar**: constraints de negócio (`ck_*`), FKs, índices compostos, views e comentários | `supabase/migrations/20260618_transferencia_unidades.sql` (inteiro) |
| ✅ | **RLS habilitado** nas tabelas de transferência, com isolamento por `empresa_id` via `usuario_empresa` | `...transferencia_unidades.sql:379-483` |
| ✅ | **Segurança de chaves OK**: só a `anon key` (`NEXT_PUBLIC_*`) é usada no client; `service_role` aparece **apenas** como condição de policy SQL; `.env.local` **não** está versionado (`.gitignore` cobre `.env*`) | `lib/supabase/client.ts:5-6`, `.gitignore:34`, `usuario_unidade.sql:26` |
| ✅ | **Detecção de ciclo** em sub-receitas (BFS) antes de inserir/editar item — evita recursão infinita de custo | `app/dashboard/receitas/actions.ts:144-169` |
| ✅ | **Histórico de preço por INSERT** (nunca UPDATE) — preserva trilha de auditoria de custo | `app/dashboard/insumos/actions.ts:131-166` |
| ✅ | **Validação com Zod** nas server actions de insumo/receita | `insumos/actions.ts:19-33`, `receitas/actions.ts:25-36` |
| ✅ | **Estados de pending/loading** reais via `useActionState` e flags de loading nos botões | `insumo-modal.tsx:118-120`, `nova-transferencia-form.tsx:313-316` |
| ✅ | **Skeleton + empty states** no módulo de Transferências | `transferencias/loading.tsx`, `receber/page.tsx:64-69` |
| ✅ | **Cor semântica de prejuízo/margem** (emerald/red) em Preços e Resumo | `precos/page.tsx:90-93`, `dashboard/page.tsx:227-247` |
| ✅ | **Auto-rota inteligente**: origem da transferência é pré-preenchida com a unidade do usuário | `nova-transferencia-form.tsx:45-61`, `nova/page.tsx:29-45` |
| ✅ | **Responsivo**: tabela vira cards no mobile; alvos de toque `min-h-[44px]` | `ficha-view.tsx:159,219`, `nav-link.tsx:24` |
| ✅ | `tsc --noEmit` limpo (0 erros de tipo) e `npm run build` passa |

---

## 3. O que precisa melhorar

### 3.1 Parsing decimal corrompe valores (💰 dinheiro) — **P0**
`parseDecimalBR` remove **todos** os pontos antes de converter:
```ts
// lib/format.ts:2
return parseFloat(val.trim().replace(/\./g, '').replace(',', '.'))
```
- `"1.234,56"` → `1234.56` ✅ (caso pensado: ponto = milhar)
- **`"2.5"` → `25`** ❌ (usuário digitando “dois e meio” com ponto)
- **`"10.00"` → `1000`** ❌
- **`"0.50"` → `50`** ❌

Em um sistema de **custo**, isso grava silenciosamente um valor **10×–100× errado** sem nenhuma validação que pegue o erro (o Zod só checa `> 0`). Usado direto no salvamento de preço de insumo e quantidades de ficha: `insumos/actions.ts:90-91,157-159`, `receitas/actions.ts:65,214,260`. A pré-visualização (`PrecoPreview`, `insumo-modal.tsx:44-45`) usa a **mesma** função, então a tela mostra o valor já corrompido — o usuário “confirma” o erro.

### 3.2 Cisão visual: núcleo claro × Transferências escuro — **P1**
O shell é **escuro** (`bg-[#1a1a1d]`, `dashboard-shell.tsx:10,12`; sidebar `#1a1a1c`, `sidebar.tsx:33`), mas convivem **dois paradigmas de card** sobre ele:
- **Núcleo** (Resumo, Fichas, Insumos, Preços, Painel, Config): cards **claros** via `.card-surface` → `--t-card-bg: #ffffff` e paleta creme (`globals.css:56,159`).
- **Transferências + Login**: cards **escuros** hardcoded `#222226` / `#1e1e26` (`nova-transferencia-form.tsx:28`, `receber/page.tsx:65,78`, `[id]/page.tsx:155`, `login/page.tsx:36`).

Resultado: telas do mesmo app com aparência conflitante. O módulo de Transferências usa hex inline em ~35 ocorrências (`#d98d5f`/`#d68a57`) espalhadas por 12 arquivos, **inclusive** nav e dashboard — fora do sistema de tokens `--t-*`.

### 3.3 `UnidadeSelector` é um controle falso — **P1**
```tsx
// app/components/unidade-selector.tsx:5-8 — unidades hardcoded, useState local
type Unidade = 'morada-do-sol' | 'centro'
const [unidade, setUnidade] = useState<Unidade>('morada-do-sol')
```
Não lê dados, não filtra query, não persiste, não navega. Aparece só em **Insumos** (`insumos/page.tsx:61`), onde os insumos são **compartilhados por empresa** (a query nem tem coluna de unidade — `insumos/page.tsx:12`). Ou seja: sugere “dados por unidade” que **não existem**. Para uma usuária não-técnica, é um botão que mente.

### 3.4 Funcionalidades no menu, mas vazias — **P1**
- **Simulador**: “Em breve” (`simulador/page.tsx:16`).
- **Painel**: “Em configuração”, KPIs com `—` (`painel/page.tsx:16,27`).
- **Configurações**: edita só estado de sessão, **não salva no banco** — o próprio aviso admite (`config-panel.tsx:108-111`).

São 3 dos 9 itens do menu. Em um produto cobrado, itens que abrem em “em breve” passam impressão de inacabado.

### 3.5 Lint quebrado (17 erros) — **P2**
`npm run build` passa, mas `npm run lint` falha. Destaques:
- `react-hooks/purity`: **`Date.now()` chamado durante o render** em `ficha-view.tsx:31-33` (gera key instável de modal).
- 14× `@typescript-eslint/no-explicit-any` (dashboard, preços, receitas, transferências) — o código usa `any` para contornar a falta de tipos das views/joins do Supabase.
- O build só passa porque o `next build` não roda o ESLint nesta config (`next.config.ts` está vazio).

### 3.6 Schema central não versionado — **P1**
Só existem 2 migrations (`transferencia_unidades`, `usuario_unidade`). **Não há migration** para: `insumo`, `receita`, `receita_item`, `produto`, `produto_preco`, `insumo_preco`, `empresa`, `unidade`, `usuario_empresa`; nem para as views de custo `vw_custo_receita`/`vw_insumo_custo_atual`; nem para o RPC `fn_get_user_unidade` (chamado em `app/actions/transferencia.ts:109`, mas sem definição no repo). Não é possível **reproduzir o banco** a partir do repositório — risco grave para um projeto de portfólio e para recuperação de desastre.

---

## 4. O que ainda falta implementar

| Item | Situação | Evidência |
|---|---|---|
| **Simulador** (impacto de preço, ponto de equilíbrio) | Stub | `simulador/page.tsx` |
| **Painel Financeiro** (despesa fixa, faturamento, margem média, ponto de equilíbrio) | Stub | `painel/page.tsx` |
| **Persistência de Configurações** (tipos, unidades, categorias) | Só em memória | `config-panel.tsx:108` |
| **Ponto de equilíbrio ponderado** | Não existe no código | — (citado só como “planejado” em `simulador/page.tsx:27`) |
| **Fluxo Receber/NFe → casar item com insumo → atualizar custo** | **Não existe.** “Receber” trata só recebimento de **transferências internas**, não entrada de NFe de fornecedor | `transferencias/receber/page.tsx` |
| **Custo de embalagem** | Não há tratamento específico (embalagem é só uma “categoria” de insumo) | `config-panel.tsx:29` |
| **Validação de estoque** | Placeholder que retorna `true` | `...transferencia_unidades.sql:202-213` |
| **Migrations do schema central + views de custo** | Ausentes | (ver 3.6) |
| **Testes** | **Nenhum** arquivo de teste no repo; sem dependência de teste no `package.json` | `package.json:5-10` |

> Observação de produto: o item de menu **“Receber”** sugere “receber mercadoria/NFe do fornecedor” (que é o fluxo que alimenta custo). Na verdade é só conferência de transferência interna. Vale renomear ou esclarecer.

---

## 5. Problemas / riscos (com evidência e severidade)

| Sev | Problema | Evidência |
|-----|----------|-----------|
| **P0** | `parseDecimalBR` apaga pontos → `"2.5"`→`25`, `"10.00"`→`1000`; corrompe custo/quantidade **antes de salvar**, sem validação que detecte | `lib/format.ts:2`; uso em `insumos/actions.ts:90-91`, `receitas/actions.ts:65,214,260` |
| **P1** | Contraste do botão laranja de Transferências reprova WCAG AA: `#d98d5f` + texto branco = **~2,65:1** (mínimo AA = 4,5:1) | `nova-transferencia-form.tsx:18`, `transferencias/page.tsx:63`, `receber/page.tsx:99` |
| **P1** | Cisão visual claro × escuro entre núcleo e Transferências/Login | (ver 3.2) |
| **P1** | `UnidadeSelector` falso/decorativo sugerindo dados por unidade inexistentes | `unidade-selector.tsx`, `insumos/page.tsx:61` |
| **P1** | Schema central + views de custo + RPC `fn_get_user_unidade` sem migration | (ver 3.6) |
| **P2** | **Matemática de dinheiro não auditável**: custo/custo unitário ficam em views SQL fora do repo (`vw_custo_receita`, `vw_insumo_custo_atual`); **0 testes** | `receitas/[id]/page.tsx:19,47`, `package.json` |
| **P2** | **RLS isola por empresa, não por unidade.** Com 2 unidades na mesma empresa, qualquer operador lê/edita transferências e **confirma recebimento** de qualquer unidade; a própria migration delega o “filtro fino por unidade” à server action, mas **nenhuma action filtra** | `...transferencia_unidades.sql:373-377,386-394`; `confirmarRecebimentoAction` em `app/actions/transferencia.ts:123-175`; checagem só de “não ser o criador” em `[id]/page.tsx:107-110` |
| **P2** | **Sem conversão de unidade**: `custo_item = quantidade × custo_uso` e a margem assume `rendimento_unidade` == unidade de venda. Diverge silenciosamente se as unidades não baterem | `receitas/[id]/page.tsx:79`, `precos/page.tsx:63-64,76-77` |
| **P2** | `confirmarRecebimentoAction` faz **N updates em loop sem transação** → atualização parcial possível se um item falhar | `app/actions/transferencia.ts:140-151` |
| **P2** | Sem skeleton/error nas telas do núcleo (só Transferências tem `loading.tsx`); sem error boundaries | (ausência) |
| **P2** | Valores em R$ **sem `tabular-nums`** nas tabelas de Fichas/Insumos/Preços → dígitos desalinham nas colunas (`tabular-nums` aparece **1×**, no gráfico ABC) | `dashboard/page.tsx:268`; tabelas em `ficha-view.tsx:160-215`, `precos/page.tsx` |
| **P2** | Login: botão `#ac6137` + `text-creme` = **~3,85:1** (reprova AA p/ texto normal) | `login/page.tsx:85` |
| **P3** | `is_pendente` detectado por `nome.includes('pendente')` — frágil/quebra com renomeação | `dashboard/page.tsx:112`, `receitas/[id]/page.tsx:81` |
| **P3** | “Curva ABC” soma `quantidade × custo_uso` por **todas** as fichas sem ponderar por volume de produção/venda → é heurística de uso, não ABC real | `dashboard/page.tsx:106-119` |
| **P3** | **Código morto**: `navigation.tsx` e `header.tsx` não são importados por ninguém | `app/components/{navigation,header}.tsx` |
| **P3** | Detalhe de transferência usa fetch client-side + `window.location.reload()` após confirmar | `transferencias/[id]/page.tsx:82-86` |
| **P3** | Gradientes do ABC em hex hardcoded fora dos tokens | `dashboard/page.tsx:275-277` |
| **P3** | `PLAN.md` descreve um tema (`#1a1a1a`/`#f2994a`) que não existe no código | só aparece em `PLAN.md` |

---

## 6. Sugestões práticas de melhoria

**Núcleo de dinheiro (prioridade máxima):**
1. Reescrever `parseDecimalBR` para tratar vírgula como decimal e ponto como milhar **somente** quando inequívoco (ou padronizar: se há vírgula, ponto = milhar; se não há vírgula, ponto = decimal). Adicionar testes de unidade cobrindo `"2,5"`, `"2.5"`, `"1.234,56"`, `"1234.56"`, `"10.00"`, `"0,50"`, `""`, `"abc"`.
2. **Versionar as views de custo** (`vw_custo_receita`, `vw_insumo_custo_atual`) e os scripts das tabelas centrais como migrations. Sem isso, a lógica de margem não é auditável.
3. Introduzir **testes** (Vitest) para a camada de cálculo e para `parseDecimalBR`/`formatBRL`. Hoje são **zero**.

**Design system / UX:**
4. Decidir **uma** direção de tema (ver Ambiguidades) e migrar Transferências/Login para os tokens `--t-*`, eliminando os hex inline `#d98d5f`/`#222226`.
5. Trocar o laranja de baixo contraste por um token acessível (texto escuro sobre o accent, ou usar o marrom `#ac6137` que já passa AA a ~4,64:1 com texto branco).
6. Resolver o `UnidadeSelector`: ou ligá-lo a dados reais (filtro por unidade) ou removê-lo até existir o conceito.
7. Aplicar `tabular-nums` em todas as colunas de R$.
8. Esconder Painel/Simulador do menu até existirem, ou marcá-los claramente como “em desenvolvimento”.

**Arquitetura / segurança:**
9. Se insumos/preços forem mesmo por unidade (a confirmar), adicionar `unidade_id` e RLS por unidade; senão, remover o seletor de unidade. Hoje o isolamento é só por empresa.
10. Envolver `confirmarRecebimentoAction` em RPC transacional no Postgres (atomicidade da conferência).
11. Tipar os retornos do Supabase (gerar tipos via `supabase gen types`) para eliminar os `any` e o lint vermelho.

---

## 7. Prioridades de ação (P0 → P3)

| Prioridade | Ação | Arquivo-chave |
|---|---|---|
| **P0** | Corrigir `parseDecimalBR` (vírgula = decimal) + testes do parser | `lib/format.ts:2` |
| **P1** | **Unificar tema em ESCURO** (decisão do cliente): migrar o **núcleo** (cards `card-surface`/creme) para tokens escuros, usando Transferências como referência; promover os hex `#222226`/`#d98d5f` a tokens de design system | `globals.css:53-77`, `dashboard/page.tsx`, `ficha-view.tsx`, `precos/page.tsx`, `insumo-modal.tsx` |
| **P1** | Definir um **accent acessível sobre escuro** (o `#d98d5f` + branco reprova AA a ~2,65:1) — usar texto escuro sobre o accent ou um laranja mais saturado | `nova-transferencia-form.tsx:18` |
| **P1** | **Implementar dados por unidade** (decisão do cliente): `unidade_id` em insumo/preço + RLS por unidade + ligar `UnidadeSelector` a dados reais (hoje é decorativo) | `unidade-selector.tsx`, `insumos/page.tsx:61`, schema |
| **P1** | Versionar schema central, views de custo e `fn_get_user_unidade` como migrations | `supabase/migrations/` |
| **P2** | Versionar/testar a matemática de custo/margem (sem testes hoje) | views SQL + novo `*.test.ts` |
| **P2** | Definir isolamento por unidade (ou documentar que é por empresa) + revisar quem pode confirmar recebimento | RLS + `app/actions/transferencia.ts` |
| **P2** | Transação atômica na conferência de recebimento | `app/actions/transferencia.ts:140-175` |
| **P2** | `tabular-nums` nas tabelas de R$; skeleton/error nas telas do núcleo | `ficha-view.tsx`, `precos/page.tsx` |
| **P2** | Consertar lint (Date.now no render + `any`) | `ficha-view.tsx:31-33` + tipos Supabase |
| **P3** | Substituir detecção `includes('pendente')` por flag/relacionamento explícito | `dashboard/page.tsx:112` |
| **P3** | Remover código morto (`navigation.tsx`, `header.tsx`); agrupar navegação | `app/components/` |
| **P3** | Atualizar/aposentar `PLAN.md` (descreve tema inexistente) | `PLAN.md` |

---

## 8. Conclusão / diagnóstico geral

O Fornada tem **boa fundação de engenharia** onde foi cuidado: o módulo de Transferências (banco + UI) é maduro — constraints, views, índices, RLS, skeleton, auto-rota; e as server actions do núcleo usam Zod, histórico de preço por INSERT e detecção de ciclo. Segurança de chaves está correta. Compila e tipa limpo.

Os problemas **não são de “falta de código”, e sim de coerência e de confiança nos números**:

1. **Risco de dinheiro real (P0):** o parser decimal corrompe valores com ponto de forma silenciosa. Para um sistema cujo propósito é custo/preço, este é o achado mais grave e o primeiro a corrigir.
2. **Confiabilidade da matemática (P1/P2):** o cálculo de custo/margem mora em views SQL **fora do repositório** e **sem nenhum teste** — não dá para garantir nem reproduzir.
3. **Acabamento de produto (P1):** a cisão visual claro/escuro, o seletor de unidade falso e três telas “em breve” no menu derrubam a percepção de produto pronto — justamente o que importa para cliente pagante e para portfólio.

Ordem recomendada: **P0 (parser) → versionar+testar a matemática → unificar tema e contraste → resolver o seletor de unidade → preencher/ocultar as telas-stub.** Nenhuma dessas correções exige tocar na lógica de negócio do banco; são, em sua maioria, de saneamento e consistência.

---

## Ambiguidades — decisões do cliente (18/06/2026)

**Respondidas (orientam as correções):**
1. **Direção do tema → ESCURO.** O alvo é dark. Consequência: **inverte a recomendação 3.2** — quem está fora do padrão é o **núcleo claro** (cards `card-surface`=#fff + paleta creme), não as Transferências. Correção = migrar o núcleo para tokens escuros, usando o módulo de Transferências como referência visual. Atenção ao contraste: o accent escolhido precisa passar AA sobre fundo escuro (o `#d98d5f` atual reprova).
2. **Insumos/preços → POR UNIDADE.** Consequência: **muda schema** — adicionar `unidade_id` em `insumo`/`insumo_preco` (ou tabela de preço por unidade), RLS por unidade, e **ligar o `UnidadeSelector` a dados reais** (hoje é decorativo). Não é só remover o seletor: é implementá-lo de verdade. Trabalho de P1/P2 com migração de dados.
5. **Painel / Simulador / Configurações → MANTER no menu como “em breve”.** Não ocultar.

**Ainda em aberto (confirmar antes de implementar):**
3. **O “Resumo” deve respeitar a unidade selecionada?** Hoje agrega a empresa inteira — com dados por unidade, provavelmente deve filtrar.
4. **Quem pode confirmar recebimento?** Hoje: qualquer um da empresa que não seja o criador. Restringir à unidade de destino?
6. **Definição de margem:** manter sobre o preço de venda (atual) ou markup sobre custo?
7. **“Receber” = NFe de fornecedor** ou só conferência interna (atual)?

---

## Inventário de arquivos relevante (Passo 1)

---

---

# Auditoria Técnica — Sessão 2 (Pós multi-empresa + Painel Financeiro)

> Data: 20/06/2026 · Branch: `master` · Build: ✅ 17/17 rotas · Arquivos examinados: 37
> Escopo: módulo Produto, Painel Financeiro, multi-empresa (empresa_id + EmpresaSwitcher), gráficos clicáveis, meta de faturamento.

---

## 1. Resumo Executivo

O sistema foi evoluído em 4 sessões iterativas. O Painel Financeiro está funcionalmente rico — alertas priorizados, inline editing de preço, gráficos clicáveis com `ChartFilter`, precificadora e meta de faturamento. O build compila sem erros TypeScript.

Contudo, há **3 problemas críticos** e **10 altos** que comprometem funcionalidades centrais em produção multi-tenant. A arquitetura geral é sólida, mas a refatoração de single-tenant para multi-tenant foi feita de forma incremental e incompleta — camadas anteriores (migrations, actions) não foram revisadas.

**Score geral: 5.2 / 10**

| Severidade | Quantidade |
|---|---|
| 🔴 CRÍTICO | 3 |
| 🟠 ALTO | 10 |
| 🟡 MÉDIO | 9 |
| 🟢 BAIXO/Sugestão | 5 |
| **Total** | **27** |

**Veredicto de deploy:** BLOCK em produção multi-tenant. Funciona para single-tenant (Flor do Trigo isolada).

---

## 2. Pontos Positivos

- **`PainelClient` como orquestrador de estado** — centraliza `alertaFiltro` e `chartFilter`, evita prop drilling, mantém Server Components nas bordas
- **`ChartFilter` com union type discriminada** — design de tipo TypeScript maduro
- **Migrations idempotentes** — `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, blocos `DO $$` com verificações condicionais
- **Gráficos SVG sem dependências externas** — fiel à restrição de não adicionar npm deps
- **Empty states educativos** (`GraficoVazio`) — guia o usuário quando há < 3 produtos precificados
- **Cookie-based persistence** para `unidade_preferida` e `empresa_preferida` — robusto, persiste entre sessões
- **`PrecoCell` com UX clara** — placeholder `R$ 0,00` dashed + flash "✓ Salvo"
- **`SortHeader` reutilizável** com ícones de estado (ChevronsUpDown/ChevronUp/Down)
- **RLS em `produto`** — política `produto_empresa_rls` corretamente filtra por `empresa_id IN (SELECT empresa_id FROM usuario_empresa WHERE user_id = auth.uid())`

---

## 3. Problemas e Inconsistências

### 🔴 CRÍTICO 1 — `vw_produto_financeiro` sem RLS: vazamento multi-tenant

**`app/actions/painel.ts:68-76`**

A view não possui Row Level Security. Todo o isolamento multi-tenant depende do `.eq('empresa_id', empresaId)` no código TypeScript. Se qualquer chamada futura omitir esse filtro — por cópia descuidada, refactor, ou consulta via Supabase Studio — **todos os produtos de todas as empresas são retornados**.

**Correção:** Criar Security Definer Function que sempre aplica `WHERE empresa_id IN (SELECT empresa_id FROM usuario_empresa WHERE user_id = auth.uid())`, ou ativar `security_invoker = true` na view.

---

### 🔴 CRÍTICO 2 — Duas políticas RLS conflitantes em `produto`

**`20260621000000_produto_financeiro.sql`** e **`20260622000000_multi_empresa.sql`**

A migration de 21/06 cria `produto_empresa`. A migration de 22/06 cria `produto_empresa_rls`. Ambas estão ativas. No PostgreSQL, múltiplas políticas `FOR ALL` são combinadas com `OR` para SELECT e `AND` para UPDATE/INSERT/DELETE. Operações de escrita em `produto` podem falhar de forma inconsistente.

**Correção:**
```sql
-- Em nova migration de correção:
DROP POLICY IF EXISTS produto_empresa ON public.produto;
```

---

### 🔴 CRÍTICO 3 — `fn_set_atualizado_em()` assumida mas não garantida nas migrations

**`20260622000001_meta_faturamento.sql:24`**

O trigger de `meta_faturamento` chama `fn_set_atualizado_em()`. Nenhuma migration do conjunto define essa função com `CREATE OR REPLACE`. Em staging limpo ou banco novo, a migration aborta com "function does not exist".

**Correção:** Adicionar no início da migration:
```sql
CREATE OR REPLACE FUNCTION public.fn_set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END $$;
```

---

### 🟠 ALTO 1 — `savePrecoVenda` não verifica ownership de empresa

**`app/actions/painel.ts:138`**

A action busca `produto.unidade_id` por `produtoId` sem verificar se o produto pertence à empresa do usuário. Um usuário da Empresa A pode sobrescrever preços da Empresa B.

**Correção:**
```typescript
const empresaId = await getEmpresaId(supabase, user.id)
if (prod?.empresa_id !== empresaId) return { error: 'Acesso negado' }
```

---

### 🟠 ALTO 2 — `copiarEntreUnidades` usa `.single()` com usuário multi-empresa

**`app/actions/unidade.ts:89`**

`.single()` na query `usuario_empresa` retorna erro `PGRST116` se o usuário pertence a mais de uma empresa, bloqueando usuários legítimos.

---

### 🟠 ALTO 3 — Cópia de preços usa tabela `receita_preco` obsoleta

**`app/actions/unidade.ts:207-229`**

O fluxo "Copiar → Preços" copia de `receita_preco`. Após a migration de produto, os preços reais vivem em `produto_preco`. A feature parece funcionar mas copia dados do sistema antigo ou nada.

---

### 🟠 ALTO 4 — Bug visual: faixa negativa do histograma nunca aparece ativa

**`app/dashboard/painel/components/painel-graficos.tsx:78-79`**

`isFaixaAtiva` compara `chartFilter.min === min` onde `min` é `-Infinity`. Mas o `ChartFilter` é criado com `min: -999` (serialização de `-Infinity`). A comparação `-999 === -Infinity` é sempre `false`. O feedback visual da faixa selecionada está quebrado para margens negativas.

---

### 🟠 ALTO 5 — Mutação direta de prop em `PrecoCell`

**`app/dashboard/painel/components/painel-tabela.tsx:162-165`**

```typescript
// Antipadrão: mutação direta do objeto prop
f.preco_venda = val
f.margem_percentual = ((val - f.custo_total) / val) * 100
```

KPIs e gráficos não atualizam após salvar um preço porque o React não detecta a mutação.

---

### 🟠 ALTO 6 — NOT NULL silencioso na migration multi_empresa

**`20260622000000_multi_empresa.sql:48-59`**

`ALTER TABLE ... SET NOT NULL` só é executado se não existir linha com `empresa_id IS NULL`. Se o backfill falhou silenciosamente, a constraint nunca é aplicada — divergência silenciosa entre TypeScript (`empresa_id: string`) e banco (aceita NULL).

---

### 🟠 ALTO 7 — `getMetaFaturamento` sem filtro de empresa na query de preços

**`app/actions/empresa.ts:113-114`**

`produto_preco` é buscado sem filtro de `empresa_id` server-side. O filtro é aplicado em TypeScript depois — se o RLS falhar (ver CRÍTICO 2), retorna preços de todas as empresas.

---

### 🟠 ALTO 8 — `faturamentoAtual` semanticamente incorreto

**`app/actions/empresa.ts:112-125`**

`faturamentoAtual` = soma de `preco_praticado` de todos os produtos. Isso é o "valor do portfólio precificado", não faturamento. Para uma padaria com 1156 produtos a R$2 médios, dá R$2.312 — sem relação com vendas reais. O componente `PainelMeta` exibe isso como "R$ de faturamento do mês".

---

### 🟠 ALTO 9 — `LoteModal`: N chamadas sequenciais de `savePrecoVenda`

**`app/dashboard/painel/components/painel-tabela.tsx:59-67`**

Para 50 produtos: 50 chamadas × 2 queries = 100 round-trips. Pode levar 30+ segundos.

**Correção:** Criar `savePrecoVendaLote(items: {id: string, preco: number}[])` com upsert em batch.

---

### 🟠 ALTO 10 — Produtos sem `unidade_id` tornam `savePrecoVenda` impossível

**`app/actions/painel.ts:142`**

Se a migration `produto_financeiro` inseriu produtos a partir de receitas sem `unidade_id`, esses produtos recebem `{ error: 'Produto sem unidade definida' }` silenciosamente. O campo de preço aparece mas nunca salva.

---

### 🟡 MÉDIO 1 — Modo Consolidado quebrado silenciosamente

Quando `empresaAtual === null`, `getPainelFinanceiro()` retorna `{ error: 'Empresa não encontrada' }` e o painel exibe lista vazia sem nenhuma mensagem. O botão "Consolidado" parece funcionar mas não faz nada.

---

### 🟡 MÉDIO 2 — Fluxo "Fabricado" no modal exibe erro como comportamento normal

**`app/dashboard/produtos/components/novo-produto-modal.tsx:46`**

Mensagem de erro em vermelho após clicar "Criar Produto". A opção "Fabricado" deveria estar desabilitada com badge "Em breve".

---

### 🟡 MÉDIO 3-9 (sumarizados)

| # | Arquivo | Problema |
|---|---|---|
| M3 | `painel-tabela.tsx:162` | Sem `router.refresh()` após save em `PrecoCell` — KPIs ficam stale |
| M4 | `painel.ts:100-105` | Cast `as ProdutoFinanceiro` esconde campos fantasma (`receita_id`, `rendimento`) sem validação TypeScript |
| M5 | `empresa.ts:117` | Cast duplo `as unknown as PrecoRow[]` — incompatibilidade de tipo não resolvida |
| M6 | `permissions-context.tsx:91-93` | `canRead`/`canWrite` retornam `true` durante loading — botões de edição aparecem para quem não tem permissão |
| M7 | `dashboard/page.tsx:58-77` | 11 queries paralelas sem timeout/fallback parcial |
| M8 | `dashboard/layout.tsx:46-51` | 6 round-trips por page load (4 paralelas + 2 internas de `getEmpresaAtualId`) |
| M9 | `painel.ts:57-121` | `getPainelFinanceiro` sem paginação server-side — 1156+ produtos por request |

---

## 4. Lacunas e Riscos

| # | Lacuna | Risco |
|---|--------|-------|
| L1 | `vw_produto_financeiro` sem RLS | Vazamento multi-tenant se filtro de código for omitido |
| L2 | Modo Consolidado não implementado | Feature no EmpresaSwitcher que não funciona |
| L3 | `createProdutoFabricado` não existe | Criação de produto fabricado está inoperante |
| L4 | `receita_preco` e `produto_preco` coexistem ativos | Dois sistemas de preços; `copiarEntreUnidades` usa o errado |
| L5 | Sem testes automatizados | Regressões não detectadas entre sessões |
| L6 | `unidade_id` pode ser NULL em produtos importados | ~X% dos 1156 produtos impossíveis de precificar |
| L7 | `faturamentoAtual` com semântica errada | Decisões de negócio baseadas em dados incorretos |
| L8 | Sem `router.refresh()` após `PrecoCell.save()` | KPIs stale após edição inline |

---

## 5. Recomendações Priorizadas

### Imediato (antes de qualquer demo/produção multi-empresa)

1. **Proteger `vw_produto_financeiro`** com Security Definer Function
2. **Dropar política duplicada** `produto_empresa` numa nova migration
3. **Criar `fn_set_atualizado_em()`** idempotente no início das migrations que a usam
4. **Adicionar `empresa_id` check em `savePrecoVenda`** — 3 linhas
5. **Corrigir `copiarEntreUnidades`** para usar `.in()` e `produto_preco`

### Curto prazo

6. **Corrigir `isFaixaAtiva`** — usar `d.minVal` em vez de `d.min`
7. **Eliminar mutação de prop em `PrecoCell`** + adicionar `router.refresh()`
8. **Desabilitar "Consolidado"** com badge "Em breve" até implementar
9. **Desabilitar "Fabricado"** no `NovoProdutoModal` com badge "Em breve"
10. **Criar `savePrecoVendaLote`** — batch upsert

### Médio prazo

11. Paginação server-side em `getPainelFinanceiro`
12. Corrigir semântica do `faturamentoAtual` (renomear para `valorPortfolio`)
13. Auditoria de `produto.unidade_id = NULL` e estratégia de migração
14. Consolidar os dois sistemas de preços (`receita_preco` vs `produto_preco`)

---

## 6. Conclusão

O sistema funciona bem como single-tenant para a Flor do Trigo hoje. A UI do Painel Financeiro é bem construída, os gráficos SVG sem dependências são elegantes, e o modelo de produto como entidade de 1ª classe foi a decisão arquitetural correta.

O problema central: **3 sessões de desenvolvimento acumularam débito de segurança** ao refatorar de single-tenant para multi-tenant sem revisar as camadas anteriores. Nenhum dos problemas CRÍTICOS exige reescrita — são correções de 5-20 linhas cada. Os 3 CRÍTICOs + 5 ALTOs mais urgentes podem ser resolvidos em um dia de trabalho focado.

**Informações adicionais para completar a análise:**
- `SELECT COUNT(*) FROM produto WHERE unidade_id IS NULL` — quantos produtos bloqueados para precificação
- `SELECT * FROM pg_policies WHERE tablename = 'produto'` — políticas RLS atuais em produção
- Se `receita_preco` ainda é usada ativamente ou pode ser descontinuada

---

## Inventário de arquivos relevante (Passo 1)

**Config & infra**
- `package.json` (deps: next 16.2.9, react 19, @supabase/ssr, lucide-react; **sem libs de teste**) · `next.config.ts` (vazio) · `eslint.config.mjs` · `tsconfig.json` · `postcss.config.mjs`
- `proxy.ts` (middleware de auth) · `lib/supabase/{server,client}.ts` · `lib/format.ts` (parsing/format BRL)
- `app/globals.css` (Tailwind v4 `@theme` + tokens `--t-*` + componentes `.btn-primary`/`.card-surface`/`.input-field`)
- **Não há `tailwind.config.ts`** (Tailwind v4 usa CSS) — o `PLAN.md` referencia um arquivo inexistente.

**Banco (Supabase)**
- `supabase/migrations/20260618_transferencia_unidades.sql` (tabelas, função de código, views, índices, RLS)
- `supabase/migrations/20260618130000_usuario_unidade.sql` (vínculo usuário↔unidade)
- **Ausentes:** migrations de `insumo/receita/produto/...`, views `vw_custo_receita`/`vw_insumo_custo_atual`, RPC `fn_get_user_unidade`.

**Shell & navegação**
- `app/layout.tsx` (fontes + ThemeProvider) · `app/dashboard/layout.tsx` · `app/components/dashboard-shell.tsx` (shell escuro) · `app/components/sidebar.tsx` (menu, 9 itens, toggle de tom) · `app/components/nav-link.tsx`
- `app/context/theme-provider.tsx` (alterna **Creme Clássico ↔ Creme Quente** — duas variantes **claras**, não há dark)
- **Código morto:** `app/components/navigation.tsx`, `app/components/header.tsx`
- `app/components/unidade-selector.tsx` (seletor decorativo) · `app/components/ui/{page-title,section-label,status-badge,unidade-medida-selector}.tsx`

**Núcleo de custo (claro)**
- `app/dashboard/page.tsx` (Resumo: cards, atenção, ABC, últimas fichas)
- `app/dashboard/insumos/{page.tsx,actions.ts,types.ts}` + `components/{insumo-list,insumo-modal}.tsx`
- `app/dashboard/receitas/{page.tsx,actions.ts,types.ts,[id]/page.tsx}` + `components/{ficha-view,receita-list,receita-modal,item-modal}.tsx`
- `app/dashboard/precos/page.tsx`

**Gestão (stubs)**
- `app/dashboard/painel/page.tsx` · `app/dashboard/simulador/page.tsx` · `app/dashboard/configuracoes/{page.tsx,components/config-panel.tsx}`

**Transferências (escuro, hex inline)**
- `app/actions/transferencia.ts` (create/confirmar/getUserUnidade)
- `app/dashboard/transferencias/{page.tsx,nova/page.tsx,receber/page.tsx,[id]/page.tsx,layout.tsx,loading.tsx}`
- `components/{nova-transferencia-form,confirmacao-drawer,transferencia-table,status-badge}.tsx`

**Auth**
- `app/login/{page.tsx,actions.ts}` (card escuro sobre fundo creme)
