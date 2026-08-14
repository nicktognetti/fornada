# RFC: Estoque e consumo real de insumo

- **Status:** rascunho / em validação
- **Data:** 2026-08-14
- **Autor:** Nicholas (+ Claude)
- **Decisão depende de:** **Natali** — só ela pode dizer quanta disciplina diária a
  padaria aguenta. Não é decisão técnica.

> Primeiro RFC do Fornada. Escrito porque este é o único item do roadmap que **muda a
> rotina de quem trabalha na loja** — todo o resto foi entregue sem precisar do "sim"
> de ninguém. O projeto está em pausa (nasceu a Serena, 07/2026); este documento existe
> para a pergunta chegar íntegra do outro lado da pausa.

---

## 1. Problema

**O estoque do sistema hoje é um número errado que ninguém vê.**

Medido em 14/08/2026, no banco de produção:

| Fato | Número |
|---|---|
| Escritas em `insumo_saldo` | **1 origem só** — a RPC `confirmar_recebimento` de transferência entre lojas |
| Baixas por produção ou venda | **0** — não existe nenhuma |
| Entradas por compra | **0** — a compra não alimenta saldo |
| Telas que leem `insumo_saldo` | **0** — nenhuma |
| Linhas em `insumo_saldo` | **0** |

Ou seja: o saldo é *write-only*, alimentado por **uma** das três fontes que deveria ter,
e por isso **já nasce errado**. Foi por isso que não construí a "tela de estoque" do
roadmap em 03/08 — mostrar estoque errado para a dona da padaria é pior do que não
mostrar nada, porque ela compraria (ou deixaria de comprar) em cima de dado falso.

**O que já foi resolvido e não é problema:** o **custo** do insumo. Desde 03/08 a compra
aceita itens e reajusta o custo com o preço realmente pago
(`20260803020000_compra_itens_e_rls.sql`). Custo real ≠ estoque real — são coisas
diferentes, e só a primeira está de pé.

**Consequência prática:** sem consumo, não existe **margem real** — o Painel continua
mostrando "faturamento estimado" (soma do catálogo), que o próprio código admite não ser
faturamento (`app/actions/painel.ts:40`).

## 2. Proposta

**Não decidir pela Natali.** Este RFC não propõe uma implementação: propõe **escolher
entre quatro modelos** que custam rotinas muito diferentes para a loja. A recomendação
técnica está no §3 (alternativa C), mas o martelo é dela.

O que é comum a qualquer opção escolhida:

- Compra passa a **creditar** `insumo_saldo` (hoje não credita) — o item já está ligado
  ao insumo desde 03/08, falta só somar.
- Existe uma tela de estoque **honesta**: mostra saldo, data da última conferência e
  deixa explícito o que o número cobre e o que não cobre.
- Toda baixa vira linha em `insumo_saldo_historico` (a tabela já existe e já é imutável).

**Fora de escopo deste RFC:** margem real e curva ABC por venda. Ambas dependem de
**volume de venda**, que é outra pergunta (PDV/caixa), não de estoque.

## 3. Alternativas consideradas

### A) Registro de produção diário
Alguém lança "hoje fiz 12 kg de pão de queijo". O sistema explode a ficha técnica e
debita cada insumo.
- ✅ Mais preciso; dá consumo por produto e alerta de "vai faltar farinha".
- ❌ **Exige disciplina diária de quem está com a mão na massa.** Um dia sem lançar e o
  saldo descola; três dias e ninguém confia mais no número.
- ❌ Não cobre perda, quebra e consumo interno.

### B) Baixa automática pela encomenda
Quando a encomenda vira "pronto", debita a ficha dos itens.
- ✅ **Custo zero de rotina** — aproveita um clique que já existe.
- ❌ **Cobre só encomenda.** Numa padaria, o balcão é provavelmente a maior fatia do
  volume — o saldo ficaria sistematicamente otimista, e errado de um jeito silencioso.
  É o pior tipo de erro: parece que funciona.

### C) Inventário periódico + entradas por compra  ⭐ recomendação técnica
Sem lançamento diário. A cada semana (ou mês), alguém **conta** o que tem e o sistema
registra a contagem. O consumo do período sai da conta:
`consumo = saldo anterior + compras do período − contagem atual`.
- ✅ **Uma rotina por semana, não por dia** — cabe numa padaria de verdade.
- ✅ O número é **medido**, não inferido: absorve perda, quebra e consumo interno sem
  precisar que alguém registre cada um.
