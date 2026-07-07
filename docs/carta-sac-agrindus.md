# 🥛 Carta de passagem: agente WhatsApp para o SAC da Agrindus

> **Para a sessão do Claude no projeto SAC da Agrindus**
> (`C:\Projetos IA - Nicholas Tognetti\Sac - Agrindus SA`). O robô de WhatsApp
> da Padaria Flor do Trigo (projeto Fornada) está maduro, testado e em produção —
> e o motor foi desenhado para ser portado. Esta carta diz o que copiar, o que
> trocar e as armadilhas que já custaram horas. Decisão do Nicholas (jul/2026):
> adicionar um canal de **atendimento ao consumidor final** via WhatsApp
> (reclamações/dúvidas sobre produtos — SEM delivery/encomendas).
>
> Código-fonte de referência:
> `C:\Projetos IA - Nicholas Tognetti\Fornada - Flor do Trigo\fornada`
> Guia do módulo original: `docs/atendimento.md` (mesmo repo).

## ⚠️ Reconhecimento do terreno (feito em 07/07 pela sessão do Fornada)

O projeto SAC **não é um SAC de consumidor hoje** — é o sistema INTERNO de
ocorrências/OS da Agrindus (manutenção, RH, TI...), com:
- **Backend Python 3.14 + FastAPI + SQLAlchemy 2.0 async + Supabase Postgres**
  (deploy Render) — o motor do Fornada é TypeScript, então aqui é **portar a
  LÓGICA, não copiar arquivos**: as chamadas são todas HTTP puras (Meta Graph,
  Groq OpenAI-compatible), reescrevem direto em `httpx`; assinatura é `hmac` da
  stdlib; memória vira modelos SQLAlchemy.
- **Frontend Next.js 16 + React 19 + Tailwind v4** — MESMA stack do painel do
  Fornada: a página de Atendimento (conversas/chamados) porta quase 1:1.
- **Sistema de tickets pronto e rico**: `Ticket` com status/prioridade,
  categorias dinâmicas com **campos customizados** (`dados_extras` JSONB),
  comentários, histórico e **notificações internas** já existentes.

O encaixe de ouro: `#CHAMADO#` do robô **cria um Ticket de verdade** —
- categoria nova "SAC Consumidor" com campos customizados (produto, lote,
  validade, onde comprou) caindo em `dados_extras`;
- `aberto_por` = um usuário-robô de serviço (criar `robo@agrindus...`);
- o fluxo de supervisores/notificações do sistema cuida do resto sozinho.
O consumidor NÃO é `usuarios` (que é interno) — criar tabela leve
`sac_cliente` (telefone, nome, observação) no padrão do `cliente.ts` daqui.

Fases sugeridas: **1)** modelos + webhook + IA respondendo (modo recepcionista);
**2)** `#CHAMADO#` → Ticket + página de conversas no frontend; **3)** blindagem
(assinatura, anti-abuso, alertas) + infos oficiais editáveis. Webhook público =
URL do Render (`/webhook/whatsapp`); atenção ao rate limiter existente
(`app/limiter.py`) para não bloquear a Meta.

## O que o motor já resolve (copiar quase como está, de `lib/atendimento/`)

| Peça | Arquivo | Nota |
|---|---|---|
| Webhook Meta (GET verificação + POST, corpo cru) | `app/api/atendimento/webhook/route.ts` | usa `after()` do next/server |
| Validação de assinatura da Meta | `assinatura.ts` (+ teste) | HMAC do corpo CRU; env `META_APP_SECRET` |
| Envio (texto, imagem, template, mídia) | `whatsapp.ts` | token no env, phone_number_id por canal |
| Memória de conversa em Postgres + pausa (humano assume) | `memoria.ts` | contexto 24h/20 msgs; `pausada_ate` |
| Anti-abuso (6/min, 40/h por conversa) | `memoria.ts` + webhook | excedente salva e silencia |
| IA Groq llama-3.3-70b com tool use + retries | `ia.ts` | trata `tool_use_failed` (quirk do llama) |
| Marcações internas + sanitização | `marcadores.ts` (+ testes) | `#ENCOMENDA#`→ vira `#CHAMADO#` no SAC |
| Ficha do cliente que volta (cumprimenta pelo nome) | `cliente.ts`, `ficha-texto.ts` | liga telefone ao cadastro |
| Infos oficiais no prompt (horários etc., editável em tela) | `info-loja.ts`, `info-texto.ts` | + `blocoAgora()` p/ fora do expediente |
| Alerta de pane no WhatsApp do admin | `alerta.ts` | env `ALERTA_WHATSAPP`, trava 30min |
| Aviso de evento novo à equipe (livre ou template) | `aviso.ts`, `aviso-texto.ts` | template fura a janela de 24h |
| Painel (conversas, assumir/devolver, responder) | `app/dashboard/atendimento/` | adaptar visual ao SAC |
| Resolução de número → contexto | `canal.ts` | ver "canais" abaixo |

