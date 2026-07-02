'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, ShoppingBag, BookOpen, ArrowRight, Loader2 } from 'lucide-react'
import { DetailDrawer } from './ui/detail-drawer'
import { formatBRL, formatCustoGrande, valorPorGrande, unidadeGrande } from '@/lib/format'
import { getProdutoDetalhe, type ProdutoDetalhe } from '@/app/actions/painel'

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

  useEffect(() => {
    if (!produtoId) return
    let ativo = true
    setLoading(true)
    setErro(null)
    setDetalhe(null)
    getProdutoDetalhe(produtoId).then((res) => {
      if (!ativo) return
      if (res.error || !res.data) setErro(res.error ?? 'Erro ao carregar')
      else setDetalhe(res.data)
      setLoading(false)
    })
    return () => { ativo = false }
  }, [produtoId])

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
          {/* ── Margem decomposta ── */}
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
          {detalhe.tipo === 'revenda' && (
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
