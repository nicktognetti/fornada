# Changelog — ERP Fornada

Todas as mudanças notáveis são registradas aqui.
Formato: `tipo: descrição — detalhes`

---

## [Não lançado]

### Setor da receita (Confeitaria, Padaria, Salgados…)
> "De onde a receita é." A produção acha rápido por setor e a Natali organiza as fichas.
> Migration `20260709000000_receita_categoria` **APLICADA** (coluna `receita.categoria`).
- **Texto livre com autocomplete** dos setores já usados (mesmo desenho da categoria de
  insumo) — a casa cria os próprios setores, sem lista fixa. Componente reusável
  `SetorField` (`receitas/components/setor-field.tsx`) + action `getCategoriasReceita`
  (sugestões distintas, escopo por loja via RLS).
- **Onde preenche**: ficha da Natali (campo ao lado de "Tipo"), "Nova Receita" da produção
  e "Editar modo de fazer" — persistido em `createReceita`/`updateReceita`/
  `createReceitaCaderno`/`updateModoPreparo`.
- **Onde aparece / filtra**: pill do setor + filtro "Todos os setores" (só surge quando há
  ≥1 setor) no catálogo do Caderno e na lista de Fichas; pill também na página da receita
  (Caderno), na Ficha Técnica (+ subtítulo da impressão) e no Modo Cozinha.
- Validado E2E com dois papéis: criar/editar setor, autocomplete puxando setor existente
  entre produção e gestão, filtro, pills — sem vazar custo pro Caderno.

### Caderno ⇄ Fichas — produção cria receita, Natali precifica (com aviso)
> Fecha o ciclo dos dois lados: a produção cria a receita no Caderno (com
> ingredientes ligados ao insumo, sem ver custo) e ela cai automática nas Fichas
> da Natali para precificar, com um aviso pra ela. Migration
> `20260708120000_receita_revisao` **APLICADA** (coluna `revisao_pendente`).
- **Nova receita no Caderno**: botão + modal (nome, rendimento, tempos, passos, dica) →
  `createReceitaCaderno` (nasce `revisao_pendente=true`) → abre a receita para a produção
  **adicionar os ingredientes** reusando o seletor de insumos (`ItemModal`), sem custo.
- O detalhe do Caderno virou a **página da receita** (ingredientes editáveis + modo de
  fazer + botão "Modo Cozinha" → checklist na bancada, agora em `caderno/[id]/cozinha`).
- Ingredientes editáveis pela produção: `addItem`/`addItensLote`/`updateItem`/`removeItem`
  passam a aceitar permissão `caderno`; mudança de quem não vê Fichas re-marca
  `revisao_pendente` (Natali reconfere).
- **Aviso pra Natali**: badge no menu "Fichas" (`contarReceitasPendentes`), tag
  "NOVA · REVISAR" e ordenação no topo da lista, banner na ficha + botão "Marcar como
  revisada" (`marcarReceitaRevisada`). Mesma receita, uma fonte só — a Natali vê o custo
  calculado e precifica no fluxo normal.
- Validado E2E: produção (só `caderno`) criou receita + ingredientes sem custo; Natali
  (`receitas`) recebeu badge/tag/banner, viu o custo (R$ 1,79), marcou revisada → aviso sumiu.

### Placeholder de imagem com a marca Flor do Trigo
> Produtos e receitas **sem foto** passam a mostrar o logo da Flor do Trigo esmaecido,
> no lugar de um ícone genérico — fica com cara de casa.
- Componente `LogoPlaceholder` (`app/components/ui/logo-placeholder.tsx`): logo claro
  sobre `bg-input`, opacidade 0.35 (lê como "sem foto ainda", não como se fosse a foto).
- Aplicado no catálogo do Caderno, lista de Fichas Técnicas, lista de Produtos e no
  drawer de produto. Validado no preview (logo renderiza nos três lugares).