Transcrição de áudio (Whisper via Groq) já embutida em `ia.ts`. Migrations com o
schema das tabelas: `supabase/migrations/2026070[567]*` (padrão RLS se o SAC usar
Supabase; senão, portar o schema pro banco de lá).

## O que TROCAR para virar SAC

1. **Domínio**: `atendimento_encomenda` → `sac_chamado` (protocolo sequencial,
   categoria: reclamação/dúvida/elogio, produto, lote/validade, status
   aberto→em_tratamento→resolvido). A marcação vira
   `#CHAMADO# {"categoria":"...","produto":"...","lote":"...","relato":"...","nome":"..."}`
   — o parser de `marcadores.ts` é a referência (linha limpa, JSON tolerante,
   anti-duplicata por janela).
2. **Prompt** (`prompt.ts`): personalidade SAC Agrindus — acolher, NUNCA admitir
   culpa nem prometer reembolso/troca (só a equipe), colher produto + lote +
   validade + onde comprou + foto se possível, gerar protocolo, prometer retorno.
   Manter a REGRA DE OURO (só informa o que está no documento/ferramentas) e as
   infos oficiais editáveis (telefones, horários do SAC, site).
3. **Ferramentas da IA**: `consultar_produtos` aponta pro catálogo da Agrindus
   (ou vira `consultar_produto_info` com dados nutricionais/linha); nova tool
   `consultar_chamado(protocolo)` p/ cliente perguntar andamento.
4. **Canais**: aqui eram `encomendas|delivery` por loja; no SAC basta UM canal
   (`sac`) — simplificar `atendimento_canal` (ou manter a tabela e usar um único
   registro; o CHECK do canal muda).
5. **Painel**: aba "Pedidos" vira "Chamados" (fila por status/categoria/dia,
   protocolo em destaque, atalho pra conversa). "Virar pedido" vira "Encaminhar/
   Resolver". Relatório: chamados por categoria/dia, tempo até resolução.
6. **Fora**: catálogo por canal, pedido automático, comanda térmica/agente de
   impressão (não fazem sentido em SAC — não copiar).

## Armadilhas que JÁ nos morderam (não repetir)

- **Corpo CRU no webhook**: a assinatura da Meta é HMAC dos bytes originais —
  `request.text()` primeiro, `JSON.parse` depois. `request.json()` quebra a validação.
- **Janela de 24h da Meta**: mensagem livre só chega se o destinatário falou com
  o número nas últimas 24h. Aviso à equipe confiável = **template aprovado**
  (corpo `{{1}}`, parâmetro em LINHA ÚNICA — a Meta rejeita `\n` em parâmetro).
- **llama no Groq**: às vezes erra a sintaxe da tool (`tool_use_failed` 400) e às
  vezes VAZA `<function=...>` no texto — copiar o retry + `limparVazamentoDeFerramenta`.
- **Busca com acento**: `ilike` do Postgres não acha "Pão" com "pao" — copiar o
  fallback de normalização de `catalogo.ts`.
- **Proxy/middleware**: liberar as rotas do webhook para chamadas SEM sessão
  (a Meta não faz login) — cada rota se protege com o próprio token.
- **PowerShell 5.1**: nunca editar arquivo com `Get-Content`/`Set-Content` sem
  `-Encoding` (lê UTF-8 sem BOM como ANSI → mojibake); `"valor" | vercel env add`
  salva VAZIO — usar `cmd /c "type arquivo | vercel env add ..."`; mensagens de
  commit com aspas → usar `git commit -F arquivo`.
- **Instrução suave a IA ignora**: "cumprimente pelo nome" não funcionou; "Este é
  um cliente CONHECIDO: ao cumprimentar, use o nome (ex: ...)" funcionou.
- **Número de teste da Meta** só entrega p/ até 5 números autorizados (erro
  131030) — normal, não é bug. Número real exige Business verificado.

## Envs necessários (mesmos nomes do Fornada)

`WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, `VERIFY_TOKEN`, `GROQ_API_KEY` e os
opcionais `META_APP_SECRET` (assinatura) e `ALERTA_WHATSAPP` (alerta de pane).
A Agrindus precisa do PRÓPRIO app/WABA na Meta (não reaproveitar o da padaria).

## Como validar (receita usada no Fornada)

Simular o webhook com `Invoke-WebRequest` local (payload da Meta com
`metadata.phone_number_id` + `messages[0]`), conferir no banco o que foi salvo,
e testar pelo painel com usuário QA temporário (criar → testar → APAGAR, e
reverter qualquer dado tocado). Casos mínimos: saudação; pergunta fora do escopo
(deve encaminhar); reclamação completa → `#CHAMADO#` com protocolo; cliente que
volta (nome); anti-duplicata; áudio; rate limit; assinatura (401 sem HMAC).
