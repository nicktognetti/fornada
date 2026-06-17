'use client'

import { useState } from 'react'

type Unidade = 'morada-do-sol' | 'centro'

export function UnidadeSelector() {
  const [unidade, setUnidade] = useState<Unidade>('morada-do-sol')

  return (
    <div className="flex items-center gap-5 mb-6">
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#9e9e9e]/60 shrink-0">
        UNIDADE
      </span>
      <button
        onClick={() => setUnidade('morada-do-sol')}
        className={`flex items-center gap-2 text-sm transition-colors ${
          unidade === 'morada-do-sol' ? 'text-[#e8e6e3]' : 'text-[#9e9e9e] hover:text-[#c0bebb]'
        }`}
      >
        {unidade === 'morada-do-sol' && (
          <span className="h-2 w-2 rounded-full bg-[#d68a57] shrink-0" />
        )}
        Morada do Sol
      </button>
      <button
        onClick={() => setUnidade('centro')}
        className={`flex items-center gap-2 text-sm transition-colors ${
          unidade === 'centro' ? 'text-[#e8e6e3]' : 'text-[#9e9e9e] hover:text-[#c0bebb]'
        }`}
      >
        {unidade === 'centro' && (
          <span className="h-2 w-2 rounded-full bg-[#d68a57] shrink-0" />
        )}
        Centro
      </button>
    </div>
  )
}
