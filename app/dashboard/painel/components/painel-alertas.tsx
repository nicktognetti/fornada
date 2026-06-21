'use client'

import { AlertTriangle, CheckCircle } from 'lucide-react'
import { formatBRL } from '@/lib/format'
import type { ProdutoFinanceiro, PainelIndicadores } from '@/app/actions/painel'

interface Props {
  fichas: ProdutoFinanceiro[]
  indicadores: PainelIndicadores
  pontoEquilibrio: number | null
}

type Alerta = {
  tipo: 'success' | 'warn' | 'danger' | 'info'
  texto: string
}

function corAlerta(tipo: Alerta['tipo']) {
  if (tipo === 'success') return 'border-success/20 bg-success/5 text-success'
  if (tipo === 'warn')    return 'border-amber-500/25 bg-amber-500/5 text-amber-400'
  if (tipo === 'danger')  return 'border-danger/20 bg-danger/5 text-danger'
  return 'border-subtle bg-canvas text-secondary'
}

function iconAlerta(tipo: Alerta['tipo']) {
  if (tipo === 'success') return <CheckCircle size={13} className="text-success shrink-0" />
  return <AlertTriangle size={13} className={`shrink-0 ${
    tipo === 'danger' ? 'text-danger' :
    tipo === 'warn'   ? 'text-amber-400' : 'text-secondary'
  }`} />
}

export function PainelAlertas({ fichas, indicadores: ind, pontoEquilibrio }: Props) {
  const alertas: Alerta[] = []

  // ① Ponto de equilíbrio vs portfólio
  if (pontoEquilibrio !== null && pontoEquilibrio > 0) {
    const delta = ind.valor_portfolio - pontoEquilibrio
    const pct   = Math.abs((delta / pontoEquilibrio) * 100).toFixed(0)
    if (delta >= 0) {
      alertas.push({
        tipo: 'success',
        texto: `Ponto de equilíbrio: R$ ${formatBRL(pontoEquilibrio)} — portfólio está ${pct}% acima`,
      })
    } else {
      alertas.push({
        tipo: 'danger',
        texto: `Ponto de equilíbrio: R$ ${formatBRL(pontoEquilibrio)} — falta ${pct}% para cobrir as despesas fixas`,
      })
    }
  }

  // ② Margem negativa
  if (ind.produtos_margem_negativa > 0) {
    alertas.push({
      tipo: 'danger',
      texto: `${ind.produtos_margem_negativa} produto${ind.produtos_margem_negativa !== 1 ? 's' : ''} com margem negativa — revisar precificação`,
    })
  }

  // ③ Sem preço
  if (ind.produtos_sem_preco > 0) {
    const tipo: Alerta['tipo'] = ind.produtos_sem_preco > 50 ? 'danger' : ind.produtos_sem_preco > 10 ? 'warn' : 'info'
    alertas.push({
      tipo,
      texto: `${ind.produtos_sem_preco} produto${ind.produtos_sem_preco !== 1 ? 's' : ''} sem preço cadastrado`,
    })
  }

  // ④ Diferença de margem entre unidades (quando há 2+ unidades distintas)
  const unidades = [...new Set(fichas.map((f) => f.unidade_id).filter(Boolean))] as string[]
  if (unidades.length >= 2) {
    const margemPorUnidade = unidades.map((uid) => {
      const lote = fichas.filter((f) => f.unidade_id === uid && f.preco_venda > 0)
      const nome = fichas.find((f) => f.unidade_id === uid)?.unidade_nome ?? uid
      const media = lote.length ? lote.reduce((s, f) => s + f.margem_percentual, 0) / lote.length : 0
      return { uid, nome, media, count: lote.length }
    }).filter((u) => u.count >= 3)

    if (margemPorUnidade.length >= 2) {
      const sorted = [...margemPorUnidade].sort((a, b) => b.media - a.media)
      const diff = sorted[0].media - sorted[sorted.length - 1].media
      if (diff >= 5) {
        alertas.push({
          tipo: 'info',
          texto: `Margem média de "${sorted[0].nome}" (${sorted[0].media.toFixed(1)}%) é ${diff.toFixed(1)} pp maior que "${sorted[sorted.length - 1].nome}" (${sorted[sorted.length - 1].media.toFixed(1)}%)`,
        })
      }
    }
  }

  // ⑤ Nenhum alerta
  if (alertas.length === 0) {
    alertas.push({ tipo: 'success', texto: 'Tudo em ordem — nenhum alerta crítico no momento' })
  }

  return (
    <section className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary px-1">
        Alertas
      </p>
      {alertas.map((a, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-medium leading-snug ${corAlerta(a.tipo)}`}
        >
          {iconAlerta(a.tipo)}
          <span>{a.texto}</span>
        </div>
      ))}
    </section>
  )
}
