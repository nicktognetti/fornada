'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChefHat, ChevronLeft, ChevronRight, Loader2, ClipboardList, Printer } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { getPlanoProducao, type PlanoProducao } from '@/app/actions/producao'

/** 'YYYY-MM-DD' + n dias, sem passar por Date (evita recuo de fuso). */
function somaDias(iso: string, n: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

function rotuloData(iso: string, hoje: string): string {
  if (iso === hoje) return 'Hoje'
  if (iso === somaDias(hoje, 1)) return 'Amanhã'
  if (iso === somaDias(hoje, -1)) return 'Ontem'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** Quantidade legível: 1.5 kg → "1,5 kg"; 3 un → "3 un"; sem unidade → "3". */
function fmtQtd(q: number, unidade: string | null): string {
  const n = Number.isInteger(q) ? String(q) : q.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')
  return unidade ? `${n} ${unidade}` : n
}

export function ProducaoView({ inicial, hoje }: { inicial: PlanoProducao; hoje: string }) {
  const [plano, setPlano] = useState(inicial)
  const [carregando, startTransition] = useTransition()

  function irPara(novaData: string) {
    startTransition(async () => {
      const r = await getPlanoProducao(novaData)
      if (r.data) setPlano(r.data)
    })
  }

  const totalItens = plano.grupos.reduce((s, g) => s + g.itens.length, 0)

  return (
    <div className="space-y-5">
      <PageTitle icon={ChefHat} subtitle="O que precisa ser produzido, somado por setor">
        Plano de produção
      </PageTitle>

      {/* Navegação por dia */}
      <div className="card-surface px-4 py-3 flex items-center gap-3 flex-wrap print:hidden">
        <button
          onClick={() => irPara(somaDias(plano.data, -1))}
          className="btn-ghost text-xs px-3 py-2 min-h-[36px] text-secondary hover:text-primary"
          aria-label="Dia anterior"
        >
          <ChevronLeft size={15} />
        </button>

        <div className="flex items-center gap-2">
          <span className="font-playfair text-primary text-lg font-bold">{rotuloData(plano.data, hoje)}</span>
          {carregando && <Loader2 size={14} className="animate-spin text-accent-primary" />}
        </div>

        <button
          onClick={() => irPara(somaDias(plano.data, 1))}
          className="btn-ghost text-xs px-3 py-2 min-h-[36px] text-secondary hover:text-primary"
          aria-label="Próximo dia"
        >
          <ChevronRight size={15} />
        </button>

        <input
          type="date"
          value={plano.data}
          onChange={(e) => e.target.value && irPara(e.target.value)}
          className="input-field text-sm py-1.5 w-auto"
          aria-label="Escolher data"
        />

        {plano.data !== hoje && (
          <button onClick={() => irPara(hoje)} className="btn-ghost text-xs px-3 py-2 min-h-[36px] text-secondary hover:text-primary">
            Hoje
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-secondary text-xs tabular-nums">
            {plano.totalEncomendas} {plano.totalEncomendas === 1 ? 'encomenda' : 'encomendas'}
            {plano.jaProntas > 0 && ` · ${plano.jaProntas} já ${plano.jaProntas === 1 ? 'pronta' : 'prontas'}`}
          </span>
          <button onClick={() => window.print()} className="btn-ghost text-xs px-3 py-2 min-h-[36px] text-secondary hover:text-primary inline-flex items-center gap-1">
            <Printer size={13} /> Imprimir
          </button>
        </div>
      </div>

      {/* Cabeçalho só da impressão */}
      <div className="hidden print:block mb-4">
        <h1 style={{ fontSize: '18px', fontWeight: 700 }}>Plano de produção — {rotuloData(plano.data, hoje)}</h1>
        <p style={{ fontSize: '12px', color: '#555' }}>
          {plano.totalEncomendas} encomenda(s) · {totalItens} item(ns)
        </p>
      </div>

      {plano.grupos.length === 0 ? (
        <div className="card-surface px-6 py-10 text-center">
          <ClipboardList size={28} className="text-secondary/40 mx-auto mb-3" />
          <p className="text-secondary text-sm">
            Nada a produzir {rotuloData(plano.data, hoje).toLowerCase()}.
            {plano.jaProntas > 0 && ` As ${plano.jaProntas} encomenda(s) do dia já estão prontas.`}
          </p>
          <Link href="/dashboard/encomendas" className="text-accent-primary hover:underline text-sm mt-2 inline-block">
            Ver encomendas
          </Link>
        </div>
      ) : (
        plano.grupos.map((g) => (
          <div key={g.local ?? '__sem__'} className="card-surface overflow-hidden break-inside-avoid">
            <div className="bg-input px-5 py-2.5 flex items-center justify-between">
              <h2 className="text-primary text-sm font-semibold uppercase tracking-wider">
                {g.local ?? 'Sem setor definido'}
              </h2>
              <span className="text-secondary text-[11px] tabular-nums">
                {g.itens.length} {g.itens.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {g.itens.map((it, i) => (
                  <tr key={i} className="border-t border-subtle align-top">
                    <td className="px-5 py-3">
                      <p className="text-primary font-medium">{it.descricao}</p>
                      {it.observacoes.length > 0 && (
                        <p className="text-secondary text-xs mt-0.5">{it.observacoes.join(' · ')}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <p className="text-accent-primary font-bold tabular-nums text-base">
                        {fmtQtd(it.quantidade, it.unidade)}
                      </p>
                      {it.pedidos > 1 && (
                        <p className="text-secondary text-[11px] tabular-nums">{it.pedidos} pedidos</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  )
}
