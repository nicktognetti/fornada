'use client'

import { useState } from 'react'
import { PackageCheck, ShoppingCart } from 'lucide-react'
import { TransferenciasTab } from './transferencias-tab'
import { ComprasTab } from './compras-tab'
import type { TransferenciaReceber, Compra } from '../types'

interface Props {
  transferencias: TransferenciaReceber[]
  compras: Compra[]
  unidadeId: string
  userId: string
  totalAReceber: number
  isCentro: boolean
}

type Aba = 'transferencias' | 'compras'

export function ReceberHub({ transferencias, compras, unidadeId, userId, totalAReceber, isCentro }: Props) {
  const [aba, setAba] = useState<Aba>('transferencias')

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <PackageCheck size={22} className="text-accent-primary shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold text-primary">Recebimentos</h1>
          <p className="text-sm text-secondary mt-0.5">Transferências e compras desta unidade</p>
        </div>
      </div>

      {/* Toggle de abas */}
      <div className="inline-flex bg-input p-1 rounded-lg gap-1 mb-6">
        <button
          onClick={() => setAba('transferencias')}
          className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all ${
            aba === 'transferencias'
              ? 'bg-accent-primary text-accent-ink font-semibold shadow-sm'
              : 'text-secondary hover:text-ink-soft'
          }`}
        >
          <PackageCheck size={14} />
          Transferências a Receber
          {transferencias.length > 0 && (
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
              aba === 'transferencias' ? 'bg-accent-ink/20 text-accent-ink' : 'bg-accent-primary/15 text-accent-primary'
            }`}>
              {transferencias.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setAba('compras')}
          className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all ${
            aba === 'compras'
              ? 'bg-accent-primary text-accent-ink font-semibold shadow-sm'
              : 'text-secondary hover:text-ink-soft'
          }`}
        >
          <ShoppingCart size={14} />
          Compras / NFe
        </button>
      </div>

      {/* Conteúdo da aba */}
      {aba === 'transferencias' && (
        <TransferenciasTab
          transferencias={transferencias}
          totalAReceber={totalAReceber}
          isCentro={isCentro}
          userId={userId}
        />
      )}
      {aba === 'compras' && (
        <ComprasTab
          compras={compras}
          unidadeId={unidadeId}
        />
      )}
    </div>
  )
}
