'use client'

import { useState } from 'react'
import { TrendingUp, Award, AlertTriangle, Calculator, DollarSign, BarChart3 } from 'lucide-react'
import { PrecificadorModal } from './precificador-modal'
import { formatBRL } from '@/lib/format'
import type { ProdutoRentabilidade, PainelResumo } from '../types'

const STATUS_LABEL: Record<ProdutoRentabilidade['status'], string> = {
  lucrativo: 'Lucrativo',
  baixo:     'Baixo',
  prejuizo:  'Prejuízo',
}

const STATUS_CLS: Record<ProdutoRentabilidade['status'], string> = {
  lucrativo: 'bg-success-tint text-success border border-success/20',
  baixo:     'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  prejuizo:  'bg-danger-tint text-danger border border-danger/20',
}

interface Props {
  produtos: ProdutoRentabilidade[]
  resumo: PainelResumo
}

export function PainelClient({ produtos: produtosIniciais, resumo }: Props) {
  const [produtos, setProdutos] = useState(produtosIniciais)
  const [modalOpen, setModalOpen] = useState(false)

  function handleSuccess(produtoId: string, novoPreco: number) {
    setProdutos((prev) =>
      prev.map((p) => {
        if (p.id !== produtoId) return p
        const margem = ((novoPreco - p.custo) / novoPreco) * 100
        const markup = ((novoPreco - p.custo) / p.custo) * 100
        const status: ProdutoRentabilidade['status'] =
          margem >= 40 ? 'lucrativo' : margem >= 20 ? 'baixo' : 'prejuizo'
        return { ...p, preco: novoPreco, margem, markup, status }
      })
    )
  }

  const cards = [
    {
      label: 'Margem Média',
      value: resumo.totalProdutos > 0 ? `${resumo.margemMedia.toFixed(1)}%` : '—',
      sub: 'sobre venda',
      icon: TrendingUp,
      color: resumo.margemMedia >= 40 ? 'text-success' : resumo.margemMedia >= 20 ? 'text-amber-400' : resumo.totalProdutos > 0 ? 'text-danger' : 'text-faint',
    },
    {
      label: 'Markup Médio',
      value: resumo.totalProdutos > 0 ? `${resumo.markupMedio.toFixed(1)}%` : '—',
      sub: 'sobre custo',
      icon: BarChart3,
      color: 'text-accent-primary',
    },
    {
      label: '+ Lucrativo',
      value: resumo.maisLucrativo?.nome ?? '—',
      sub: resumo.maisLucrativo ? `${resumo.maisLucrativo.margem.toFixed(1)}% margem` : 'sem dados',
      icon: Award,
      color: 'text-success',
      isText: true,
    },
    {
      label: '- Lucrativo',
      value: resumo.menosLucrativo?.nome ?? '—',
      sub: resumo.menosLucrativo ? `${resumo.menosLucrativo.margem.toFixed(1)}% margem` : 'sem dados',
      icon: AlertTriangle,
      color: 'text-danger',
      isText: true,
    },
    {
      label: 'Preço Médio',
      value: resumo.totalProdutos > 0 ? `R$ ${formatBRL(resumo.precoMedio)}` : '—',
      sub: `${resumo.totalProdutos} produto${resumo.totalProdutos !== 1 ? 's' : ''} precificado${resumo.totalProdutos !== 1 ? 's' : ''}`,
      icon: DollarSign,
      color: 'text-ink-soft',
    },
  ]

  return (
    <>
      {/* Hero */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <p className="text-sm text-secondary">
          {resumo.totalProdutos === 0
            ? 'Nenhum produto com custo e preço cadastrado.'
            : `${resumo.totalProdutos} produto${resumo.totalProdutos !== 1 ? 's' : ''} analisado${resumo.totalProdutos !== 1 ? 's' : ''}`}
        </p>
        <button
          onClick={() => setModalOpen(true)}
          disabled={produtos.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-sm font-semibold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Calculator size={14} />
          Precificar Produto
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="card-surface px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon size={13} className={`${card.color} shrink-0`} />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary truncate">
                  {card.label}
                </p>
              </div>
              <p className={`font-playfair font-bold leading-tight mb-1 ${card.isText ? 'text-base text-primary truncate' : 'text-2xl tabular-nums ' + card.color}`}>
                {card.value}
              </p>
              <p className="text-[11px] text-faint">{card.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Tabela de rentabilidade */}
      {produtos.length === 0 ? (
        <div className="card-surface p-10 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
            <BarChart3 size={28} className="text-accent-primary/50" />
          </div>
          <div>
            <p className="text-primary font-playfair text-lg font-semibold mb-1">Nenhum dado disponível</p>
            <p className="text-secondary text-sm max-w-xs">
              Para ver rentabilidade, os produtos precisam de ficha técnica com custo calculado e preço cadastrado.
            </p>
          </div>
        </div>
      ) : (
        <div className="card-surface overflow-hidden">
          {/* Cabeçalho */}
          <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-subtle bg-canvas">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Produto</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-24 text-right">Custo</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-24 text-right">Preço</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-20 text-right">Margem</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-20 text-right">Markup</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-24 text-center">Status</span>
          </div>

          <div className="divide-y divide-subtle">
            {produtos.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-3 md:gap-4 px-5 py-4 hover:bg-input/50 transition-colors"
              >
                {/* Nome */}
                <p className="font-playfair text-[16px] font-semibold text-primary leading-tight truncate">
                  {p.nome}
                </p>

                {/* Custo */}
                <div className="flex items-center justify-between md:block md:w-24">
                  <span className="text-xs text-secondary md:hidden">Custo</span>
                  <span className="text-sm tabular-nums text-secondary text-right">
                    {p.custo > 0 ? `R$ ${formatBRL(p.custo)}` : '—'}
                  </span>
                </div>

                {/* Preço */}
                <div className="flex items-center justify-between md:block md:w-24">
                  <span className="text-xs text-secondary md:hidden">Preço</span>
                  <span className="text-sm tabular-nums font-semibold text-ink-soft text-right">
                    {p.preco > 0 ? `R$ ${formatBRL(p.preco)}` : '—'}
                  </span>
                </div>

                {/* Margem */}
                <div className="flex items-center justify-between md:block md:w-20">
                  <span className="text-xs text-secondary md:hidden">Margem</span>
                  <span className={`text-sm font-bold tabular-nums text-right block ${
                    p.status === 'lucrativo' ? 'text-success' :
                    p.status === 'baixo' ? 'text-amber-400' : 'text-danger'
                  }`}>
                    {p.margem.toFixed(1)}%
                  </span>
                </div>

                {/* Markup */}
                <div className="flex items-center justify-between md:block md:w-20">
                  <span className="text-xs text-secondary md:hidden">Markup</span>
                  <span className="text-sm font-medium tabular-nums text-ink-soft text-right block">
                    {p.markup.toFixed(1)}%
                  </span>
                </div>

                {/* Status badge */}
                <div className="flex md:justify-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${STATUS_CLS[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <PrecificadorModal
          produtos={produtos}
          onClose={() => setModalOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
