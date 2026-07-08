'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getSetoresDisponiveis } from '../actions'

interface Props {
  value: string
  onChange: (v: string) => void
  // Quando usado dentro de <form action={...}>, o name faz o valor ser enviado.
  name?: string
}

// Campo "Setor" da receita: menu com a lista de Locais cadastrável (Confeitaria,
// Produção…). Só mostra os setores que o usuário pode usar no Caderno (produção
// restrita vê só os liberados). Mantém o valor atual como opção mesmo se estiver
// fora da lista (ex.: um setor antigo/legado), pra não perdê-lo ao salvar.
export function SetorField({ value, onChange, name }: Props) {
  const [locais, setLocais] = useState<string[]>([])
  const [permitidos, setPermitidos] = useState<string[] | null>(null)

  useEffect(() => {
    let vivo = true
    getSetoresDisponiveis().then((r) => {
      if (!vivo) return
      setLocais(r.locais)
      setPermitidos(r.permitidos)
    })
    return () => { vivo = false }
  }, [])

  const opcoes = permitidos === null ? locais : locais.filter((l) => permitidos.includes(l))
  const todas = value && !opcoes.includes(value) ? [value, ...opcoes] : opcoes

  return (
    <div className="relative">
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field appearance-none pr-9"
      >
        <option value="">Sem setor</option>
        {todas.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
    </div>
  )
}
