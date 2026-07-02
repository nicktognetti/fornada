# Changelog — ERP Fornada

Todas as mudanças notáveis são registradas aqui.
Formato: `tipo: descrição — detalhes`

---

## [Não lançado]

### Ficha — editar/excluir item visível no tablet
> No tablet a **tabela** de ingredientes era larga demais e a coluna de ações ficava **cortada** pelo
> `overflow-hidden` do card — parecia que não dava pra editar/excluir. Agora telas até `lg` usam o
> **layout de cards** (ações sempre visíveis) e a tabela só aparece em telas largas.
- Botões **"Editar"** (rotulado) e **excluir** (com **confirmação** antes de apagar) claros e com bom
  alvo de toque, em cada ingrediente. Fim do apagar acidental.


### Produto Fabricado — cadastro habilitado
- **Aba "Fabricado" no modal de Novo Produto** (antes "Em breve"): cria um produto ligado a uma
  **ficha técnica**. Seletor de ficha com **busca** e **prévia do custo unitário** (ex.: `R$ 0,67 / un`);
  o **nome** já vem preenchido com o da ficha (editável); o **custo vem automático da ficha** e o preço
  de venda é definido depois em Preços.
- **Campo "Local de produção"** no modal (revenda e fabricado) — define o setor já na criação
  (Produção, Confeitaria…), que aparece na comanda da encomenda.
- **Anti-duplicata**: fichas que já viraram produto na loja não aparecem no seletor
  (guarda também no servidor: erro se já existe produto ligado à ficha na unidade).
- Backend: `createProdutoFabricado(nome, categoria, receitaId, unidadeId, local?)`; `createProdutoRevenda`
  passa a aceitar `local`. Fichas vêm de `vw_custo_receita` (id, nome, custo_unitário, unidade de rendimento).
- Fix: a coluna "Local" na lista de produtos passa a refletir produtos recém-criados sem precisar recarregar.
- Fix: o modal de Novo Produto abre com a **unidade em que o usuário está** (Morada do Sol → Morada do Sol),
  em vez de sempre a primeira em ordem alfabética (Centro).

### Custo e preço por KILO (fim do "por grama")
> Antes tudo era exibido por unidade-base (grama), gerando números minúsculos que arredondavam pra
> `R$ 0,01`. Agora custo/preço aparecem **por kg** (peso), **por L** (volume) ou **por un** — a padaria
> pensa em kg. A **margem/markup não muda** (é razão): só a apresentação/entrada foi convertida.
- Helpers em [format.ts](lib/format.ts): `unidadeGrande` (g→kg, ml→L), `fatorGrande`, `valorPorGrande`,
  `formatCustoGrande` (ex.: custo `0,0125/g` → **`R$ 12,48/kg`**). +5 testes.
- **Ficha técnica**: custo unitário e custo/un de cada ingrediente por kg; **nome de ingrediente longo
  truncado** (com tooltip) — antes esticava a linha e ficava difícil de ler. Impressão idem.
- **Fichas, Insumos, Produtos, Preços e Painel** (incl. célula de preço inline e precificadora): custo
  e preço por kg. `ProdutoFinanceiro`/`ProdutoDetalhe` ganharam `rendimento_unidade` (via `produto→receita`).
- **Entrada de preço** no painel: digita e edita **por kg**; salva por unidade-base (÷1000) — margem correta.
- Drawer de detalhe: composição mostra **"Custo do lote"** (soma dos itens) em vez do custo unitário
  (que aparecia como `R$ 0,01` e não batia com os itens).

### Encomenda — bloqueia item sem valor
- Ao salvar, cada item precisa de **descrição** (avulso), **quantidade > 0** e **valor > 0**. Antes dava
  pra finalizar um item avulso em `R$ 0,00`.

### Ficha técnica — adicionar vários itens de uma vez
> Antes era 1 clique em "Adicionar" por ingrediente, cada um abrindo/fechando o modal. Agora o modal
> vira uma **lista**: busca → escolhe → quantidade → **"Adicionar à lista"** (continua aberto, limpa pro
> próximo) e no fim **"Salvar N itens"** grava tudo de uma vez, voltando à ficha **uma só vez**.
- Novo modo "lista" no [ItemModal](app/dashboard/receitas/components/item-modal.tsx): monta a lista dentro
  do modal (com remover item, marca "✓ na lista", Enter adiciona), salva em lote e fecha uma vez.
