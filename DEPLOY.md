# Deploy — Fornada (Flor do Trigo)

Guia para colocar o sistema em produção. Stack: **Next.js 16 (App Router) + Supabase**.
A hospedagem recomendada é **Vercel** (frontend + Server Actions) apontando para o
**Supabase** já existente (banco `flor-do-trigo`).

---

## Pré-requisitos

- Conta no [Vercel](https://vercel.com) (pode logar com o GitHub).
- Repositório no GitHub (passo 1).
- As 3 variáveis de ambiente (ver `.env.example`) — valores em **Supabase → Project Settings → API**.
- Build local passando: `npm run build` (exit 0).

---

## Passo 1 — Subir o código pro GitHub

O repositório é local (branch `master`, sem remote). Crie um repositório **privado** e faça push:

```bash
# já autenticado via gh (conta nicktognetti)
gh repo create fornada --private --source=. --remote=origin --push
```

> O `.gitignore` já protege `.env*` e os scripts `_demo_*` — eles **não** vão pro GitHub.

---

## Passo 2 — Importar no Vercel + variáveis de ambiente

1. Em https://vercel.com/new, **Import** o repositório `fornada`.
2. Framework: **Next.js** (detectado automaticamente). Build/Output: padrão.
3. Em **Environment Variables**, adicione as 3 (Production + Preview):

| Variável | Onde achar | Sensível? |
|----------|-----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → API → Project URL | não |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → anon public | não |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → service_role | **SIM — marque Sensitive** |

4. **Deploy**.

> Alternativa por CLI: `npm i -g vercel`, depois `vercel` (preview) e `vercel --prod` (produção).
> Para puxar as envs já configuradas: `vercel env pull .env.local`.

---

## Passo 3 — Supabase (produção)

O app usa **um único projeto Supabase** para tudo. Em produção ele aponta para o mesmo
banco `flor-do-trigo` — não há migration nem mudança de schema pendente.

Antes de liberar para a Natali, no painel do Supabase:

- **Auth → URL Configuration**: adicione a URL de produção da Vercel em *Site URL* e *Redirect URLs*.
- **Backups**: confirme que o backup automático está ativo (plano Pro) ou agende um dump manual.
- **RLS**: já está ativa (isolamento por loja validado). Não desligar.

---

## ✅ Checklist pré-lançamento (rodar ANTES de entregar à Natali)

- [ ] **Remover a ilha-demo e os usuários QA do banco**: `node _demo_cleanup.mjs`
      (remove "Bolo de Cenoura (demo)" etc. + `qa.centro@`/`qa.morada@`). Rodar com o `.env.local` apontando para produção.
- [ ] **Monitoramento de erros**: ativar Vercel Observability (logs/erros de Server Actions) ou instalar Sentry.
- [ ] **Backup do Supabase** confirmado.
- [ ] **Trocar senha** dos usuários reais (Centro/Morada) se as atuais forem de teste.
- [ ] **Smoke test em produção** (passo 4).
- [ ] (Opcional) **Domínio custom** em Vercel → Settings → Domains.

---

## Passo 4 — Smoke test pós-deploy

Na URL de produção:

1. **Login** com o admin (nicholas@) → cai no dashboard.
2. **Insumos / Fichas / Painel** carregam sem erro.
3. **Precificar em lote** abre e salva um preço.
4. **Trocar de loja** (Centro/Morada) filtra os dados.
5. Logar com um usuário **escopado** e confirmar que só vê a própria loja e os telas concedidos
   (acesso direto a `/dashboard/painel` por quem não tem deve redirecionar).
6. Conferir os **logs da Vercel** — sem erros 500.

---

## Rollback

Cada deploy na Vercel é imutável. Para reverter: **Vercel → Deployments → (deploy anterior) → Promote to Production**.
Mudanças de dados no Supabase **não** voltam com o rollback do app — por isso o backup importa.

---

## Notas

- **Runtime**: Vercel usa Node.js LTS por padrão; o app não exige versão específica.
- **Middleware**: `proxy.ts` (renomeado do `middleware.ts` no Next 16) roda no runtime Node e faz o guard de auth + permissão por tela.
- **Sem segredos no código**: as chaves vivem só em variáveis de ambiente (auditado).
- **Cálculo de custo/preço** vive no banco (views/funções) — o deploy do front não altera regra de negócio.
