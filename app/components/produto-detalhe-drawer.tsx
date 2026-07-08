'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Package, ShoppingBag, BookOpen, ArrowRight, Loader2, Star, Camera, Trash2 } from 'lucide-react'
import { DetailDrawer } from './ui/detail-drawer'
import { LogoPlaceholder } from './ui/logo-placeholder'
import { formatBRL, formatCustoGrande, valorPorGrande, unidadeGrande } from '@/lib/format'
import { getProdutoDetalhe, type ProdutoDetalhe } from '@/app/actions/painel'
import {
  setProdutoAtendimento,
  uploadProdutoFoto,
  removeProdutoFoto,
  type ProdutoAtendimento,
} from '@/app/actions/produto-atendimento'

/** Custo por kg/L (fabricado com rendimento em peso/volume) ou por unidade (revenda). */
function custoLabel(v: number, u: string | null): string {
  return u ? formatCustoGrande(v, u) : `R$ ${formatBRL(v)}`
}
/** Preço por kg/L ou por unidade. */
function precoLabel(v: number, u: string | null): string {
  return u ? `R$ ${formatBRL(valorPorGrande(v, u))}/${unidadeGrande(u)}` : `R$ ${formatBRL(v)}`
}

interface Props {
  /** Quando != null, o drawer abre e busca o detalhe deste produto. */
  produtoId: string | null
  onClose: () => void
}

function margemColor(m: number) {
  if (m < 0) return 'text-danger'
  if (m < 20) return 'text-amber-400'
  return 'text-success'
}