- Backend: `addItensLote(receitaId, itens[])` — checa permissão uma vez, valida quantidade e **ciclo de
  sub-receita** por item, insere todos numa operação. A edição de 1 item segue igual.

### Preços — definir preço direto na tela (mais fácil)
> Antes, "definir preço" **mandava pra outra tela** (Painel, tabela densa) com a edição numa célula
> minúscula. Agora dá pra precificar **na própria tela de Preços**, num modal simples.
- Novo **modal "Definir preço"** ([definir-preco-modal](app/dashboard/precos/components/definir-preco-modal.tsx)):
  escolhe entre **digitar o preço (R$/kg)** ou **definir por margem %**, com **margem e markup ao vivo**;
  salva por unidade-base (÷1000) — margem correta. Abre a partir da lista de Preços (sem preço **e** com preço).
- Atalho de **margem em lote**: um campo de % + "Aplicar a todos" define o preço de todos os produtos
  sem preço de uma vez (reusa `savePrecoVendaLote`).
- Nota: **orçamento e encomenda já eram "lista"** (o seletor de produto fica na tela e você empilha vários
  itens antes de salvar) — nenhuma mudança necessária lá.

### Pedido por kg × por unidade (venda)
> A unidade de venda vem da **ficha**: rende em **g/kg** → vendido por **kg**; rende em **un** → por
> **unidade**. Antes o pedido usava o preço **por grama**, então "2 × R$ 0,03" dava errado. Agora o
> item entra pelo preço da **unidade de venda** e a quantidade é nessa unidade.
- `getProdutosParaOrcamento` retorna `preco_base` por unidade de venda (kg/L/un) + `unidade_venda`.
- Builders de **orçamento e encomenda**: mostram a unidade (ex.: "base R$ 30,00/kg", "Qtd … kg") e o
  total sai certo (2 kg × R$ 30 = R$ 60). Avulso segue com preço livre, sem unidade.
- **Comanda e orçamento impressos** mostram a unidade na quantidade ("2 kg — Bolacha") — a unidade é
  derivada por item (produto → ficha), sem migration.

---

## 2026-07-01 — Clientes, edição, status e impressão v2 (continuação)

> Build/tsc verdes e **72 testes** em todos os commits. **Deploy destravado:** repo tornado
> **público** no GitHub → `git push` publica automático em `fornada.vercel.app` (não depende
> mais do autor do commit ser membro do time). Cada leva foi testada ao vivo no preview.
> Migrations aplicadas em produção: `20260701000000`, `20260701000001`, `20260701000002`.

### Orçamento & Encomenda — v2 (`50dffc3`)
- **Status do orçamento** — `aguardando` / `aprovado` / `recusado` com badge e botões (Aprovar/Recusar/Reabrir) na tela; filtro por status (tabs) no histórico.
- **Número sequencial** — "Nº X" na lista, na tela e na impressão (orçamento e comanda), via sequences no Postgres (não repete mesmo ao excluir).
- **Filtro por período** (de/até) nas listas de orçamento (criação) e encomenda (entrega).
- **Cadastro de clientes** — campo Cliente vira autocomplete (`datalist`) + upsert automático por loja ao criar pedido. Migration `20260701000000` (status/número + tabela `cliente`).

### Gestão de clientes, busca de produto, favicon (`ed70b84`, `61783e7`)
- **Tela de Clientes** (CRUD) — nova tela RBAC `clientes` no menu; busca, cadastro avulso, edição e exclusão. Depois expandida com **telefone/WhatsApp, e-mail, endereço, CPF/CNPJ e observações** (todos opcionais; só `nome` único por loja) — migration `20260701000001` (backfill `telefone = contato`, coluna `contato` fica como legado).
- **Seletor de produto com busca + categoria** (`ProdutoPicker`) — substitui o `<select>` nos dois builders; filtra ao digitar, chips por categoria, pensado para catálogos grandes.
- **Favicon da marca** — logo real da Flor do Trigo sobre tile (depois **preto com logo branco**, via máscara alpha); `app/icon.png` + `app/apple-icon.png`, remove o `favicon.ico` genérico.
- **Menu reordenado** por fluxo, com divisórias (visão geral → custos/produtos → vendas/clientes → estoque → config).

