'use client'

import { useState, useMemo } from 'react'
import { Users, Plus, Search, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { normalizeSearch } from '@/lib/format'
import { criarCliente, atualizarCliente, excluirCliente, type ClienteRow } from '@/app/actions/cliente'

export function ClientesList({ inicial, erro }: { inicial: ClienteRow[]; erro?: string }) {
  const [rows, setRows] = useState<ClienteRow[]>(inicial)
  const [busca, setBusca] = useState('')
  const [msg, setMsg] = useState<string | null>(erro ?? null)

  // form de novo cliente
  const [novoAberto, setNovoAberto] = useState(false)
  const [nNome, setNNome] = useState('')
  const [nContato, setNContato] = useState('')
  const [salvando, setSalvando] = useState(false)

  // edição inline
  const [editId, setEditId] = useState<string | null>(null)
  const [eNome, setENome] = useState('')
  const [eContato, setEContato] = useState('')

  // exclusão
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const filtrados = useMemo(() => {
    const t = normalizeSearch(busca)
    if (!t) return rows
    return rows.filter((c) => normalizeSearch(c.nome).includes(t) || normalizeSearch(c.contato ?? '').includes(t))
  }, [rows, busca])

  function ordena(list: ClienteRow[]) {
    return [...list].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }

  async function salvarNovo() {
    if (!nNome.trim()) { setMsg('Informe o nome do cliente'); return }
    setSalvando(true); setMsg(null)
    const res = await criarCliente({ nome: nNome, contato: nContato })
    setSalvando(false)
    if (res.error || !res.data) { setMsg(res.error ?? 'Erro ao salvar'); return }
    setRows((prev) => ordena([...prev, { id: res.data!.id, nome: nNome.trim(), contato: nContato.trim() || null, created_at: new Date().toISOString() }]))
    setNNome(''); setNContato(''); setNovoAberto(false)
  }

  function iniciarEdicao(c: ClienteRow) {
    setEditId(c.id); setENome(c.nome); setEContato(c.contato ?? ''); setConfirmId(null); setMsg(null)
  }

  async function salvarEdicao(id: string) {
    if (!eNome.trim()) { setMsg('Informe o nome do cliente'); return }
    setBusyId(id); setMsg(null)
    const res = await atualizarCliente(id, { nome: eNome, contato: eContato })
    setBusyId(null)
    if (res.error) { setMsg(res.error); return }
    setRows((prev) => ordena(prev.map((c) => (c.id === id ? { ...c, nome: eNome.trim(), contato: eContato.trim() || null } : c))))
    setEditId(null)
  }

  async function excluir(id: string) {
    setBusyId(id); setMsg(null)
    const res = await excluirCliente(id)
    setBusyId(null)
    if (res.error) { setMsg(res.error); return }
    setRows((prev) => prev.filter((c) => c.id !== id))
    setConfirmId(null)
  }

  const INPUT = 'input-field text-sm py-1.5'

  return (
    <div>
      <PageTitle icon={Users} subtitle="Clientes desta loja — usados no autocomplete de orçamentos e encomendas">Clientes</PageTitle>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
          <input type="text" placeholder="Buscar por nome ou contato…" value={busca} onChange={(e) => setBusca(e.target.value)} className="input-field pl-10" />
        </div>
        <button onClick={() => { setNovoAberto((v) => !v); setMsg(null) }} className="btn-primary shrink-0">
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      {/* Form de novo cliente */}
      {novoAberto && (
        <div className="card-surface p-4 mb-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div className="space-y-1">
            <label className="field-label">Nome *</label>
            <input value={nNome} onChange={(e) => setNNome(e.target.value)} className={INPUT} placeholder="Nome do cliente" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') salvarNovo() }} />
          </div>
          <div className="space-y-1">
            <label className="field-label">Contato</label>
            <input value={nContato} onChange={(e) => setNContato(e.target.value)} className={INPUT} placeholder="Telefone / e-mail / WhatsApp"
              onKeyDown={(e) => { if (e.key === 'Enter') salvarNovo() }} />
          </div>
          <div className="flex gap-2">
            <button onClick={salvarNovo} disabled={salvando} className="btn-primary px-4 disabled:opacity-50">
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvar
            </button>
            <button onClick={() => { setNovoAberto(false); setNNome(''); setNContato('') }} className="px-3 rounded-lg border border-subtle text-ink-soft hover:bg-input text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {msg && <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2 mb-4">{msg}</p>}

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-input flex items-center justify-center mb-4">
            <Users size={28} className="text-secondary/50" />
          </div>
          <p className="text-primary text-base font-playfair mb-1">{rows.length === 0 ? 'Nenhum cliente ainda' : 'Nenhum resultado'}</p>
          <p className="text-secondary text-sm max-w-xs">
            {rows.length === 0 ? 'Cadastre clientes aqui ou eles aparecem sozinhos ao criar orçamentos e encomendas.' : 'Ajuste a busca.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((c) => (
            <div key={c.id} className="card-surface px-5 py-3.5 flex items-center gap-3">
              {editId === c.id ? (
                <>
                  <input value={eNome} onChange={(e) => setENome(e.target.value)} className={`${INPUT} flex-1`} placeholder="Nome"
                    onKeyDown={(e) => { if (e.key === 'Enter') salvarEdicao(c.id); if (e.key === 'Escape') setEditId(null) }} autoFocus />
                  <input value={eContato} onChange={(e) => setEContato(e.target.value)} className={`${INPUT} flex-1`} placeholder="Contato"
                    onKeyDown={(e) => { if (e.key === 'Enter') salvarEdicao(c.id); if (e.key === 'Escape') setEditId(null) }} />
                  <button onClick={() => salvarEdicao(c.id)} disabled={busyId === c.id} className="w-8 h-8 rounded-lg flex items-center justify-center text-accent-primary hover:bg-input shrink-0" aria-label="Salvar">
                    {busyId === c.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={16} />}
                  </button>
                  <button onClick={() => setEditId(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-input shrink-0" aria-label="Cancelar">
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="font-playfair text-primary text-[16px] font-semibold leading-tight truncate">{c.nome}</p>
                    {c.contato && <p className="text-secondary text-xs mt-0.5 truncate">{c.contato}</p>}
                  </div>
                  {confirmId === c.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-red-400 text-xs">Excluir?</span>
                      <button onClick={() => excluir(c.id)} disabled={busyId === c.id} className="text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 rounded-lg px-3 py-1.5">
                        {busyId === c.id ? 'Excluindo…' : 'Sim'}
                      </button>
                      <button onClick={() => setConfirmId(null)} className="text-xs text-secondary hover:text-primary px-2 py-1.5">Não</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => iniciarEdicao(c)} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary/60 hover:text-primary hover:bg-input" aria-label="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => { setConfirmId(c.id); setEditId(null) }} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary/40 hover:text-red-400 hover:bg-red-500/10" aria-label="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
