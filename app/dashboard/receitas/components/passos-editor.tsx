'use client'

import { Plus, Trash2, ChevronUp } from 'lucide-react'

interface Props {
  passos: string[]
  onChange: (passos: string[]) => void
}

// Editor de passos numerados (adicionar / remover / reordenar).
// Estado vive no pai; este componente só renderiza e emite a nova lista.
export function PassosEditor({ passos, onChange }: Props) {
  const lista = passos.length ? passos : ['']

  function setPasso(i: number, v: string) {
    onChange(lista.map((s, idx) => (idx === i ? v : s)))
  }
  function addPasso() {
    onChange([...lista, ''])
  }
  function removePasso(i: number) {
    onChange(lista.length === 1 ? [''] : lista.filter((_, idx) => idx !== i))
  }
  function moverPasso(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= lista.length) return
    const next = [...lista]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {lista.map((passo, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="shrink-0 w-7 h-7 mt-1 rounded-full bg-accent-primary/15 text-accent-primary flex items-center justify-center text-sm font-semibold tabular-nums">
            {i + 1}
          </div>
          <textarea
            value={passo}
            onChange={(e) => setPasso(i, e.target.value)}
            placeholder={`Passo ${i + 1} — o que fazer…`}
            rows={2}
            className="input-field resize-none flex-1"
          />
          <div className="flex flex-col gap-1 shrink-0 mt-0.5">
            <button type="button" onClick={() => moverPasso(i, -1)} disabled={i === 0}
              className="w-7 h-6 rounded-md flex items-center justify-center text-secondary hover:text-accent-primary hover:bg-accent-primary/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all" aria-label="Subir passo">
              <ChevronUp size={14} />
            </button>
            <button type="button" onClick={() => removePasso(i)}
              className="w-7 h-6 rounded-md flex items-center justify-center text-secondary hover:text-red-400 hover:bg-red-500/10 transition-all" aria-label="Remover passo">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      <button type="button" onClick={addPasso} className="btn-ghost text-xs px-3 py-2 min-h-[36px]">
        <Plus size={13} />
        Adicionar passo
      </button>
    </div>
  )
}
