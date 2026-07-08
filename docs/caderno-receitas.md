# Módulo Caderno de Receitas 🍞📖

> Guia do módulo para operação e revisão. Construído em 08/07/2026 a pedido da Natali
> (o "caderno de receitas" da confeitaria dentro do sistema). Detalhe técnico por
> mudança: `CHANGELOG.md`.

## A ideia em uma frase

A mesma receita, **duas portas**: a **Ficha Técnica** é da Natali/gestão (custo, margem,
preço) e o **Caderno de Receitas** é da produção/confeitaria (foto, ingredientes e o
passo a passo pra seguir na bancada — **sem nenhum número de custo**).

## Por que duas telas e não uma

São dois públicos com duas cabeças diferentes:

| | **Fichas Técnicas** | **Caderno de Receitas** |
|---|---|---|
| Quem usa | Natali / gestão | Produção / confeitaria |
| Menu | "Fichas" | "Caderno" |
| Enxerga | Custo, margem, ingredientes | Foto, ingredientes, passos |
| Custo aparece? | Sim | **Nunca** |
| Permissão (RBAC) | `receitas` | `caderno` |

**A receita é uma só** (tabela `receita`). Você cadastra/edita num lugar e reflete no
outro — nada é duplicado. Quem só tem `caderno` no menu vê apenas o Caderno; tentar abrir
as Fichas pela URL é barrado pelo guard de rota.

## O ciclo completo (os dois sentidos)

```
Natali cria a Ficha (ingredientes + custo)
        │
        ▼
Produção abre no Caderno e escreve o "modo de fazer" (passos, tempos, foto, dica)

─────────────────────  E no sentido inverso  ─────────────────────

Produção clica "Nova Receita" no Caderno
        │  (nome, rendimento, passos, tempos, dica)
        ▼
Adiciona os ingredientes (do catálogo de insumos, sem ver custo)
        │
        ▼
A receita aparece nas FICHAS da Natali, já com custo calculado
        │  🔔 avisa a Natali (badge no menu + tag + banner)
        ▼
Natali confere ingredientes, define o preço e clica "Marcar como revisada"
        │
        ▼
O aviso some — receita revisada e precificada
```

## As telas

### `Caderno → catálogo`
Grade de cards com **foto** (ou o logo da Flor do Trigo quando não tem foto) e busca.
Quem pode editar vê o botão **"Nova Receita"**. Cada card abre a receita.

### `Caderno → receita`
A página da receita para a produção: foto, tempos (preparo/forno/dificuldade),
**ingredientes** (quantidade + nome, **sem custo**), **modo de preparo** (passos numerados)
e o botão **Modo Cozinha**. Com permissão de edição aparecem:
- **Adicionar / editar / remover ingredientes** (reusa o seletor de insumos das Fichas).
- **Editar modo de fazer** (passos, tempos, dificuldade, dica) + trocar a foto.

Toda vez que a produção mexe nos ingredientes, a receita volta a marcar **revisão
pendente** pra Natali reconferir (mexer só no passo a passo NÃO dispara aviso — não muda custo).

### `Caderno → receita → Modo Cozinha`
A tela de bancada: letra grande, **ingredientes e passos que se riscam ao tocar**, foto e
tempos em destaque, contador de progresso. Ideal pro tablet/celular na produção. "Recomeçar"
limpa as marcações. **Zero custo** aqui.

### `Fichas Técnicas` (lado da Natali)
Tudo como antes (custo, ingredientes, precificação, impressão), agora com:
- A ficha ganhou **modo de preparo, tempos, foto e dica** (o mesmo "modo de fazer" do Caderno).
- **Aviso de receita nova da produção:** badge com o número no menu **"Fichas"**, as receitas
  pendentes sobem pro **topo da lista** com a tag **"NOVA · REVISAR"**, e a ficha mostra um
  **banner** + botão **"Marcar como revisada"** (dá baixa no aviso quando ela precifica).

## Como a Natali libera pra produção

Na tela **Configurações → Permissões**, conceder a tela **"Caderno de Receitas"** aos
usuários da produção/confeitaria (na loja certa). Assim eles logam e veem **só o Caderno** —
criam e seguem receita sem nunca ver custo/preço. Quem tem **"Fichas Técnicas"** precifica.
(Admin global vê as duas.)

## Detalhes que valem saber

- **Foto:** JPG/PNG/WebP até 5 MB, no bucket público `receita-fotos` (mesmo desenho da foto
  de produto). Sem foto, mostra o logo da Flor do Trigo esmaecido.
- **Badge do menu Fichas:** atualiza a cada ~60s (não é instantâneo ao "Marcar como revisada" —
  o banner e a tag somem na hora, o número no menu acompanha no próximo ciclo).
- **Nomes de insumo são técnicos** (ex.: "ACUCAR CRISTAL SANTA ISABEL 6X5 FD 30KG") — a produção
  precisa achar o certo ao montar os ingredientes. É a mesma base das Fichas; limpar esses nomes
  um dia melhora pros dois lados.
- **Uma fonte de verdade:** ingredientes sempre ligados ao insumo (custo sempre calculável);
  não existe "receita solta" sem vínculo.

## Referência técnica (para o dev)

- **Banco:** colunas em `receita` — `passos` (JSONB), `tempo_preparo_min`, `temperatura_forno`,
  `tempo_forno_min`, `dificuldade`, `foto_url` (migration `20260708000000_receita_caderno`) e
  `revisao_pendente` (migration `20260708120000_receita_revisao`). Bucket `receita-fotos`.
- **RBAC:** tela `caderno` registrada em `app/lib/permissions.ts` (`TELAS`/`TELA_LABEL`),
  `app/components/sidebar.tsx` (item + badge) e `proxy.ts` (`telaParaRota`).
- **Rotas:** `app/dashboard/caderno/{page, [id]/page, [id]/cozinha/page}` + `components/`
  (`caderno-catalogo`, `caderno-receita-view`, `nova-receita-modal`, `modo-preparo-modal`).
  O checklist de bancada reusa `receitas/[id]/cozinha/cozinha-view.tsx`.
- **Actions** (em `app/dashboard/receitas/actions.ts`): `createReceitaCaderno`,
  `updateModoPreparo`, `uploadReceitaFoto`/`removeReceitaFoto`, `marcarReceitaRevisada`,
  `contarReceitasPendentes`; as actions de item (`addItem`/`addItensLote`/`updateItem`/
  `removeItem`) aceitam permissão `caderno` e chamam `flagRevisaoSeProducao`.
- **Reuso:** `PassosEditor` (editor de passos), `ItemModal` (seletor de insumos, sem custo),
  `LogoPlaceholder` (placeholder com o logo).