### Edição de pedido + "expirado" automático (`05314a9`)
- **Edição de pedido salvo** (orçamento e encomenda) — botão "Editar" na tela, rotas `/[id]/editar` reaproveitando os builders em modo edição; actions `atualizarOrcamento`/`atualizarEncomenda` (substituem itens + recalculam total + re-upsert do cliente). Edição de encomenda exige nível admin (quem não vê valores zeraria os preços).
- **Orçamento "expirado"** — estado derivado de `created_at + validade` (helper puro `lib/orcamento-status` com testes); badge cinza + filtro "Expirado". Não é coluna no banco.

### Ajustes de UX no builder (`9adeb65`, `22e1b62`)
- **Não duplica item do catálogo** — clicar de novo num produto incrementa a quantidade da linha existente.
- **Item do catálogo trava nome e preço** — nome fixo, preço só muda pela **%** (calcula sobre o base). Para nome/preço livre, usar **"+ Avulso"**.
- **Encomenda: hora de entrega obrigatória** (validação no builder e no servidor) + **dica visível** de que o campo % ajusta o preço sobre o base.

### Encomenda — acompanhamento de status e impressão (`1fc2e84`, `254b1ec`)
- **Toggle "Acompanhar produção"** ao criar (ligado por padrão). Desligado, o fluxo vai direto **Pendente → Entregue** (casos de revenda). Coluna `encomenda.rastrear_status`.
- **Histórico de status** — cada mudança grava data/hora (tabela `encomenda_status_log`, RLS por loja); a tela mostra a **linha do tempo com o tempo em cada etapa** e isso sai na impressão. Migration `20260701000002` (com backfill). Helper `lib/duracao` com testes.
- **Impressão** — linhas de **assinatura** (Responsável / Produção na comanda; Responsável / Cliente no orçamento) e **rodapé configurável**: nova aba **Cadastros → Rodapé de Impressão** (endereço, telefone, e-mail, site, Instagram, linha extra) salva em `config_geral` (sem migration), lida pelo `DocumentoImpressao`.

---

## 2026-07-01 — Módulos novos, impressão, deploy (sessão longa)

> Build/tsc/52 testes verdes em todos os commits. **Deploy:** primeiro deploy na Vercel
> feito (`fornada.vercel.app`, via `vercel`); os deploys seguintes (push GitHub + CLI)
> ficaram bloqueados — o Vercel recusa deploys cujo **autor do commit** (`nicholas@agrindus.com`,
> identidade auto-configurada do git) não é membro do time. Resolver do lado do Vercel
> (repo público, ou Pro + colaborador, ou conectar o e-mail). Código todo no GitHub.

### Módulos novos
- **Encomendas** (`ae25b43`) — pedidos de cliente com **data/hora de entrega**, **status** (Pendente → Em produção → Pronto → Entregue / Cancelada), **valor opcional** (`com_valor`) e **comanda impressa** pra produção (entrega em destaque, itens, observação por item). Tabelas `encomenda`/`encomenda_item` (RLS por loja, migration `20260630000001`). Nova tela RBAC `encomenda`.
- **Orçamentos** (`b718558`) — orçamento por cliente que **persiste** (busca depois), com **ajuste de preço por item (valor ou %)** e impressão. Tabelas `orcamento`/`orcamento_item` (RLS por loja, migration `20260630000000`). Nova tela RBAC `orcamento`.
- **Precificação de insumos em lote** — grade editável (preço + rendimento com preview de custo/uso ao vivo), `addPrecosLote`. Desbloqueia os 229 insumos sem preço. Botão em Insumos → `/dashboard/insumos/precificar`.