- ✅ Dá consumo real por período → custo real de insumo por semana, que é o que
  interessa para negociar com fornecedor.
- ❌ Não dá saldo em tempo real nem alerta "acabou agora".
- ❌ Consumo é por insumo, não por produto (não responde "quanto de farinha foi para o
  pão × para o bolo").

### D) Não fazer estoque
Parar aqui: custo real via compra (já pronto) e nada de saldo.
- ✅ Zero rotina nova. Honesto: não promete o que não entrega.
- ❌ Nunca haverá alerta de ruptura nem consumo real.
- **Só é derrotado se a Natali disser que quer estoque.** Se a resposta dela for
  "não tenho gente para isso", **D é a resposta certa** — e aí a gente apaga o
  `insumo_saldo` em vez de deixar um número errado no banco.

## 4. Riscos / trade-offs

| Risco | Mitigação / decisão |
|---|---|
| **Adotar A e a rotina não pegar.** O saldo descola, alguém compra errado confiando nele. | Não implantar A sem a Natali dizer *quem* lança e *quando*. Se não houver resposta clara, é sinal de que A não é a opção. |
| **Escolher B por ser grátis.** Erro silencioso: número parece certo e não é. | B só entra combinado com C (contagem corrige a deriva). Sozinho, não. |
| Saldo negativo (baixa maior que o saldo). | Permitir negativo e **sinalizar** — bloquear trava a operação da loja por um erro de digitação. Negativo é sintoma, não crime. |
| Migração de schema em produção. | `insumo_saldo` e `insumo_saldo_historico` **já existem** e estão vazios (0 linhas). Começar do zero, sem migrar nada. |
| Mexer nisso com a loja em operação. | O projeto está pausado. Implantar só depois de a Natali estar usando o básico (encomenda + plano de produção) — não antes. |

## 5. Em aberto (o que trava a decisão)

Tudo aqui é para a **Natali**:

- [ ] **Você quer controle de estoque de verdade, ou saber o custo já resolve?**
      (Se custo resolve → alternativa D, e a gente encerra o assunto.)
- [ ] **Quem contaria/lançaria, e com que frequência?** Nome de pessoa e dia da semana.
      Sem isso, qualquer opção vira promessa vazia.
- [ ] **A dor é "faltou insumo no meio da produção" ou "não sei quanto gastei no mês"?**
      A primeira pede A; a segunda pede C.
- [ ] **Balcão é quanto do volume, comparado a encomenda?** Se encomenda for a maior
      parte, B fica viável; se for balcão, B está descartado.
- [ ] Contagem seria de **todos** os ~193 insumos ou só dos principais (farinha, açúcar,
      manteiga, chocolate)? Contagem parcial é muito mais realista.

## 6. Como destravar (próximo passo concreto)

**Uma conversa de 15 minutos com a Natali, sem tela e sem jargão.** Três perguntas:

1. "Você quer saber quanto tem de farinha agora, ou quanto de farinha você gastou no mês?"
2. "Quem poderia contar os principais insumos uma vez por semana?"
3. "O que já te fez perder venda: faltar insumo, ou não saber o custo?"

As respostas escolhem sozinhas entre A, C e D. **Não codar nada antes disso.**

## 7. Decisão

_(pendente — o §5 é todo com a Natali, e o projeto está em pausa desde 07/2026)_

---

### Anexo — estado do que já existe (14/08/2026)

| Peça | Situação |
|---|---|
| `insumo_saldo`, `insumo_saldo_historico` | Criadas, RLS por empresa, **0 linhas** |
| Entrada por transferência | ✅ funciona (RPC `confirmar_recebimento`) |
| Entrada por compra | ❌ não credita saldo (item↔insumo já ligado desde 03/08) |
| Baixa por produção/venda | ❌ não existe |
| Tela de estoque | ❌ não existe (deliberado) |
| Custo real do insumo | ✅ resolvido — reajuste pela compra |
| Explosão de ficha (para debitar) | ✅ lógica já existe em `vw_custo_receita` / `receita_item` |
