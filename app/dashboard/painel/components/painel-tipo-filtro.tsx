'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

const TABS = [
  { value: 'todos',     label: 'Todos' },
  { value: 'produzido', label: 'Fabricados' },
  { value: 'revenda',   label: 'Revenda' },
]

interface Props {
  tipoAtual: string
}

export function PainelTipoFiltro({ tipoAtual }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleClick(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'todos') params.delete('tipo')
    else params.set('tipo', value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1">
      {TABS.map((tab) => {
        const ativa = tipoAtual === tab.value || (tab.value === 'todos' && tipoAtual === 'todos')
        return (
          <button
            key={tab.value}
            onClick={() => handleClick(tab.value)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              ativa
                ? 'bg-accent-primary text-accent-ink'
                : 'text-secondary hover:text-primary hover:bg-input/40'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
