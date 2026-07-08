'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Flame, Gauge, Check, RotateCcw, ListChecks, Tag } from 'lucide-react'
import type { Receita, Dificuldade } from '../../types'

interface Ingrediente {
  id: string
  nome: string
  quantidade: number
  unidade: string
}

interface Props {
  receita: Receita
  ingredientes: Ingrediente[]
  voltarHref: string
  voltarLabel: string
  acaoExtra?: React.ReactNode
}

const DIFICULDADE_LABEL: Record<Dificuldade, string> = { facil: 'Fácil', media: 'Média', dificil: 'Difícil' }

export function CozinhaView({ receita, ingredientes, voltarHref, voltarLabel, acaoExtra }: Props) {
  const passos = receita.passos ?? []
  const [ingMarcados, setIngMarcados] = useState<Set<string>>(new Set())
  const [passosFeitos, setPassosFeitos] = useState<Set<number>>(new Set())

  function toggleIng(id: string) {
    setIngMarcados((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  function togglePasso(i: number) {
    setPassosFeitos((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
  }
  function limpar() {
    setIngMarcados(new Set())
    setPassosFeitos(new Set())
  }

  const temForno = receita.temperatura_forno != null || receita.tempo_forno_min != null
  const temChips = receita.tempo_preparo_min != null || temForno || receita.dificuldade

  return (
    <div className="max-w-5xl mx-auto">
      {/* Barra superior */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <Link
          href={voltarHref}
          className="inline-flex items-center gap-1.5 text-secondary hover:text-accent-primary text-sm transition-all hover:-translate-x-0.5"
        >
          <ArrowLeft size={16} />
          {voltarLabel}
        </Link>
        <div className="flex items-center gap-2">
          {acaoExtra}
          <button onClick={limpar} className="btn-ghost text-xs px-3 py-2 min-h-[36px]">
            <RotateCcw size={13} />
            Recomeçar
          </button>
        </div>
      </div>

      {/* Cabeçalho da receita */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-6">
        {receita.foto_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={receita.foto_url} alt={receita.nome}
            className="w-full sm:w-40 h-44 sm:h-40 rounded-2xl object-cover border border-subtle shrink-0" />
        )}
        <div className="min-w-0">
          {receita.categoria?.trim() && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-primary/12 text-accent-primary border border-accent-primary/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide mb-2">
              <Tag size={11} /> {receita.categoria.trim()}
            </span>
          )}
          <h1 className="font-playfair text-primary text-[32px] sm:text-[42px] font-bold leading-tight">
            {receita.nome}
          </h1>
          <p className="text-secondary text-sm mt-1">
            Rende {receita.rendimento} {receita.rendimento_unidade}
          </p>
          {temChips && (
            <div className="flex flex-wrap gap-2 mt-3">
              {receita.tempo_preparo_min != null && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-input border border-subtle px-3 py-2 text-sm text-primary">
                  <Clock size={15} className="text-accent-primary" /> Preparo {receita.tempo_preparo_min} min
                </span>
              )}
              {temForno && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-input border border-subtle px-3 py-2 text-sm text-primary">
                  <Flame size={15} className="text-accent-primary" /> Forno
                  {receita.temperatura_forno != null && ` ${receita.temperatura_forno}°C`}
                  {receita.tempo_forno_min != null && ` · ${receita.tempo_forno_min} min`}
                </span>
              )}
              {receita.dificuldade && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-input border border-subtle px-3 py-2 text-sm text-primary">
                  <Gauge size={15} className="text-accent-primary" /> {DIFICULDADE_LABEL[receita.dificuldade]}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dica / segredo */}
      {receita.observacao && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 mb-6">
          <p className="text-amber-200 text-base leading-relaxed">
            <span className="font-semibold">Segredo da casa: </span>{receita.observacao}
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-5 items-start">
        {/* Ingredientes */}
        <div className="card-surface overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-accent-primary/10 bg-input">
            <ListChecks size={16} className="text-accent-primary" />
            <span className="text-accent-primary text-xs uppercase tracking-widest font-semibold">Ingredientes</span>
          </div>
          {ingredientes.length === 0 ? (
            <p className="text-secondary text-sm px-5 py-8 text-center">Nenhum ingrediente cadastrado.</p>
          ) : (
            <ul className="divide-y divide-accent-primary/8">
              {ingredientes.map((ing) => {
                const marcado = ingMarcados.has(ing.id)
                return (
                  <li key={ing.id}>
                    <button
                      onClick={() => toggleIng(ing.id)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-accent-primary/3 transition-colors"
                    >
                      <span className={`shrink-0 w-6 h-6 rounded-md border flex items-center justify-center transition-all ${marcado ? 'bg-accent-primary border-accent-primary text-white' : 'border-subtle'}`}>
                        {marcado && <Check size={15} />}
                      </span>
                      <span className={`text-[17px] leading-snug transition-all ${marcado ? 'text-secondary/50 line-through' : 'text-primary'}`}>
                        <span className="tabular-nums font-semibold">{ing.quantidade} {ing.unidade}</span> · {ing.nome}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Passos */}
        <div className="card-surface overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-accent-primary/10 bg-input">
            <span className="text-accent-primary text-xs uppercase tracking-widest font-semibold">Modo de preparo</span>
            {passos.length > 0 && (
              <span className="text-secondary/60 text-xs ml-auto tabular-nums">
                {passosFeitos.size}/{passos.length}
              </span>
            )}
          </div>
          {passos.length === 0 ? (
            <p className="text-secondary text-sm px-5 py-8 text-center">
              Nenhum passo cadastrado. Edite a ficha para escrever o modo de preparo.
            </p>
          ) : (
            <ol className="divide-y divide-accent-primary/8">
              {passos.map((passo, i) => {
                const feito = passosFeitos.has(i)
                return (
                  <li key={i}>
                    <button
                      onClick={() => togglePasso(i)}
                      className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-accent-primary/3 transition-colors"
                    >
                      <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold tabular-nums transition-all ${feito ? 'bg-accent-primary text-white' : 'bg-accent-primary/15 text-accent-primary'}`}>
                        {feito ? <Check size={18} /> : i + 1}
                      </span>
                      <span className={`text-[18px] leading-relaxed pt-1 transition-all ${feito ? 'text-secondary/50 line-through' : 'text-primary'}`}>
                        {passo}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
