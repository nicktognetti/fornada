'use client'

import { useState, useMemo } from 'react'
import { Pencil, Package, ShoppingBag, Search, Plus, Star, ListChecks, Check, Loader2 } from 'lucide-react'
import { formatBRL, formatCustoGrande, valorPorGrande, unidadeGrande } from '@/lib/format'
import { setProdutoLocal, type ProdutoFinanceiro } from '@/app/actions/painel'
import { setProdutoAtendimento, setProdutoCanaisLote, type ProdutoAtendimento } from '@/app/actions/produto-atendimento'
import { NovoProdutoModal, type FichaOpcao } from './novo-produto-modal'
import { ProdutoDetalheDrawer } from '@/app/components/produto-detalhe-drawer'
import { DocumentoImpressao, BotaoImprimir, tabelaImpressao as T } from '@/app/components/ui/documento-impressao'
import { LogoPlaceholder } from '@/app/components/ui/logo-placeholder'

interface Props {
  produtos: ProdutoFinanceiro[]
  unidades: { id: string; nome: string }[]
  unidadeAtual: string | null
  receitas: FichaOpcao[]
  locais: string[]
  localMap: Record<string, string | null>
  /** Campos do agente WhatsApp por produto. Vazio = migration ainda não aplicada (esconde os controles). */
  atendimentoMap: Record<string, ProdutoAtendimento>
  /** false = operação (só tem/acabou, robô etc.): custo/preço/margem somem da tela e da impressão. */
  podeVerValores: boolean
}

