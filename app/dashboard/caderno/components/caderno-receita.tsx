'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { CozinhaView } from '@/app/dashboard/receitas/[id]/cozinha/cozinha-view'
import { ModoPreparoModal } from './modo-preparo-modal'
import type { Receita } from '@/app/dashboard/receitas/types'

interface Ingrediente {
  id: string
  nome: string
  quantidade: number
  unidade: string
}

interface Props {
  receita: Receita
  ingredientes: Ingrediente[]
  podeEditar: boolean
}

export function CadernoReceita({ receita, ingredientes, podeEditar }: Props) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <CozinhaView
        receita={receita}
        ingredientes={ingredientes}
        voltarHref="/dashboard/caderno"
        voltarLabel="Voltar ao caderno"
        acaoExtra={
          podeEditar ? (
            <button onClick={() => setEditOpen(true)} className="btn-ghost text-xs px-3 py-2 min-h-[36px]">
              <Pencil size={13} />
              Editar modo de fazer
            </button>
          ) : undefined
        }
      />
      {editOpen && <ModoPreparoModal receita={receita} onClose={() => setEditOpen(false)} />}
    </>
  )
}
