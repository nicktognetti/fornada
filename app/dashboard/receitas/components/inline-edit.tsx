'use client'

/**
 * Edição inline da ficha: clicou no valor, virou campo.
 * Enter/blur salva · Esc cancela · pãozinho enquanto salva.
 * A tela de edição completa (modal) continua existindo ao lado.
 */

import { useEffect, useRef, useState } from 'react'
import { PaozinhoMini } from '@/app/components/ui/paozinho'

interface InlineProps {
  value: string
  onSave: (novo: string) => Promise<string | null> // retorna mensagem de erro ou null
  className?: string
  inputClassName?: string
  numeric?: boolean
  title?: string
}

export function InlineEdit({ value, onSave, className = '', inputClassName = '', numeric = false, title }: InlineProps) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(value)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelou = useRef(false)

  useEffect(() => { setTexto(value) }, [value])
  useEffect(() => {
    if (editando) { inputRef.current?.focus(); inputRef.current?.select() }
  }, [editando])

  async function salvar() {
    if (cancelou.current) { cancelou.current = false; setEditando(false); setTexto(value); return }
    const novo = texto.trim()
    setEditando(false)
    if (!novo || novo === value) { setTexto(value); return }
    setSalvando(true)
    setErro('')
    const msg = await onSave(novo)
    setSalvando(false)
    if (msg) { setErro(msg); setTexto(value) }
  }

  if (salvando) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <PaozinhoMini /> <span className="opacity-60">{texto}</span>
      </span>
    )
  }

  if (editando) {
    return (
      <input
        ref={inputRef}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') { cancelou.current = true; (e.target as HTMLInputElement).blur() }
        }}
        type="text"
        inputMode={numeric ? 'decimal' : undefined}
        className={`bg-input border border-accent-primary/40 rounded-lg px-2 py-0.5 text-primary outline-none focus:border-accent-primary ${inputClassName}`}
      />
    )
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={() => { setErro(''); setEditando(true) }}
        title={title ?? 'Clique para editar'}
        className={`text-left cursor-text rounded-lg -mx-1 px-1 hover:bg-accent-primary/10 hover:ring-1 hover:ring-accent-primary/25 transition-colors ${className}`}
      >
        {value}
      </button>
      {erro && <span className="text-red-400 text-[11px] mt-0.5">{erro}</span>}
    </span>
  )
}

// ─── Troca de ingrediente inline ────────────────────────────────────────────

export interface OpcaoIngrediente {
  id: string
  nome: string
  tipo: 'insumo' | 'sub'
}

interface SwapProps {
  nomeAtual: string
  carregarOpcoes: () => Promise<OpcaoIngrediente[]>
  onTrocar: (op: OpcaoIngrediente) => Promise<string | null>
  className?: string
}

export function IngredienteSwap({ nomeAtual, carregarOpcoes, onTrocar, className = '' }: SwapProps) {
  const [aberto, setAberto] = useState(false)
  const [opcoes, setOpcoes] = useState<OpcaoIngrediente[] | null>(null)
  const [filtro, setFiltro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    if (!opcoes) carregarOpcoes().then(setOpcoes)
    function fora(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto, opcoes, carregarOpcoes])

  async function escolher(op: OpcaoIngrediente) {
    setAberto(false)
    setSalvando(true)
    setErro('')
    const msg = await onTrocar(op)
    setSalvando(false)
    if (msg) setErro(msg)
  }

  if (salvando) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <PaozinhoMini /> <span className="opacity-60">{nomeAtual}</span>
      </span>
    )
  }

  const lista = (opcoes ?? []).filter((o) => o.nome.toLowerCase().includes(filtro.toLowerCase()))

  return (
    <span className="relative inline-flex flex-col min-w-0" ref={boxRef as never}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        title="Clique para trocar o ingrediente"
        className={`text-left truncate rounded-lg -mx-1 px-1 hover:bg-accent-primary/10 hover:ring-1 hover:ring-accent-primary/25 transition-colors ${className}`}
      >
        {nomeAtual}
      </button>
      {erro && <span className="text-red-400 text-[11px] mt-0.5">{erro}</span>}
      {aberto && (
        <div className="absolute left-0 top-full z-40 mt-1 w-72 max-w-[80vw] rounded-xl border border-subtle bg-surface shadow-xl overflow-hidden">
          <input
            autoFocus
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setAberto(false) }}
            placeholder="Buscar ingrediente…"
            className="w-full bg-input px-3 py-2 text-sm text-primary outline-none border-b border-subtle"
          />
          <div className="max-h-56 overflow-y-auto">
            {opcoes === null ? (
              <div className="flex items-center gap-2 px-3 py-3 text-secondary text-xs"><PaozinhoMini /> carregando…</div>
            ) : lista.length === 0 ? (
              <div className="px-3 py-3 text-secondary text-xs">Nada encontrado.</div>
            ) : (
              lista.slice(0, 80).map((o) => (
                <button
                  key={`${o.tipo}-${o.id}`}
                  type="button"
                  onClick={() => escolher(o)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-accent-primary/10"
                >
                  <span className="truncate">{o.nome}</span>
                  {o.tipo === 'sub' && (
                    <span className="shrink-0 rounded-full border border-blue-500/25 bg-blue-500/15 px-1.5 text-[10px] text-blue-400 italic">sub</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </span>
  )
}
