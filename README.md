# Fornada — ERP de custo e preço para a Flor do Trigo

ERP enxuto para a padaria **Flor do Trigo** (unidades **Morada do Sol** — produção + venda — e **Centro** — PDV). O foco é o núcleo de **custo → preço**: cadastrar insumos, montar fichas técnicas (com sub-receitas), calcular custo, precificar e acompanhar margem.

> Projeto em pt-BR. Verdade dos dados: **quantidades em kg**, **custos em R$/kg**. Entrada numérica no padrão BR (vírgula decimal, ponto de milhar) via `parseDecimalBR`.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** — paleta no bloco `@theme` de `app/globals.css` (**não existe `tailwind.config.ts`**); tema **escuro** unificado
- **Supabase** — Postgres + Auth + RLS; service role só em server actions
- **Zod** (validação), **Vitest** (testes), **lucide-react** (ícones)

## Módulos

| Módulo | O que faz |
|--------|-----------|
| **Resumo** | Visão geral: contagens, alertas de atenção, curva ABC de custo, últimas fichas |
| **Insumos** | Cadastro + histórico de preço de compra (INSERT-only) e custo por unidade de uso |
| **Fichas Técnicas** | Receitas e sub-receitas com detecção de ciclo; custo via views SQL |
| **Preços** | Margem/markup por produto, com destaque de prejuízo |
| **Painel Financeiro** | KPIs, gráficos SVG, precificadora, meta, despesas fixas, ponto de equilíbrio |
| **Simulador** | Simulação de reajuste de preço (100% em memória, nunca persiste) |
| **Transferências** | Entre unidades: criar → em trânsito → confirmar recebimento (RPC atômica) |
| **Receber / Compras** | Conferência de transferências + registro manual de compras/NFe |
| **Cadastros** | Tipos, unidades de medida e categorias (persistidos por empresa) |
| **Permissões (RBAC)** | Acesso por **módulo + unidade/empresa** e nível (leitura/escrita/admin) |

Multi-empresa e multi-unidade: `EmpresaSwitcher` + `UnidadeSelector` (persistem em cookie). O **RBAC** é aplicado tanto na UI quanto **no servidor** (`app/lib/authz.ts` → `temAcesso`).

## Como rodar

Pré-requisitos: Node 20+ e um projeto Supabase.

1. Crie `.env.local` na raiz:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
   > `.env.local` é ignorado pelo git. **Nunca** exponha a service role key no client.

2. Instale e rode:
   ```bash
   npm install
   npm run dev      # desenvolvimento (http://localhost:3000)
   npm run build    # build de produção
   npm run start    # servir o build
   npm test         # Vitest (lib/format.test.ts — 26 testes)
   npm run lint     # ESLint
   ```

3. **Banco:** as migrations ficam em `supabase/migrations/`. Aplicar via Supabase CLI/SQL Editor. Veja correções de banco pendentes em [`CORRECOES_FORNADA.md`](CORRECOES_FORNADA.md) (§B).

## Convenções

- **Tema escuro** via tokens (`bg-surface`, `text-primary`, `accent-primary`…) — sem cor inline `bg-[#...]`.
- Botão primário = accent `#d98d5f` com **texto escuro** `accent-ink` (contraste 6,57:1, WCAG AA).
- Todo input monetário usa `type="text" inputMode="decimal"` + `parseDecimalBR` no submit.
- Rodar `npm run build` e `npm test` após mexer em cálculo/parsing.

## Documentação

- [`PLAN.md`](PLAN.md) — plano-mestre e estado das fases (fonte de verdade do desenvolvimento)
- [`AUDITORIA_FORNADA_v2.md`](AUDITORIA_FORNADA_v2.md) — auditoria técnica + produto/UX
- [`CORRECOES_FORNADA.md`](CORRECOES_FORNADA.md) — acompanhamento das correções (feito / pendente)
- [`AGENTS.md`](AGENTS.md) — nota para agentes de IA (esta versão do Next tem mudanças; consultar `node_modules/next/dist/docs/`)
