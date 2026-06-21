'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  unidades: { id: string; nome: string }[]
}

export function UnidadeFilter({ unidades }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('unidade') ?? ''

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    if (val) params.set('unidade', val)
    else params.delete('unidade')
    router.push(`/dashboard/painel?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
        Unidade
      </label>
      <select
        value={current}
        onChange={handleChange}
        className="input-field text-sm py-2 pr-8 min-w-[180px]"
      >
        <option value="">Todas</option>
        {unidades.map((u) => (
          <option key={u.id} value={u.id}>{u.nome}</option>
        ))}
      </select>
    </div>
  )
}
