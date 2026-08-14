# RFC: <título curto do que se quer fazer>

- **Status:** rascunho / em validação / decidido / implementado
- **Data:** AAAA-MM-DD
- **Autor:** Nicholas (+ Claude)
- **Decisão depende de:** <quem/o quê precisa responder antes de bater o martelo>

> Copie este arquivo para `docs/RFC-<assunto>.md` e preencha. Escreva ANTES de codar.
> Quando implementar, mude o Status e deixe o RFC como registro (vira o "porquê").

---

## 1. Problema
O que dói hoje. Com **número** sempre que der (medição, contagem, %). Sem "achismo".

## 2. Proposta
O que vou fazer, concreto. Se for código: qual script/rota/tabela, e o comportamento.
Deixe claro o **escopo** — e principalmente o que está **FORA** de escopo.

## 3. Alternativas consideradas
As opções que descartei e **por quê**. (É aqui que metade dos erros de design morre.)

## 4. Riscos / trade-offs
O que pode dar errado, mudança de comportamento silenciosa, dado que se perde, custo em
produção. Para cada risco, a mitigação ou a decisão proposta.

## 5. Em aberto (o que trava a decisão)
Perguntas ainda sem resposta — e **para quem** (a descoberta técnica, o Nicholas, o
faturamento, o Samuel, o Rodrigo…). Use checkboxes.
- [ ] ...

## 6. Como destravar (próximo passo concreto)
O que precisa acontecer pra sair do "em aberto". Um passo objetivo.

## 7. Decisão
_(pendente — preencher quando o §5 estiver respondido e o martelo bater)_

---

### Quando usar RFC (e quando não)
| Escreve RFC | Só faz |
|---|---|
| Caro de desfazer / mexe em produção | Fix pequeno e óbvio |
| Depende do "sim" de gente do negócio | Ajuste de UI, cor, texto, filtro |
| Migração de schema, régua, integração nova | Quick-win reversível |