### Caderno de Receitas — o "modo de fazer" na Ficha Técnica
> Pedido da Natali: o caderno de receitas da confeitaria dentro do sistema. A Ficha
> Técnica (custo) ganhou o lado humano — como fazer, tempos, foto — e uma tela de
> bancada. Migration `20260708000000_receita_caderno` **APLICADA**.
- **Campos novos na receita** (colunas aditivas em `receita`): `passos` (modo de preparo
  numerado, JSONB), `tempo_preparo_min`, `temperatura_forno`, `tempo_forno_min`,
  `dificuldade` (fácil/média/difícil) e `foto_url`. Bucket público `receita-fotos`
  (mesmo desenho do `produto-fotos`: leitura pública, escrita via service role).
- **Editor no modal da ficha**: passos numerados com adicionar/remover/reordenar, tempos,
  dificuldade e "dica/segredo da casa". A ficha mostra foto (upload por clique), chips de
  tempo/forno e a seção Modo de preparo. Impressão estendida com os passos e tempos.
- **⭐ Modo Cozinha** (`/dashboard/receitas/[id]/cozinha`): tela grande para o tablet na
  bancada — ingredientes e passos que se **riscam** ao tocar, foto e tempos em destaque,
  **zero valor de custo** (feita para a confeitaria; o custo segue gated pelo RBAC).
- **Miniatura da foto** na listagem de receitas (placeholder com ícone quando sem foto).
- Validado E2E no preview: cadastro de passos+tempos+dica salvo e persistido, chips na
  ficha, Modo Cozinha com checklist, upload de foto no bucket e impressão.

### Caderno de Receitas — tela separada da produção (RBAC próprio)
> Público diferente, porta diferente: **Fichas Técnicas** é da Natali/gestão (custo,
> margem); **Caderno** é da produção/confeitaria (só o modo de fazer). Mesma receita
> nos dois — fonte única, sem duplicar dado.
- **Tela nova `caderno`** (`/dashboard/caderno`) com **permissão própria**: catálogo com
  fotos + busca. Registrada em `permissions.TELAS`/`TELA_LABEL`, `sidebar` e
  `proxy.telaParaRota` (guard de rota). Quem tem só `caderno` vê o Caderno e **não** as
  Fichas (validado: menu só com "Caderno", URL direta a `/receitas` redireciona).
- **Abrir uma receita** no Caderno → Modo Cozinha (seguir/riscar) + **"Editar modo de
  fazer"** (passos, tempos, dificuldade, dica e foto — **nunca** nome/ingredientes/custo).
  Nova action `updateModoPreparo` (permissão `receitas` OU `caderno`); ingredientes
  seguem da ficha técnica. Editor de passos extraído em `PassosEditor` (reuso ficha+caderno).
- Validado E2E como usuário de produção (permissão só `caderno`): catálogo, Modo Cozinha,
  editar modo de fazer salvo e persistido, zero custo em toda a jornada.

### Produtos — valores (custo/preço/margem) só para quem pode ver
> A pessoa da operação (tem/acabou, foto, canais do robô) trabalha na tela de Produtos
> **sem ver números** — mesmo padrão do podeVerValores das Encomendas.
- Regra (`podeVerValoresProdutos` em authz): vê valores quem é **admin** da tela `produtos`
  OU tem qualquer acesso a `precos`/`painel` (onde os valores aparecem de qualquer forma).
  Escrita/leitura em produtos = opera o robô e o setor, sem custo/preço/margem.
- O corte é **no servidor** (payload já vai zerado, não é só esconder na tela): lista, drawer
  (Rentabilidade, Composição, Custo de compra e Preço/volume somem; a seção do robô continua),
  custo das fichas no modal Novo Produto e a impressão (vira "Lista de Produtos" sem colunas
  de valor).
- Validado E2E: usuário escrita → zero "R$" na tela e no drawer, controles do robô intactos;
  promovido a admin → valores voltam.

### Atendimento — blindagem e refinamentos pré-go-live (rodada final)
> Segurança + robustez antes do número real. Migration `20260707000000` **APLICADA**.
- **🔒 Assinatura do webhook**: valida o `X-Hub-Signature-256` da Meta (HMAC-SHA256 do corpo cru
  com o App Secret). Com `META_APP_SECRET` configurado, requisição sem/with assinatura errada
  leva **401** (validado ao vivo: 401/401/200 com HMAC correto); sem o env, aceita com aviso no
  log (rollout suave — cadastrar o secret na Vercel fecha a porta).