export function ProdutoDetalheDrawer({ produtoId, onClose }: Props) {
  const [detalhe, setDetalhe] = useState<ProdutoDetalhe | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Estado local dos campos do agente WhatsApp (edição otimista no drawer)
  const [atd, setAtd] = useState<ProdutoAtendimento | null>(null)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [erroAtd, setErroAtd] = useState<string | null>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!produtoId) return
    let ativo = true
    // Reset síncrono ao trocar de produto antes do fetch (estado de carregamento).
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true)
    setErro(null)
    setDetalhe(null)
    setAtd(null)
    setErroAtd(null)
    /* eslint-enable react-hooks/set-state-in-effect */
    getProdutoDetalhe(produtoId).then((res) => {
      if (!ativo) return
      if (res.error || !res.data) setErro(res.error ?? 'Erro ao carregar')
      else {
        setDetalhe(res.data)
        setAtd(res.data.atendimento)
      }
      setLoading(false)
    })
    return () => { ativo = false }
  }, [produtoId])

  async function patchAtd(patch: Partial<ProdutoAtendimento>) {
    if (!produtoId || !atd) return
    setErroAtd(null)
    const anterior = atd
    setAtd({ ...atd, ...patch })
    const res = await setProdutoAtendimento(produtoId, patch)
    if (res.error) {
      setAtd(anterior)
      setErroAtd(res.error)
    }
  }

  async function onFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !produtoId || !atd) return
    if (file.size > 5 * 1024 * 1024) { setErroAtd('Imagem muito grande (máx. 5 MB)'); return }
    setErroAtd(null)
    setEnviandoFoto(true)
    const fd = new FormData()
    fd.append('foto', file)
    const res = await uploadProdutoFoto(produtoId, fd)
    setEnviandoFoto(false)
    if (res.error || !res.data) setErroAtd(res.error ?? 'Falha no upload')
    else setAtd((a) => (a ? { ...a, foto_url: res.data!.foto_url } : a))
  }

  async function onRemoverFoto() {
    if (!produtoId || !atd?.foto_url) return
    setErroAtd(null)
    const anterior = atd
    setAtd({ ...atd, foto_url: null })
    const res = await removeProdutoFoto(produtoId)
    if (res.error) {
      setAtd(anterior)
      setErroAtd(res.error)
    }
  }

  const comPreco = (detalhe?.preco ?? 0) > 0
  const tipoIcon = detalhe?.tipo === 'revenda' ? ShoppingBag : Package
  const tipoLabel = detalhe?.tipo === 'revenda' ? 'Revenda' : 'Fabricado'

  return (
    <DetailDrawer
      open={produtoId !== null}
      onClose={onClose}
      title={detalhe?.nome ?? 'Detalhe do produto'}
      subtitle={detalhe ? [tipoLabel, detalhe.unidade_nome, detalhe.categoria].filter(Boolean).join(' · ') : undefined}
      icon={tipoIcon}
    >
      {loading && (
        <div className="flex items-center justify-center py-16 text-secondary">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}

      {erro && !loading && (
        <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{erro}</p>
      )}

      {detalhe && !loading && (
        <div className="space-y-6">
          {/* ── Margem decomposta (só para quem pode ver valores) ── */}
          {detalhe.podeVerValores && (
          <section className="rounded-xl bg-canvas border border-subtle p-4 space-y-3">
            <p className="field-label">Rentabilidade</p>
            {comPreco ? (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-secondary">Margem</p>
                    <p className={`font-playfair text-3xl font-bold leading-none tabular-nums ${margemColor(detalhe.margem_percentual)}`}>
                      {detalhe.margem_percentual.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-secondary">Markup</p>
                    <p className="text-lg font-semibold text-ink-soft tabular-nums">
                      {detalhe.markup_percentual.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-subtle text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-secondary">Custo</p>
                    <p className="text-sm font-semibold text-ink-soft tabular-nums">{custoLabel(detalhe.custo_total, detalhe.rendimento_unidade)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-secondary">Preço</p>
                    <p className="text-sm font-semibold text-primary tabular-nums">{precoLabel(detalhe.preco, detalhe.rendimento_unidade)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-secondary">Margem R$</p>
                    <p className={`text-sm font-semibold tabular-nums ${margemColor(detalhe.margem_percentual)}`}>{precoLabel(detalhe.margem_rs, detalhe.rendimento_unidade)}</p>
                  </div>
                </div>
                <p className="text-[11px] text-faint pt-1">
                  Fórmula: margem = (preço − custo) ÷ preço · markup = (preço − custo) ÷ custo
                </p>
              </>
            ) : (
              <p className="text-sm text-faint">
                Produto sem preço de venda. {detalhe.custo_total > 0 ? `Custo de produção: ${custoLabel(detalhe.custo_total, detalhe.rendimento_unidade)}.` : ''}
              </p>
            )}
          </section>
          )}

          {/* ── Composição de custo (produzido) ── */}
          {detalhe.composicao && detalhe.composicao.itens.length > 0 && (
            <section className="space-y-2">
              <p className="field-label">Composição do custo</p>
              <div className="rounded-xl bg-surface border border-subtle overflow-hidden">
                {detalhe.composicao.itens.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-subtle last:border-0">
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${it.is_pendente ? 'text-amber-400' : 'text-primary'}`}>{it.nome_display}</p>
                      <p className="text-[11px] text-faint tabular-nums">
                        {it.quantidade} {it.unidade}
                        {it.custo_unitario != null && <> · {formatCustoGrande(it.custo_unitario, it.unidade)}</>}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-primary tabular-nums shrink-0">
                      {it.custo_item != null ? `R$ ${formatBRL(it.custo_item)}` : '—'}
                    </span>
                  </div>
                ))}
                {detalhe.custo_embalagem > 0 && (
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-subtle last:border-0">
                    <p className="text-sm text-secondary">Embalagem</p>
                    <span className="text-sm font-medium text-ink-soft tabular-nums shrink-0">R$ {formatBRL(detalhe.custo_embalagem)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-input">
                  <p className="text-sm text-secondary">Custo do lote</p>
                  <span className="font-playfair text-accent-primary text-lg font-bold tabular-nums shrink-0">R$ {formatBRL(detalhe.composicao.custo?.custo_total ?? detalhe.custo_total)}</span>
                </div>
              </div>
            </section>
          )}

          {/* ── Revenda: custo de compra ── */}
          {detalhe.podeVerValores && detalhe.tipo === 'revenda' && (
            <section className="space-y-2">
              <p className="field-label">Custo de compra</p>
              <div className="rounded-xl bg-surface border border-subtle px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-secondary">Valor pago ao fornecedor</p>
                <span className="text-sm font-semibold text-ink-soft tabular-nums">
                  {detalhe.custo_compra != null ? `R$ ${formatBRL(detalhe.custo_compra)}` : '—'}
                </span>
              </div>
            </section>
          )}

          {/* ── Preço e volume ── */}
          {detalhe.podeVerValores && (
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface border border-subtle px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-secondary">Preço de venda</p>
              <p className="text-sm font-semibold text-primary tabular-nums mt-1">{comPreco ? precoLabel(detalhe.preco, detalhe.rendimento_unidade) : '—'}</p>
            </div>
            <div className="rounded-xl bg-surface border border-subtle px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-secondary">Volume mensal</p>
              <p className="text-sm font-semibold text-ink-soft tabular-nums mt-1">{detalhe.volume_mensal > 0 ? `${detalhe.volume_mensal} un` : '—'}</p>
            </div>
          </section>
          )}

          {/* ── Atendimento (robô do WhatsApp) ── */}
          {atd && (
            <section className="space-y-2">
              <p className="field-label">Atendimento — robô do WhatsApp</p>
              <div className="rounded-xl bg-surface border border-subtle p-4 space-y-4">
                {/* Foto que o robô envia na conversa */}
                <div className="flex items-center gap-3">
                  {atd.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={atd.foto_url} alt={detalhe.nome}
                      className="w-16 h-16 rounded-xl object-cover border border-subtle shrink-0" />
                  ) : (
                    <LogoPlaceholder className="w-16 h-16 rounded-xl shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => fotoInputRef.current?.click()}
                        disabled={enviandoFoto}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-input text-ink-soft hover:text-primary text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {enviandoFoto ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                        {enviandoFoto ? 'Enviando…' : atd.foto_url ? 'Trocar foto' : 'Enviar foto'}
                      </button>
                      {atd.foto_url && !enviandoFoto && (
                        <button
                          onClick={onRemoverFoto}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-danger/70 hover:text-danger hover:bg-danger-tint text-xs font-medium transition-colors"
                        >
                          <Trash2 size={12} />
                          Remover
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-faint mt-1.5">
                      O robô envia esta foto no WhatsApp ao falar do produto. JPG, PNG ou WebP até 5 MB.
                    </p>
                    <input ref={fotoInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                      className="hidden" onChange={onFotoChange} />
                  </div>
                </div>

                {/* Em quais canais o robô vende este produto */}
                <div>
                  <p className="text-sm text-primary mb-1.5">Canais de venda</p>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={atd.vende_delivery}
                        onChange={(e) => patchAtd({ vende_delivery: e.target.checked })}
                        className="accent-[var(--color-accent-primary)]"
                      />
                      <span className="text-sm text-primary">Delivery</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={atd.vende_encomenda}
                        onChange={(e) => patchAtd({ vende_encomenda: e.target.checked })}
                        className="accent-[var(--color-accent-primary)]"
                      />
                      <span className="text-sm text-primary">Encomendas</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-faint mt-1.5">
                    Cada canal tem um número de WhatsApp próprio. Delivery costuma vender quase tudo;
                    Encomendas só os produtos marcados.
                  </p>
                </div>

                {/* Sempre disponível */}
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={atd.sempre_disponivel}
                    onChange={(e) => patchAtd({ sempre_disponivel: e.target.checked })}
                    className="mt-0.5 accent-[var(--color-accent-primary)]"
                  />
                  <span>
                    <span className="text-sm text-primary block">Sempre disponível</span>
                    <span className="text-[11px] text-faint">
                      Produto &quot;de sempre&quot; (ex.: pão francês) — dispensa o marca/desmarca diário.
                    </span>
                  </span>
                </label>

                {/* Disponibilidade de hoje (só quando não é "de sempre") */}
                {!atd.sempre_disponivel && (
                  <div>
                    <p className="text-sm text-primary mb-1.5">Disponibilidade de hoje</p>
                    <div className="inline-flex items-center gap-1 bg-input rounded-xl p-1">
                      {([
                        { valor: true,  rotulo: 'Tem hoje',      ativo: 'bg-success/15 text-success' },
                        { valor: false, rotulo: 'Acabou',        ativo: 'bg-danger/15 text-danger' },
                        { valor: null,  rotulo: 'Não informado', ativo: 'bg-surface text-primary' },
                      ] as const).map((opt) => (
                        <button
                          key={String(opt.valor)}
                          onClick={() => patchAtd({ disponivel_hoje: opt.valor })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            atd.disponivel_hoje === opt.valor ? opt.ativo : 'text-secondary hover:text-primary'
                          }`}
                        >
                          {opt.rotulo}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-faint mt-1.5">
                      &quot;Não informado&quot; faz o robô confirmar com a equipe antes de prometer o produto.
                    </p>
                  </div>
                )}

                {/* Sugestão do dia */}
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={atd.sugestao_do_dia}
                    onChange={(e) => patchAtd({ sugestao_do_dia: e.target.checked })}
                    className="mt-0.5 accent-[var(--color-accent-primary)]"
                  />
                  <span>
                    <span className="text-sm text-primary flex items-center gap-1.5">
                      Sugestão do dia
                      <Star size={12} className={atd.sugestao_do_dia ? 'fill-amber-400 text-amber-400' : 'text-secondary/40'} />
                    </span>
                    <span className="text-[11px] text-faint">
                      O robô só oferece espontaneamente produtos marcados aqui (no máx. 1 por conversa).
                    </span>
                  </span>
                </label>

                {erroAtd && (
                  <p className="text-xs text-danger bg-danger-tint rounded-lg px-3 py-2">{erroAtd}</p>
                )}
              </div>
            </section>
          )}

          {/* ── Link para a ficha ── */}
          {detalhe.receita_id && (
            <Link
              href={`/dashboard/receitas/${detalhe.receita_id}`}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-input text-ink-soft hover:text-primary hover:bg-accent-tint text-sm font-medium transition-colors"
            >
              <BookOpen size={14} />
              Ver ficha completa
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      )}
    </DetailDrawer>
  )
}
