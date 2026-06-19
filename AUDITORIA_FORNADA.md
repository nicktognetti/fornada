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