- **Anti-abuso**: número que metralha mensagens para de gastar IA/WhatsApp — limite de
  **6/min e 40/h** por conversa (validado: 7 mensagens → 6 respostas; as excedentes ficam salvas
  e visíveis no painel).
- **Pedido com VÁRIOS itens**: "2kg de bolacha e 3 brioches" agora vira lista estruturada
  (`itens` JSONB) + resumo em texto. "Virar pedido" e o pedido automático criam **um item da
  encomenda por produto** (quantidade do cliente na observação); modal mostra a lista.
- **Fora do expediente**: o prompt recebe o dia/hora atual (Brasília) e cruza com os horários
  oficiais — fora do horário, o robô avisa que está fechado e quando abre, mas segue anotando.
- **Alerta de erro no WhatsApp do admin**: falha crítica (Groq fora etc.) manda "🚨 Robô com
  problema" pro número do env `ALERTA_WHATSAPP` (opcional; trava de 1 alerta/30min por origem).
- **Polimentos**: botão **Imprimir/PDF** na aba Relatório (documento A4 com KPIs, por dia e top
  produtos); **notificação do navegador** de pedido novo (toggle por aparelho, pede permissão);
  card **"Robô do WhatsApp hoje"** no Resumo (total, por canal, aguardando → link pro painel).
- 105 testes ✅ (assinatura com HMAC real, multi-itens, linha de template).

