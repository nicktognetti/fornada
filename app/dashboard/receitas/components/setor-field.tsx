'use client'

import { useEffect, useId, useState } from 'react'
import { getCategoriasReceita } from '../actions'

interface Props {
  value: string
  onChange: (v: string) => void
  // Quando usado dentro de <form action={...}>, o name faz o valor ser enviado.
  name?: string
}

// Campo "Setor" da receita: texto livre com autocomplete pelos setores já usados
// (Confeitaria, Padaria, Salgados…). Mesmo desenho da categoria de insumo.
export function SetorField({ value, onChange, name }: Props) {
  const listId = useId()
  const [sugestoes, setSugestoes] = useState<string[]>([])

  useEffect(() => {
    let vivo = true
    getCategoriasReceita().then((cats) => { if (vivo) setSugestoes(cats) })
    return () => { vivo = false }
  }, [])

  return (
    <>
      <input
        type="text"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ex: Confeitaria, Padaria, Salgados…"
        list={listId}
        autoComplete="off"
        maxLength={80}
        className="input-field"
      />
      <datalist id={listId}>
        {sugestoes.map((s) => <option key={s} value={s} />)}
      </datalist>
    </>
  )
}
