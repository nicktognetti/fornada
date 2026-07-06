# Módulo Atendimento — Robô do WhatsApp 🥐🤖

> Guia do módulo para revisão e operação. Construído em 05–06/07/2026 a partir da
> "carta de passagem" do projeto agente-whatsapp. Detalhe técnico por mudança: `CHANGELOG.md`.

## A ideia em uma frase

Cada loja tem **dois números de WhatsApp** — **Encomendas** (retirada com data/horário, produtos
específicos) e **Delivery** (pediu → já entrega, quase todos os produtos) — atendidos por um robô
que consulta o catálogo real do Fornada, anota pedidos, e entrega tudo mastigado pra equipe no
painel **Atendimento**.

## Como funciona (fluxo completo)

```
Cliente manda mensagem no WhatsApp
        │
        ▼
Meta chama POST /api/atendimento/webhook
        │  (phone_number_id identifica LOJA + CANAL → atendimento_canal)
        ▼
Robô responde (Groq llama-3.3-70b)
  ├─ consulta produtos da loja/canal (preço por kg, tem/acabou, foto)
  ├─ conhece o cliente que volta (ficha: nome, endereço salvo, últimos pedidos)
  ├─ áudio? transcreve (Whisper) e segue normal
  └─ anota pedido quando fecha (produto, qtd, data/horário OU endereço, nome)
        │
        ▼ (pedido anotado)
  ├─ cadastra/atualiza o CLIENTE (tela Clientes)          [sempre]
  ├─ avisa a equipe no WhatsApp                           [se ligado no canal]
  ├─ vira encomenda oficial automaticamente               [se ligado no canal]
  └─ aparece na aba PEDIDOS + badge no menu               [sempre]
```

## As telas

### `Atendimento → Conversas`
Lista por loja (seletor no topo) com filtro por canal, badge **Robô/Humano** e contador de
pedidos 📝. Abrindo: o chat completo, os pedidos anotados destacados, **Assumir conversa**
(robô fica mudo 1h, renova a cada resposta sua) e caixa de resposta que envia no WhatsApp.

### `Atendimento → Pedidos` (controle do dia a dia)
Tudo que o robô anotou, **sem abrir conversa**: filtros por canal, status e **dia** (abre no
hoje; "Todos os dias" = histórico completo — nada expira). Resumo do período (total, por canal,
aguardando, viraram pedido). Por linha: **🖨️ imprimir comanda 80mm**, **Confirmada**,
**Virar pedido** (completa data/hora e cria a encomenda oficial) e atalho pra conversa.

**Impressão automática** (botão no topo): liga **por aparelho** — no computador da impressora
térmica, deixe o painel aberto e a térmica como impressora padrão; pedido novo já abre o diálogo
com a comanda pronta (endereço em destaque). *Impressão 100% silenciosa exige um agente local —
está no roadmap.*

### `Atendimento → Robô` (configuração)
Cadastro dos números: loja + canal + Phone Number ID (painel da Meta). Por número:
- **Número ativo** — liga/desliga o canal.
- **Avisar equipe no WhatsApp** — pedido novo manda resumo pro número da equipe.
  ⚠️ Janela de 24h da Meta: a equipe deve mandar um "oi" pro robô de vez em quando.
- **Virar pedido automaticamente** — anotou → encomenda oficial na hora (entrega hoje, valor em
  aberto). Pensado pro delivery.

Todos os toggles nascem **desligados**.

### Produtos (o que o robô vende)
Por linha: chips **D**/**E** (em quais canais vende — clique liga/desliga), botão **tem/acabou
hoje** e **⭐ sugestão do dia** (o robô só oferece espontaneamente o que tiver estrela, máx. 1 por
conversa). **"Canais em lote"** marca vários de uma vez. No detalhe do produto: **foto** (o robô
manda no WhatsApp), "Sempre disponível" e o resto.

Padrões: produto novo vende no **Delivery** e NÃO vende por **Encomendas** (marca só os
específicos). Disponibilidade não informada = o robô diz que "confirma com a equipe".

## Guardas de segurança do robô

- **Regra de ouro**: o que não está no prompt nem veio do catálogo, ele NÃO sabe — confirma com
  a equipe. Proibido inventar preço, prazo, taxa, horário.
- Delivery **não fecha sem endereço completo** (rua + número + bairro/referência).
- Cliente confirmou 2×? **Não anota em dobro** (janela de 15 min).
- Busca de produto ignora acento ("pao" acha "Pão"); erros da IA nunca vazam código pro cliente;
  se tudo falhar, o cliente recebe um pedido educado de "tentar de novo" — nunca silêncio.
- RBAC: tela `atendimento` (leitura = ver; escrita = assumir/responder/virar pedido;
  admin = configurar números). RLS por loja em todas as tabelas do módulo.

## Para LIGAR em produção (checklist)

1. ✅ Código na master (deploy automático) + migrations aplicadas + envs na Vercel.
2. 🔲 **Painel da Meta**: trocar a URL do webhook para
   `https://fornada.vercel.app/api/atendimento/webhook` (mesmo VERIFY_TOKEN).
3. 🔲 Número BR de verdade (o atual é o de teste da Meta — só entrega pra números autorizados)
   e um segundo número pro Delivery → cadastrar na aba **Robô**.
4. 🔲 Preencher os dados oficiais no prompt (`lib/atendimento/prompt.ts`): horários, endereços
   das lojas, formas de pagamento, taxa/área de entrega.
5. 🔲 Dar a permissão `atendimento` pra quem vai operar (Configurações → Permissões).

## Roadmap sugerido (não feito)

- **Agente de impressão local** → térmica 100% silenciosa, sem diálogo.
- **UI pros dados do prompt** (horários/endereços/pagamento editáveis em Cadastros, sem mexer em código).
- **Relatório mensal** de atendimento (pedidos por canal/dia, taxa de conversão anotado→pedido).
- **Botão "cadastrar cliente" manual** na conversa + editar endereço salvo pelo painel.
- **Template de WhatsApp aprovado** pro aviso da equipe (elimina a janela de 24h).
- **Som/notificação do navegador** no painel quando cai pedido.

## Mapa técnico (para desenvolvimento)

| Peça | Onde |
|---|---|
| Webhook Meta (GET verificação + POST mensagens) | `app/api/atendimento/webhook/route.ts` |
| IA (Groq + tool use + retry/sanitização) | `lib/atendimento/ia.ts` |
| Prompt por canal + ficha do cliente | `lib/atendimento/prompt.ts`, `ficha-texto.ts` |
| Catálogo (consulta por loja+canal, sem acento) | `lib/atendimento/catalogo.ts`, `disponibilidade.ts` |
| Memória (conversas/mensagens/anotadas, anti-dup) | `lib/atendimento/memoria.ts` |
| Canais (resolução do número) | `lib/atendimento/canal.ts`, `canal-tipos.ts` |
| Cliente (auto-cadastro + ficha) | `lib/atendimento/cliente.ts` |
| Aviso à equipe / pedido automático | `lib/atendimento/aviso.ts`, `pedido-auto.ts` |
| Marcações #ENCOMENDA#/#FOTO# (puras + testes) | `lib/atendimento/marcadores.ts` (+ `.test.ts`) |
| Painel (3 abas) | `app/dashboard/atendimento/` |
| Actions do painel | `app/actions/atendimento.ts` |
| Campos do produto (toggles, foto, canais, lote) | `app/actions/produto-atendimento.ts` |
| Comanda térmica 80mm (iframe) | `app/dashboard/atendimento/components/comanda-impressao.ts` |
| Migrations | `supabase/migrations/2026070[56]*` (todas aplicadas) |