### Impressão de documentos
- **`DocumentoImpressao` + `BotaoImprimir`** (`660ef86`, `c3123dd`) — documento A4 claro renderizado via **portal no `<body>`** (só ele imprime, sem páginas em branco). Aplicado em **Ficha técnica**, **Romaneio de transferência**, **Tabela de Preços** e **Comanda de Encomenda/Orçamento**.
- **Logo** (`d068966`, `ea0d47a`) — usa o logo oficial da Flor do Trigo (mesmo do login, `LOGO2claro.png`) **invertido para preto** (`filter: brightness(0)`) — sai limpo no papel branco, sem painel.
- Fix Tailwind v4: `@page` fora do `@media print` (o Lightning CSS derrubava o bloco).

### UX & produtividade
- **Drill-down por clique** (`c54647a`) — drawer reutilizável (`DetailDrawer`); produto abre detalhe (rentabilidade + composição da ficha), KPIs do Painel abrem breakdown, barras do Top 10 abrem o produto.
- **Cópia filtrada entre lojas** (`ecff353`) — o modal Copiar agora lista itens (Fichas/Insumos) com **checkboxes + filtro por grupo/categoria** (ex.: só "Chocolates"); antes era tudo-ou-nada.
- **Menu lateral fixo a partir de 768px** (`ecf7a9f`) — era 1024px (`lg`); em laptops com escala do Windows caía no hamburger. Agora `md`.

### Infra & validação
- **Deploy preparado** (`707a610`, `0660df5`) — `DEPLOY.md` (runbook GitHub→Vercel) + `.env.example`; repo privado no GitHub (`nicktognetti/fornada`).
- **Guard de rota por tela** no `proxy.ts` (`telaParaRota`) — acesso direto por URL a tela não concedida redireciona (o menu já escondia, mas a rota não barrava).
- **Teste de isolamento RBAC** validado com usuários QA (Centro vê vazio, Morada vê seus dados; nav filtra por permissão).

---

## 2026-06-26 — Bugs pós-teste + Auditoria de segurança (8 commits)

### Bugs encontrados em teste de usuários
- **Loop ao logar desabilitado** (`f952cd7`, `157afe7`) — `dashboard/layout.tsx` agora faz `supabase.auth.signOut()` antes de redirecionar; sem sessão ativa o `proxy.ts` não devolve ao dashboard. Login exibe "Usuário sem permissão de acesso" via `?error=desabilitado`
- **Resumo aparecia para todos** — removido `FALLBACK_TELAS` do sidebar; Resumo respeita RBAC como as demais. Movido de `/dashboard` para `/dashboard/resumo`; `/dashboard` virou landing page com logo
- **Admin Global não restringia Configurações** — grade de permissões desabilita telas individuais quando `*=admin` está ativo + aviso
- **Dados cruzados entre lojas** — `syncUsuarioUnidade` agora remove vínculos obsoletos de `usuario_unidade` (era só aditivo) + SQL de limpeza aplicado no banco
- **Transferência não aparecia no Receber** / **nome do produto vazio no drawer** — `receber/page.tsx` e `getTransferenciaItensAction` usam `supabaseAdmin` (RLS de produto por loja bloqueava leitura do destinatário)
- **Configurações inacessível para admin de config** — `assertAdmin` aceita `tela='configuracoes'` além de `tela='*'`

### Segurança (auditoria sênior)
- **#1 Vazamento intra-tenant** (`1f83bc0`) — novo `getUnidadeAutorizada()` valida o cookie de loja contra `usuario_unidade`. Crítico nas páginas com `supabaseAdmin` (receber, nova-transferência), onde o RLS é bypassado e o filtro de loja era a única barreira — antes, trocar o cookie revelava dados de loja-irmã da mesma empresa
- **#2 Granularidade módulo × loja na escrita** (`772a0f9`) — actions de escrita (insumos, receitas + itens, preços, criar produto) passam a unidade-alvo para `temAcesso({ unidadeId })`; novo helper `unidadeDoRegistro()` resolve a loja real via `supabaseAdmin` (para poder NEGAR mesmo sem vínculo). Antes, usuário multi-loja com permissão de módulo só na Loja A escrevia na B trocando o cookie
- **#3 Migrations conflitantes** (`9b01f3d`) — `20260624*` (RLS por empresa) movidas para `supabase/migrations/_descartadas/` — conflitavam com a RLS por loja vigente
- **#5 Testes de autorização** (`51025ed`) — núcleo puro `authz-core.ts` (`avaliaAcesso`/`isAdminGlobal`, sem imports de servidor) + 26 testes cobrindo escopo por loja, hierarquia de nível, admin global, desabilitado. Suíte: 26 → 52 testes