### Atendimento — pacote de operação: infos da loja, template, agente de impressão, som, relatório e cliente
> As 6 melhorias indicadas. Migration `20260706000003` **APLICADA**.
- **Informações oficiais da loja** (aba Robô, por loja): horários, endereço, pagamento, entrega e
  extras. O que estiver preenchido o robô **informa ao cliente** (testado: "que horas abrem no
  domingo?" → resposta com o horário oficial + taxa de entrega); o que ficar vazio segue
  "confirmo com a equipe". Vale na próxima mensagem, sem deploy. Tabela `atendimento_loja_info`.
- **Template aprovado no aviso à equipe** (campo no canal): com um template da Meta (corpo
  `{{1}}`), o aviso **fura a janela de 24h** e chega sempre; se o template falhar, cai na
  mensagem livre. Envio via `enviarTemplate` (pt_BR); resumo em linha única (regra da Meta).
- **Agente de impressão local** (`scripts/agente-impressao.mjs`): térmica **100% silenciosa** —
  script standalone (Node 18+) que roda no PC da loja, consulta `GET /api/atendimento/comandas`
  (token `IMPRESSAO_TOKEN`), imprime comanda 42 colunas via `Out-Printer` e marca `impresso_em`.
  Ciclo da API validado: 401 sem token → lista → marca → some da fila.
- **Som de pedido novo** (toggle por aparelho, aba Robô): aviso sonoro em qualquer tela quando o
  contador de pendentes sobe (WebAudio, sem arquivo).
- **Aba Relatório**: mês a mês por loja — total, por canal, % anotado→virou pedido, pedidos por
  dia e produtos mais pedidos.
- **Cadastro do cliente pela conversa**: botão "Cliente" no cabeçalho mostra/edita nome,
  endereço salvo e observação (mesma tabela da tela Clientes; o robô usa na próxima conversa).
- E2E no preview: info salva pela UI → robô respondeu horário/taxa; ciclo completo da API de
  comandas; relatório com KPIs/gráficos; cliente editado e persistido. 99 testes ✅.

### Atendimento — memória de cliente, comanda térmica, badge, anti-duplicata e pedido automático
> Fecha o ciclo operacional do robô. Migration `20260706000002` **APLICADA**.
- **Memória de cliente**: quando o robô anota um pedido, **cadastra/atualiza o cliente**
  automaticamente (telefone = WhatsApp, nome, endereço do delivery) na tabela de Clientes que a
  Natali já usa. Na volta, o robô recebe a ficha (nome, endereço salvo, últimos 3 pedidos) e
  **cumprimenta pelo nome** ("Boa tarde, Carlos! 😊"); no delivery, oferece entregar no endereço
  salvo (sempre confirmando antes). Nunca recita o histórico.
- **Endereço obrigatório no delivery**: o robô não fecha pedido sem **rua + número + bairro/ponto
  de referência** — pergunta o que faltar antes de confirmar.
- **Comanda térmica 80mm**: botão 🖨️ em cada pedido da aba Pedidos (endereço em destaque com
  borda, fonte grande) + **"Impressão automática"** (toggle POR APARELHO, via localStorage):
  pedido novo já abre o diálogo de impressão com a comanda pronta — deixar o painel aberto no
  computador da térmica e a térmica como impressora padrão. Impressão 100% silenciosa (sem
  diálogo) exige agente local — anotado como evolução futura.
- **Badge no menu**: o item Atendimento mostra o nº de pedidos "anotada" ainda não tratados
  (da loja atual; atualiza a cada 60s).
- **Anti-duplicata**: se a IA marcar o mesmo produto na mesma conversa em 15 min (cliente
  confirmou 2×), não anota em dobro — e não dispara aviso/pedido automático de novo.
- **Pedido automático** (toggle "Virar pedido automaticamente" por número, na aba Robô — pensado
  p/ delivery): o pedido anotado já vira **encomenda oficial** (entrega hoje, valor em aberto,
  observação com endereço/quantidade) e a anotação linka nela. Padrão: desligado.
- **Resumo do período** na aba Pedidos: total, por canal, aguardando e "viraram pedido".
- Validado E2E: pedido → cliente Carlos cadastrado + encomenda #17 automática num tiro só;
  "boa tarde" seguinte respondido com **"Boa tarde, Carlos!"**; toggle da UI desligou o auto e o
  pedido seguinte ficou "anotada" alimentando o badge ①. Tudo revertido. 96 testes ✅.

### Atendimento — aba Pedidos (controle diário) + aviso à equipe no WhatsApp
> A Natali acompanha o que o robô anotou SEM abrir conversa por conversa; e a equipe pode ser
> avisada na hora que cai pedido. Migration `20260706000001` **APLICADA**.
- **Abas no Atendimento**: `Conversas | Pedidos | Robô`.
- **Aba Pedidos** (visão consolidada por loja): tudo que o robô anotou, com filtro por **canal**
  (Encomendas/Delivery), **status** (anotada/confirmada/virou pedido) e **dia** (padrão hoje;
  botão "Todos os dias" para o histórico). Cada linha mostra produto, quantidade, cliente,
  WhatsApp, endereço (delivery) ou texto de retirada (encomendas) e hora — com as ações
  **Confirmada**, **Virar pedido** e atalho para **abrir a conversa completa**. Auto-atualiza a
  cada 30s.
- **Aviso à equipe**: quando o robô anota um pedido, pode mandar um resumo no WhatsApp de um
  número interno ("🛵 PEDIDO DE DELIVERY — Morada do Sol / Entregar em: ... / Cliente: ...").
  **Liga/desliga POR NÚMERO** (por loja e por canal) na aba **Robô** — dá pra deixar o delivery
  avisando e encomendas só na tela. Padrão: desligado. Falha no aviso nunca derruba o
  atendimento (o pedido continua no painel). ⚠️ Janela de 24h da Meta: o número da equipe deve
  falar com o robô de vez em quando (dica exibida na própria tela).
- **Aba Robô**: cadastro dos números (loja + canal + Phone Number ID da Meta), ativar/desativar
  e configuração do aviso — sai o SQL manual da Fase 2.
- Backend: `listarPedidos`, `listarCanais`, `salvarCanal` (admin da tela atendimento);
  `avisarEquipe` no webhook; `formatarAvisoPedido` puro com testes (94 testes ✅).
- `VirarPedidoModal` extraído para componente compartilhado (Conversas + Pedidos).

### Produtos — canais de venda visíveis na lista + marcação em lote
> Para a Natali marcar os produtos "de encomenda" sem abrir um por um.
- **Chips D / E em cada linha** da lista de Produtos: mostram em quais canais o robô vende o
  produto (D = Delivery azul, E = Encomendas laranja) e **clicar liga/desliga** o canal na hora.
- **Botão "Canais em lote"**: entra num modo de seleção (clique nas linhas, "Todos"/"Nenhum") com
  barra de ações — Encomendas: Vender/Não vender · Delivery: Vender/Não vender — aplicadas a todos
  os selecionados de uma vez, com feedback ("N produtos atualizados").
- Backend: `setProdutoCanaisLote(ids, patch)` com checagem de permissão **por loja** (1× por
  unidade presente no lote; informa quantos ficaram de fora por falta de permissão).
- Validado end-to-end no preview (chip individual + lote nos 2 produtos da Morada, revertido).

### Módulo Atendimento — Fases 2 e 3: motor + painel, com canais Encomendas × Delivery
> Requisito da Natali: **Encomendas** é um número de WhatsApp (produtos específicos, retirada com
> data/horário) e **Delivery** é outro (praticamente todos os produtos, pediu → já entrega).
> Tudo separado por unidade. Migration `20260706000000` **APLICADA**.
- **Canais**: tabela `atendimento_canal` mapeia cada `phone_number_id` da Meta → (unidade, canal);
  o webhook resolve de qual loja/canal a mensagem veio. Número de teste da Meta já semeado como
  Encomendas/Morada do Sol. Produto ganhou `vende_delivery` (padrão sim) e `vende_encomenda`
  (padrão não) — **checkboxes "Canais de venda" no drawer do produto**. Conversa única por
  (unidade, canal, número); pedido anotado ganhou `canal` e `endereco`.
- **Motor no Fornada** (`lib/atendimento/*` + `POST /api/atendimento/webhook`): porta o agente do
  projeto agente-whatsapp — Groq llama-3.3-70b com tool use (consultar_produtos agora consulta o
  banco DIRETO, filtrado por loja+canal), transcrição de áudio (Whisper), fotos via `#FOTO#`,
  pedidos via `#ENCOMENDA#` (com endereço no delivery). **Memória de conversa saiu do Redis** →
  tabelas `atendimento_conversa`/`atendimento_mensagem` (contexto 24h/20 msgs). `after()` do
  Next 16 no lugar do waitUntil. Prompt por canal (encomendas pede data+horário de retirada;
  delivery pede endereço). Proxy libera o webhook (Meta chama sem sessão).
- **Robustez da IA**: busca de produto **ignora acento** ("pao" acha "Pão"); retry no
  `tool_use_failed` do Groq (quirk do llama) com fallback sem ferramentas; sanitização de
  vazamento `<function=...>` no texto (cliente nunca vê código). Testes unitários dos marcadores,
  disponibilidade por canal e sanitização (92 testes ✅).
- **Painel `/dashboard/atendimento`** (tela RBAC `atendimento`, entrada no menu Vendas): conversas
  por unidade com filtro por canal, badge Robô/Humano, **assumir/devolver** (robô fica mudo 1h,
  renova a cada resposta do humano), **responder pelo painel** (envia no WhatsApp pelo número do
  canal), pedidos anotados destacados com **"Confirmada"** e **"Virar pedido"** (modal completa
  data/hora → cria encomenda oficial sem valor no módulo de Encomendas, com contato e origem;
  anotação vira `virou_pedido` com link).
- **Envs**: WHATSAPP_TOKEN, PHONE_NUMBER_ID, VERIFY_TOKEN e GROQ_API_KEY copiadas para o
  `.env.local` e adicionadas na **Vercel (production+preview)**. Falta só apontar o webhook da
  Meta para `https://fornada.vercel.app/api/atendimento/webhook` após o deploy.
- Validado end-to-end no preview: webhook verificado (GET 200/403), conversa de encomenda com
  preço por kg + anotação completa, conversa de delivery com endereço, painel com
  assumir/virar pedido (encomenda #16 criada e removida no teste). Dados e usuário QA limpos.

### Módulo Atendimento (agente WhatsApp) — Fase 1: fundação
> Carta de passagem do projeto agente-whatsapp: o robô de WhatsApp vira módulo do Fornada.
> Fase 1 = campos no produto + tabelas do módulo + permissão RBAC. Migration `20260705000000` **APLICADA** no Supabase.
- **Campos novos no `produto`** para o agente vender melhor: `sempre_disponivel` (produto "de sempre",
  ex. pão francês), `disponivel_hoje` (toggle diário tem/acabou; NULL = não informado → agente confirma
  com a equipe), `foto_url` (foto que o agente envia no WhatsApp) e `sugestao_do_dia` (⭐ o agente só
  oferece produtos marcados).
- **Tela de Produtos**: botão **tem/acabou hoje** e **estrela de sugestão do dia** em cada linha
  (pedido da Natali: uma pessoa marca/desmarca por dia); thumbnail da foto no lugar do ícone.
- **Drawer do produto**: seção "Atendimento — robô do WhatsApp" com **upload de foto**
  (bucket público `produto-fotos` no Storage, JPG/PNG/WebP até 5 MB, troca/remoção),
  toggle "Sempre disponível", disponibilidade de hoje e sugestão do dia.
- **Tabelas do módulo** (com `empresa_id`/`unidade_id` + RLS por loja): `atendimento_conversa`
  (1 por número/loja, `pausada_ate` = humano assumiu), `atendimento_mensagem` (histórico) e
  `atendimento_encomenda` (anotada→confirmada→virou_pedido, liga em `encomenda_id`).
- **RBAC**: nova tela `atendimento` (aparece na grade de permissões; página vem na Fase 3).
- Backend: `app/actions/produto-atendimento.ts` (`setProdutoAtendimento`, `uploadProdutoFoto`,
  `removeProdutoFoto`) com checagem de permissão por loja. `bodySizeLimit: 8mb` p/ upload.
- **Fix (bug pré-existente!)**: triggers `trg_produto_updated_at` e `trg_despesa_fixa_updated_at`
  setavam `NEW.atualizado_em` em tabelas cuja coluna é `updated_at` → **todo UPDATE direto em
  `produto` e `despesa_fixa_empresa` falhava** com 42703 (afetava `setProdutoLocal`,
  `linkProdutoReceita` e edição de despesa fixa; a UI otimista escondia). Migration
  `20260705000001` cria `fn_set_updated_at()` e recria os triggers — **APLICADA**.
- Infra: histórico de migrations do Supabase CLI **reparado** (`migration repair` das 23 já aplicadas
  manualmente) — de agora em diante `supabase db push` aplica só o que falta.

### Ficha — editar/excluir item visível no tablet
> No tablet a **tabela** de ingredientes era larga demais e a coluna de ações ficava **cortada** pelo
> `overflow-hidden` do card — parecia que não dava pra editar/excluir. Agora telas até `lg` usam o
> **layout de cards** (ações sempre visíveis) e a tabela só aparece em telas largas.
- Botões **"Editar"** (rotulado) e **excluir** (com **confirmação** antes de apagar) claros e com bom
  alvo de toque, em cada ingrediente. Fim do apagar acidental.

### Resumo e Painel — mais profissionais e organizados
- **Resumo** (panorama equilibrado): seções com título — **Panorama** (contagens), **Encomendas próximas**
  (entregas pendentes com data/hora/status/valor + atalho "ver todas"), **Precisa de atenção**, **Onde está
  o custo** e **Últimas fichas**. Layout mais largo e cartões em 4 colunas em telas grandes.
- **Painel**: mesmos widgets, agora agrupados em seções com cabeçalho (**Metas e equilíbrio**, **Alertas**,
  **Análise de margem**, **Custos fixos e precificação**) — fim do "tudo jogado".
- Fix: KPIs **Valor do Portfólio** e **Custo Total** agora somam **por kg** (antes davam `R$ 0,01`); e a
  **margem ponderada** usava fórmula errada (mostrava ~0%/valor em R$) — agora é `SOMA(pv−ct)/SOMA(pv)`
  corretamente em %. Drawer dos KPIs também por kg.


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