const TIPO_CONFIG = {
  produzido: { icon: Package, label: 'Fabricado', cls: 'bg-accent-primary/15 text-accent-primary border-accent-primary/20' },
  revenda:   { icon: ShoppingBag, label: 'Revenda',   cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
}

export function ProdutoList({ produtos, unidades, unidadeAtual, receitas, locais, localMap, atendimentoMap, podeVerValores }: Props) {
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'produzido' | 'revenda'>('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [detalheId, setDetalheId] = useState<string | null>(null)
  // Edições otimistas locais: só o que o usuário mexeu AQUI. O resto segue sempre
  // os props frescos do server (revalidação). O mapa efetivo é derivado no render —
  // sem effect de sync (e itens não editados deixam de ficar stale).
  const [localOverrides, setLocalOverrides] = useState<Record<string, string | null>>({})
  const [atdOverrides, setAtdOverrides] = useState<Record<string, ProdutoAtendimento>>({})
  const locaisMap = useMemo(() => ({ ...localMap, ...localOverrides }), [localMap, localOverrides])
  const atdMap = useMemo(() => ({ ...atendimentoMap, ...atdOverrides }), [atendimentoMap, atdOverrides])
  // Modo "canais em lote": seleciona vários produtos e marca/desmarca
  // Delivery/Encomendas de uma vez (pedido da Natali)
  const [loteMode, setLoteMode] = useState(false)
  const [selIds, setSelIds] = useState<Set<string>>(new Set())
  const [loteMsg, setLoteMsg] = useState<string | null>(null)
  const [aplicandoLote, setAplicandoLote] = useState(false)

  async function mudarLocal(produtoId: string, local: string) {
    setLocalOverrides((m) => ({ ...m, [produtoId]: local || null }))
    await setProdutoLocal(produtoId, local || null)
  }

  // Toggle diário tem/acabou: "Hoje?" (não informado) → Tem hoje → Acabou → Tem hoje…
  async function mudarDisponibilidade(produtoId: string) {
    const atual = atdMap[produtoId]
    if (!atual || atual.sempre_disponivel) return
    const proximo = atual.disponivel_hoje !== true
    setAtdOverrides((m) => ({ ...m, [produtoId]: { ...atual, disponivel_hoje: proximo } }))
    await setProdutoAtendimento(produtoId, { disponivel_hoje: proximo })
  }

  async function toggleSugestao(produtoId: string) {
    const atual = atdMap[produtoId]
    if (!atual) return
    const proximo = !atual.sugestao_do_dia
    setAtdOverrides((m) => ({ ...m, [produtoId]: { ...atual, sugestao_do_dia: proximo } }))
    await setProdutoAtendimento(produtoId, { sugestao_do_dia: proximo })
  }

  // Chip D/E na linha: liga/desliga o canal de venda deste produto
  async function toggleCanal(produtoId: string, campo: 'vende_delivery' | 'vende_encomenda') {
    const atual = atdMap[produtoId]
    if (!atual) return
    const proximo = !atual[campo]
    setAtdOverrides((m) => ({ ...m, [produtoId]: { ...atual, [campo]: proximo } }))
    await setProdutoAtendimento(produtoId, { [campo]: proximo })
  }

  function toggleSel(produtoId: string) {
    setSelIds((s) => {
      const novo = new Set(s)
      if (novo.has(produtoId)) novo.delete(produtoId)
      else novo.add(produtoId)
      return novo
    })
  }

  async function aplicarLote(patch: { vende_delivery?: boolean; vende_encomenda?: boolean }) {
    if (selIds.size === 0 || aplicandoLote) return
    setAplicandoLote(true)
    setLoteMsg(null)
    const ids = [...selIds]
    setAtdOverrides((o) => {
      const novo = { ...o }
      for (const id of ids) if (atdMap[id]) novo[id] = { ...atdMap[id], ...patch }
      return novo
    })
    const res = await setProdutoCanaisLote(ids, patch)
    setAplicandoLote(false)
    if (res.error || !res.data) setLoteMsg(res.error ?? 'Erro ao aplicar')
    else setLoteMsg(
      `${res.data.atualizados} produto${res.data.atualizados !== 1 ? 's' : ''} atualizado${res.data.atualizados !== 1 ? 's' : ''}` +
      (res.data.semPermissao > 0 ? ` · ${res.data.semPermissao} sem permissão` : '')
    )
  }

  const filtered = produtos.filter((p) => {
    const matchNome = !search || p.produto_nome.toLowerCase().includes(search.toLowerCase())
    const matchTipo = tipoFiltro === 'todos' || p.produto_tipo === tipoFiltro
    return matchNome && matchTipo
  })

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar produto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex items-center gap-1 bg-input rounded-xl p-1">
          {(['todos', 'produzido', 'revenda'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tipoFiltro === t
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {t === 'todos' ? 'Todos' : t === 'produzido' ? 'Fabricados' : 'Revenda'}
            </button>
          ))}
        </div>
        {Object.keys(atdMap).length > 0 && (
          <button
            onClick={() => { setLoteMode((v) => !v); setSelIds(new Set()); setLoteMsg(null) }}
            className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              loteMode
                ? 'bg-accent-primary/15 text-accent-primary border-accent-primary/30'
                : 'bg-input text-secondary border-transparent hover:text-primary'
            }`}
            title="Selecionar vários produtos e marcar/desmarcar os canais Delivery e Encomendas de uma vez"
          >
            <ListChecks size={16} />
            Canais em lote
          </button>
        )}
        <BotaoImprimir label="Imprimir" className="px-4" />

        <button onClick={() => setModalOpen(true)} className="btn-primary shrink-0">
          <Plus size={16} />
          Novo Produto
        </button>
      </div>

      {/* Barra do modo lote */}
      {loteMode && (
        <div className="card-surface flex items-center gap-2 flex-wrap px-4 py-3 mb-4">
          <span className="text-sm text-primary font-medium tabular-nums">
            {selIds.size} selecionado{selIds.size !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setSelIds(new Set(filtered.map((p) => p.produto_id).filter((id) => atdMap[id])))}
            className="text-xs text-secondary hover:text-primary px-2 py-1 rounded-lg hover:bg-input transition-colors"
          >
            Todos
          </button>
          <button
            onClick={() => setSelIds(new Set())}
            className="text-xs text-secondary hover:text-primary px-2 py-1 rounded-lg hover:bg-input transition-colors"
          >
            Nenhum
          </button>

          <div className="h-5 w-px bg-border-subtle mx-1" style={{ backgroundColor: 'var(--color-border-subtle, rgba(255,255,255,0.08))' }} />

          <span className="text-[11px] uppercase tracking-wider text-secondary">Encomendas:</span>
          <button onClick={() => aplicarLote({ vende_encomenda: true })} disabled={selIds.size === 0 || aplicandoLote}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-accent-primary/15 text-accent-primary border border-accent-primary/25 hover:bg-accent-primary/25 transition-colors disabled:opacity-40">
            Vender
          </button>
          <button onClick={() => aplicarLote({ vende_encomenda: false })} disabled={selIds.size === 0 || aplicandoLote}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-input text-secondary hover:text-primary transition-colors disabled:opacity-40">
            Não vender
          </button>

          <span className="text-[11px] uppercase tracking-wider text-secondary ml-2">Delivery:</span>
          <button onClick={() => aplicarLote({ vende_delivery: true })} disabled={selIds.size === 0 || aplicandoLote}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 transition-colors disabled:opacity-40">
            Vender
          </button>
          <button onClick={() => aplicarLote({ vende_delivery: false })} disabled={selIds.size === 0 || aplicandoLote}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-input text-secondary hover:text-primary transition-colors disabled:opacity-40">
            Não vender
          </button>

          {aplicandoLote && <Loader2 size={14} className="animate-spin text-secondary" />}
          {loteMsg && <span className="text-xs text-success">{loteMsg}</span>}

          <button
            onClick={() => { setLoteMode(false); setSelIds(new Set()); setLoteMsg(null) }}
            className="ml-auto text-xs font-medium text-secondary hover:text-primary px-3 py-1.5 rounded-lg hover:bg-input transition-colors"
          >
            Concluir
          </button>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-input flex items-center justify-center mb-4">
            <Package size={28} className="text-secondary/50" />
          </div>
          <p className="text-primary text-base font-playfair mb-1">
            {produtos.length === 0 ? 'Nenhum produto ainda' : 'Nenhum resultado'}
          </p>
          <p className="text-secondary text-sm max-w-xs">
            {produtos.length === 0
              ? 'Crie produtos fabricados (ligados a fichas técnicas) ou produtos de revenda.'
              : 'Tente um termo diferente ou ajuste os filtros.'}
          </p>
        </div>
      )}

      {/* Lista */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((p) => {
            const tipoConf = TIPO_CONFIG[p.produto_tipo] ?? TIPO_CONFIG.produzido
            const comPreco = p.preco_venda > 0
            const margem = comPreco ? p.margem_percentual : null
            const atd = atdMap[p.produto_id]
            const selecionado = selIds.has(p.produto_id)
            // No modo lote, os controles da linha ficam inertes (o clique seleciona)
            const inerte = loteMode ? ' pointer-events-none opacity-50' : ''

            return (
              <div
                key={p.produto_id}
                onClick={() => (loteMode ? atd && toggleSel(p.produto_id) : setDetalheId(p.produto_id))}
                title={loteMode ? (atd ? 'Selecionar produto' : 'Produto sem dados de atendimento') : 'Ver detalhe do produto'}
                className={`card-surface flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${
                  loteMode && selecionado ? 'bg-accent-primary/10 border border-accent-primary/30' : 'hover:bg-input'
                }`}
              >
                {loteMode && (
                  <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selecionado ? 'bg-accent-primary border-accent-primary text-canvas' : 'border-subtle text-transparent'
                  }`}>
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                {atd?.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={atd.foto_url} alt={p.produto_nome}
                    className="w-9 h-9 rounded-xl object-cover shrink-0 border border-subtle" />
                ) : (
                  <LogoPlaceholder className="w-9 h-9 rounded-xl shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-playfair text-primary text-[17px] font-semibold leading-tight">
                      {p.produto_nome}
                    </p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${tipoConf.cls}`}>
                      {tipoConf.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {p.categoria && (
                      <span className="text-secondary text-xs">{p.categoria}</span>
                    )}
                    {podeVerValores && (
                      <span className="text-secondary text-xs">
                        custo: {p.custo_total > 0
                          ? (p.rendimento_unidade ? formatCustoGrande(p.custo_total, p.rendimento_unidade) : `R$ ${formatBRL(p.custo_total)}`)
                          : '—'}
                      </span>
                    )}
                    {p.unidade_nome && (
                      <span className="text-faint text-xs">{p.unidade_nome}</span>
                    )}
                  </div>
                </div>

                {podeVerValores && (
                <div className="shrink-0 text-right">
                  {comPreco ? (
                    <>
                      <p className="font-playfair text-primary text-[18px] font-bold leading-none tabular-nums">
                        R$ {p.rendimento_unidade ? formatBRL(valorPorGrande(p.preco_venda, p.rendimento_unidade)) : formatBRL(p.preco_venda)}
                        {p.rendimento_unidade && <span className="text-[11px] font-normal text-secondary">/{unidadeGrande(p.rendimento_unidade)}</span>}
                      </p>
                      {margem !== null && (
                        <p className={`text-[11px] mt-0.5 tabular-nums ${margem < 0 ? 'text-danger' : margem < 20 ? 'text-amber-400' : 'text-success'}`}>
                          {margem.toFixed(1)}% margem
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
                      sem preço
                    </span>
                  )}
                </div>
                )}

                {atd && (
                  <>
                    {/* Canais: D = Delivery, E = Encomendas (clique liga/desliga) */}
                    <div className={`flex items-center gap-1 shrink-0${inerte}`}>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCanal(p.produto_id, 'vende_delivery') }}
                        className={`w-6 h-6 rounded-md text-[10px] font-bold border transition-all ${
                          atd.vende_delivery
                            ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                            : 'text-secondary/30 border-subtle hover:text-blue-400/70'
                        }`}
                        title={atd.vende_delivery
                          ? 'Vendido no Delivery — clique para tirar deste canal'
                          : 'Fora do Delivery — clique para vender neste canal'}
                      >
                        D
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCanal(p.produto_id, 'vende_encomenda') }}
                        className={`w-6 h-6 rounded-md text-[10px] font-bold border transition-all ${
                          atd.vende_encomenda
                            ? 'bg-accent-primary/15 text-accent-primary border-accent-primary/30'
                            : 'text-secondary/30 border-subtle hover:text-accent-primary/70'
                        }`}
                        title={atd.vende_encomenda
                          ? 'Vendido por Encomendas — clique para tirar deste canal'
                          : 'Fora de Encomendas — clique para vender neste canal'}
                      >
                        E
                      </button>
                    </div>

                    {/* ⭐ Sugestão do dia — o robô só oferece produtos marcados */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSugestao(p.produto_id) }}
                      className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border transition-all${inerte} ${
                        atd.sugestao_do_dia
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
                          : 'text-secondary/30 border-transparent hover:text-amber-400/70 hover:bg-input'
                      }`}
                      title={atd.sugestao_do_dia
                        ? 'Sugestão do dia — o robô do WhatsApp oferece este produto. Clique para desmarcar.'
                        : 'Marcar como sugestão do dia (o robô do WhatsApp passa a oferecer)'}
                    >
                      <Star size={15} className={atd.sugestao_do_dia ? 'fill-amber-400' : ''} />
                    </button>

                    {/* Tem/acabou hoje — toggle diário do agente */}
                    {atd.sempre_disponivel ? (
                      <span
                        className={`shrink-0 w-24 text-center px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-success/10 text-success border border-success/25${inerte}`}
                        title="Produto de sempre — o robô considera disponível todo dia. Configure no detalhe do produto."
                      >
                        Sempre tem
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); mudarDisponibilidade(p.produto_id) }}
                        className={`shrink-0 w-24 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all${inerte} ${
                          atd.disponivel_hoje === true
                            ? 'bg-success/10 text-success border-success/25 hover:bg-success/20'
                            : atd.disponivel_hoje === false
                              ? 'bg-danger/10 text-danger border-danger/25 hover:bg-danger/20'
                              : 'bg-input text-secondary border-dashed border-subtle hover:text-primary'
                        }`}
                        title={atd.disponivel_hoje === true
                          ? 'Tem hoje — clique quando acabar'
                          : atd.disponivel_hoje === false
                            ? 'Acabou hoje — clique se voltar a ter'
                            : 'Disponibilidade de hoje não informada — clique para marcar que tem'}
                      >
                        {atd.disponivel_hoje === true ? 'Tem hoje' : atd.disponivel_hoje === false ? 'Acabou' : 'Hoje?'}
                      </button>
                    )}
                  </>
                )}

                <select
                  value={locaisMap[p.produto_id] ?? ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { e.stopPropagation(); mudarLocal(p.produto_id, e.target.value) }}
                  className={`input-field text-xs py-1.5 px-2 w-32 shrink-0${inerte}`}
                  title="Setor de produção (aparece na comanda da encomenda)"
                >
                  <option value="">Sem local</option>
                  {locais.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                  {locaisMap[p.produto_id] && !locais.includes(locaisMap[p.produto_id]!) && <option value={locaisMap[p.produto_id]!}>{locaisMap[p.produto_id]}</option>}
                </select>

                <button
                  onClick={(e) => { e.stopPropagation(); setDetalheId(p.produto_id) }}
                  className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-secondary/40 hover:text-accent-primary hover:bg-accent-primary/10 border border-transparent hover:border-accent-primary/20 transition-all${inerte}`}
                  title="Ver detalhe do produto"
                >
                  <Pencil size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {produtos.length > 0 && (
        <p className="text-secondary/40 text-xs mt-4 text-right">
          {filtered.length === produtos.length
            ? `${produtos.length} produto${produtos.length !== 1 ? 's' : ''}`
            : `${filtered.length} de ${produtos.length} produtos`}
        </p>
      )}

      {modalOpen && (
        <NovoProdutoModal
          unidades={unidades}
          unidadeAtual={unidadeAtual}
          receitas={receitas}
          locais={locais}
          onClose={() => setModalOpen(false)}
        />
      )}

      <ProdutoDetalheDrawer produtoId={detalheId} onClose={() => setDetalheId(null)} />

      {/* Documento de impressão — tabela de produtos (valores só p/ quem pode ver) */}
      <DocumentoImpressao titulo={podeVerValores ? 'Tabela de Preços' : 'Lista de Produtos'} subtitulo={`${filtered.length} produto${filtered.length !== 1 ? 's' : ''}`}>
        <table style={T.table}>
          <thead>
            <tr>
              <th style={T.th}>Produto</th>
              <th style={T.th}>Categoria</th>
              {podeVerValores && (
                <>
                  <th style={T.thRight}>Custo</th>
                  <th style={T.thRight}>Preço</th>
                  <th style={T.thRight}>Margem</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.produto_id}>
                <td style={T.td}>{p.produto_nome}</td>
                <td style={T.td}>{p.categoria ?? '—'}</td>
                {podeVerValores && (
                  <>
                    <td style={T.tdRight}>{p.custo_total > 0 ? (p.rendimento_unidade ? formatCustoGrande(p.custo_total, p.rendimento_unidade) : `R$ ${formatBRL(p.custo_total)}`) : '—'}</td>
                    <td style={T.tdRight}>{p.preco_venda > 0 ? (p.rendimento_unidade ? `R$ ${formatBRL(valorPorGrande(p.preco_venda, p.rendimento_unidade))}/${unidadeGrande(p.rendimento_unidade)}` : `R$ ${formatBRL(p.preco_venda)}`) : '—'}</td>
                    <td style={T.tdRight}>{p.preco_venda > 0 ? `${p.margem_percentual.toFixed(1)}%` : '—'}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </DocumentoImpressao>
    </>
  )
}