### Robustez & coerência
- **#6** (`dad87b7`) — `app/dashboard/error.tsx` (boundary com Tentar novamente/Voltar) e `app/not-found.tsx` (404 com identidade visual)
- **#7** (`dad87b7`) — tela `produtos` adicionada ao enum `TELAS` + `TELA_LABEL` e às actions de produto (estava no sidebar mas fora do enum → `canAccess` sempre negava)

> Adiado por decisão de produto: **#4** — isolamento de `insumo_saldo`/`compra`/`despesa_fixa_empresa`/`config_geral` (hoje por empresa, não por loja).

---

## 2026-06-24 — Auditoria Sênior + Design + RBAC fixes

### Design & UX
- **Login redesenhado** — wordmark "Fornada" em Playfair Display Bold Italic + `#ede9e1` (mesma fonte/cor do logo Flor do Trigo); fundo atmosférico com 3 camadas (halo quente bottom, gradiente frio top, vinheta radial); linha decorativa fade-out; botão com gradiente accent; animações staggered `fade-up` (delays 0/120/260/380ms)
- **Grain texture** no `body` via SVG fractalNoise (3,5%) — textura artesanal coerente com identidade de padaria
- **Nav link ativo** com gradiente lateral quente (16% accent → transparente) + barra left com `box-shadow` glow
- **Card hover** com borda quente accent via `.card-surface:hover`
- **Scrollbar** mais visível (thumb opacity 0,25 → 0,38)
- **Fix autofill browser** — `webkit-box-shadow: inset` força dark background nos inputs auto-preenchidos
- **Fix middleware `proxy.ts`** — `/images/` e extensões de imagem (png/jpg/svg/gif/webp/ico) excluídas do matcher de autenticação; root cause: `next/image unoptimized` serve URL direta que era interceptada e redirecionada para `/login` quando não havia sessão

### RBAC & Navegação
- **Nova Transferência — ORIGEM vazia** corrigida: `cookie → unidade.empresa_id → todas unidades da empresa` (substituiu join PostgREST `usuario_unidade` que falhava silenciosamente)
- **Tab Resumo** não aparece mais para usuários sem permissão (`canAccess` durante `isLoading` retorna `false`)
- **UnidadeSelector** oculto em `/configuracoes` (página tem seletor de escopo próprio — evitava duplo seletor)
- **`router.replace()` removido** do `unidade-context.tsx` — `refresh()` sozinho é suficiente para reler o cookie nos Server Components; o `replace()` causava double fetch desnecessário

### Segurança — Data Leak entre Tenants
- `transferencias/page.tsx` — query `unidade` sem `empresa_id` retornava unidades de todos os tenants
- `transferencias-tab.tsx` — `SELECT * FROM produto` sem filtro ao abrir drawer de confirmação → agora filtra por `.in('id', prodIds)`
- `insumos/page.tsx` — `insumo_preco` e `receita_item` sem filtro → reestruturado em 2 fases (IDs → dependentes com `.in()`)
- `dashboard/page.tsx` — `vw_insumo_custo_atual`, `receita_item`, `produto_preco`, `vw_custo_receita` sem filtro → reestruturado em 2 fases

### Estabilidade — `.single()` → `.maybeSingle()`
`.single()` lança exceção quando retorna 0 linhas; todos os usos problemáticos convertidos:
- `receber/page.tsx` — `usuario_empresa`
- `permissoes.ts` (criar usuário) — `usuario_empresa` dentro de try/catch causava rollback indevido do usuário recém-criado
- `transferencia.ts` — 4 instâncias em `cancelar`, `excluir` e `confirmar recebimento`
- `receitas/actions.ts` — `getEmpresaId()`
- `insumos/actions.ts` — `getEmpresaId()`
- `receitas/[id]/page.tsx` — `vw_custo_receita` (crash se receita sem custo calculado)

### Permissões
- `permissions-context.tsx` — `canAccess()` retornava `true` durante `isLoading`; se o fetch falhasse silenciosamente, acesso ficava liberado permanentemente → corrigido para `false`

### Resiliência
- `dashboard/layout.tsx` — `getUnidadesDoUsuario()` sem try/catch; falha de query derrubava o layout inteiro → envolvido em try/catch com retorno `[]`

### Design System / Contraste
- `status-badge.tsx` — `text-emerald-700`/`text-amber-700` têm ~3:1 contraste no dark (abaixo do WCAG AA) → substituídos por tokens `text-success`/`text-warning`/`bg-success`/`bg-warning`
- `globals.css` — `--t-nav-bg` e `--t-nav-border` estavam referenciados em `.app-nav` mas não definidos no `:root`

### Acessibilidade
- `sidebar.tsx` — botão "Sair →" recebe `aria-label="Sair do sistema"`
- `nova-transferencia-form.tsx` — botões X (fechar modal, remover item) recebem `aria-label`; ESLint disable de regra inexistente removido
- `transferencia-table.tsx` — `key={i}` em cabeçalhos estáticos → `key={h}`; botão Excluir recebe `aria-label` descritivo

---

## 2026-06-19 — FASE 5: RBAC & Limpeza

**feat: RBAC completo — permissoes, server actions, UI de gerenciamento, Admin Global vs Personalizado**

45 arquivos modificados, 1605 inserções, 661 deleções.

### Banco de dados
- `supabase/migrations/20260619000000_rbac_permissoes.sql` — tabela `permissao` (usuario_id, tela, acesso, unidade_id), constraint UNIQUE, RLS básico
- `supabase/migrations/20260619010000_fix_permissao_rls.sql` — `fn_is_global_admin(uuid)` SECURITY DEFINER para resolver loop infinito 42P17 do RLS; seeds admin para todos os usuários existentes
- `supabase/migrations/20260617150000_baseline.sql` — placeholder vazio para sincronizar histórico de migrations com o remote
- `supabase/migrations/20260618120000_transferencia_unidades.sql` — renomeado de `20260618_transferencia_unidades.sql` (nome não-padrão)

### Infraestrutura
- `lib/supabase/admin.ts` — client Supabase com service_role key; sem auto-refresh, sem persistência de sessão; uso restrito a server actions
- `.env.local` — `SUPABASE_SERVICE_ROLE_KEY` adicionada (não versionada)

### Server Actions (`app/actions/permissoes.ts`)
- `getUserPermissionsAction` — lê as próprias permissões (client anon, RLS SELECT = próprio usuário)
- `savePermissionsAction` — upsert via admin client (bypassa RLS na escrita)
- `deletePermissionAction` — delete pontual via admin client
- `createUserAction(email, password, nome, permissaoInicial)` — cria usuário via `auth.admin.createUser`, vincula à empresa, insere permissões; rollback com `deleteUser` se falhar
- `disableUserAction` — remove todas as permissões do usuário (não exclui `auth.users`); bloqueia auto-desabilitar
- `resetPasswordAction` — redefine senha via `auth.admin.updateUserById`
- `listUsersWithPermissionsAction` — lista `auth.users` da empresa com permissões agregadas via admin client

### Contexto de permissões
- `app/context/permissions-context.tsx` — `PermissionsProvider` com `reload()` via tick counter (sem setState direto em useEffect); `canAccess()` com fallback: mapa vazio = acesso total; `usePermission(tela)` hook

### UI — Tela de Configurações
- `app/dashboard/configuracoes/components/permissoes-tab.tsx` — reescrito como máquina de estados (`lista | editar | novo | reset | desabilitar`)
  - **Lista**: tabela de usuários com badges (Admin Global / N telas / Desabilitado), ações por linha (editar, resetar senha, desabilitar)
  - **Editar**: grade tela-a-tela com quatro níveis (Sem acesso / Leitura / Escrita / Admin), salva via server actions
  - **Novo**: formulário Nome/Email/Senha + seção "Permissões Iniciais" (Admin Global ou grade personalizada inline)
  - **Reset**: campo de nova senha com confirmação
  - **Desabilitar**: tela de confirmação com aviso claro

### Separação Cadastros / Configurações
- `app/dashboard/cadastros/page.tsx` + `app/dashboard/cadastros/components/cadastros-panel.tsx` — novo módulo com abas Tipos / Unidades / Categorias (extraído do antigo `config-panel.tsx`)
- `app/dashboard/configuracoes/page.tsx` — simplificado: apenas Permissões
- `app/dashboard/configuracoes/components/config-panel.tsx` — **deletado** (substituído por `cadastros-panel.tsx`)

### Lógica de permissões
- `app/lib/permissions.ts` — `TELAS[]`, `TELA_LABEL`, `PermissaoMap`, `getAcesso()`, `isGlobalAdmin()`; `cadastros` adicionado

### Sidebar
- `app/components/sidebar.tsx` — 10 itens: Resumo, Fichas, Insumos, Preços, Painel, **Cadastros**, Simulador, Transferências, Receber, **Configurações** (ícone Shield)

### Limpeza de lint (0 erros, 0 warnings)
- `app/context/theme-provider.tsx` — `setState` em `useEffect` → lazy initializer `useState(readStoredTheme)`
- `app/context/unidade-context.tsx` — `useState` + `useEffect` substituídos por derivação direta de `searchParams`
- `app/dashboard/receitas/components/ficha-view.tsx` — `Date.now()` em handler → `useRef` counter
- `app/dashboard/insumos/components/insumo-list.tsx` — idem
- `app/dashboard/receitas/components/receita-list.tsx` — idem
- Múltiplos arquivos — tipos `any` substituídos por tipos explícitos; imports não-usados removidos
- `app/components/header.tsx`, `app/components/navigation.tsx` — **deletados** (código morto sem importadores)

---

## 2026-06-18 — FASE 4: Transferências entre Unidades

**feat(transferencia): módulo completo de transferência entre unidades**

- Módulo completo: nova transferência, lista, detalhe `[id]`, drawer de conferência, skeleton, badges de status
- `app/dashboard/transferencias/receber/` — recebimentos pendentes com abas Conferência / Compras
- Server Actions em `app/actions/transferencia.ts`
- Migrations de schema: `usuario_unidade`, `unidade_id_rls`, `transferencia_financeiro`, `compra`, `views_custo`

---

## 2026-06-17 — FASE 3: Dark Theme + Tokens

**feat: reforma visual V2/V3 — tema escuro unificado, toggle de tema, UnidadeSelector**

- Dark theme com tokens Tailwind v4 (`@theme` em `globals.css`)
- `bg-canvas`, `bg-surface`, `bg-input`, `border-subtle`, `text-primary`, `text-secondary`, `accent-primary`, `accent-ink`
- Contraste do accent corrigido para WCAG AA (6,57:1)
- `UnidadeSelector` na dashboard shell
- Toggle "Creme Clássico/Quente" (depois removido como no-op)

---

## 2026-06-16 — FASE 2: Funcionalidade Core

**feat: fichas técnicas, insumos, preços, parsing decimal BR**

- `lib/format.ts`: `parseDecimalBR` corrigida (bug `"10.00"` → `1000`), `formatBRL`, `formatCustoUso`
- `lib/format.test.ts`: 26 testes Vitest
- Fichas técnicas com modais de receita e item
- Insumos com histórico de preço e preview de custo
- Tela de Preços com margem/prejuízo semânticos

---

## 2026-06-15 — FASE 1: Bootstrap

**feat: setup inicial — Next.js 16 + Supabase + autenticação**

- Next.js 16 App Router, TypeScript strict, Tailwind v4, Supabase
- Login / logout com `proxy.ts` middleware
- Dashboard shell com sidebar e navegação
- Tela Resumo com KPIs e curva ABC
