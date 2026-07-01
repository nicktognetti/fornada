'use client'

import { useState, useMemo } from 'react'
import { Users, Plus, Search, Pencil, Trash2, Check, X, Loader2, Phone, Mail, MapPin, IdCard } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { normalizeSearch } from '@/lib/format'
import { criarCliente, atualizarCliente, excluirCliente, type ClienteRow, type ClienteInput } from '@/app/actions/cliente'

const VAZIO: ClienteInput = { nome: '', telefone: '', email: '', endereco: '', documento: '', observacao: '' }

export function ClientesList({ inicial, erro }: { inicial: ClienteRow[]; erro?: string }) {
  const [rows, setRows] = useState<ClienteRow[]>(inicial)
  const [busca, setBusca] = useState('')
  const [msg, setMsg] = useState<string | null>(erro ?? null)

  // formulário (novo ou edição): editId=null → novo; string → editando aquele id
  const [aberto, setAberto] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<ClienteInput>(VAZIO)
  const [salvando, setSalvando] = useState(false)

  // exclusão
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const filtrados = useMemo(() => {
    const t = normalizeSearch(busca)
    if (!t) return rows
    return rows.filter((c) =>
      normalizeSearch(`${c.nome} ${c.telefone ?? ''} ${c.email ?? ''} ${c.documento ?? ''} ${c.endereco ?? ''}`).includes(t),
    )
  }, [rows, busca])

  function ordena(list: ClienteRow[]) {
    return [...list].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }
  function set<K extends keyof ClienteInput>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function abrirNovo() {
    setEditId(null); setForm(VAZIO); setAberto(true); setMsg(null)
  }
  function abrirEdicao(c: ClienteRow) {
    setEditId(c.id)
    setForm({ nome: c.nome, telefone: c.telefone ?? '', email: c.email ?? '', endereco: c.endereco ?? '', documento: c.documento ?? '', observacao: c.observacao ?? '' })
    setAberto(true); setConfirmId(null); setMsg(null)
  }
  function fechar() {
    setAberto(false); setEditId(null); setForm(VAZIO)
  }

  async function salvar() {
    if (!form.nome.trim()) { setMsg('Informe o nome do cliente'); return }
    setSalvando(true); setMsg(null)
    if (editId) {
      const res = await atualizarCliente(editId, form)
      setSalvando(false)
      if (res.error) { setMsg(res.error); return }
      setRows((prev) => ordena(prev.map((c) => (c.id === editId ? { ...c, ...limpaRow(form) } : c))))
    } else {
      const res = await criarCliente(form)
      setSalvando(false)
      if (res.error || !res.data) { setMsg(res.error ?? 'Erro ao salvar'); return }
      setRows((prev) => ordena([...prev, { id: res.data!.id, created_at: new Date().toISOString(), ...limpaRow(form) }]))
    }
    fechar()
  }

  async function excluir(id: string) {
    setBusyId(id); setMsg(null)
    const res = await excluirCliente(id)
    setBusyId(null)
    if (res.error) { setMsg(res.error); return }
    setRows((prev) => prev.filter((c) => c.id !== id))
    setConfirmId(null)
    if (editId === id) fechar()
  }

  const INPUT = 'input-field text-sm py-1.5'

  return (
    <div>
      <PageTitle icon={Users} subtitle="Clientes desta loja — usados no autocomplete de orçamentos e encomendas">Clientes</PageTitle>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
          <input type="text" placeholder="Buscar por nome, telefone, e-mail…" value={busca} onChange={(e) => setBusca(e.target.value)} className="input-field pl-10" />
        </div>
        <button onClick={aberto && !editId ? fechar : abrirNovo} className="btn-primary shrink-0">
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      {/* Formulário (novo / edição) */}
      {aberto && (
        <div className="card-surface p-5 mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-playfair text-primary text-lg">{editId ? 'Editar cliente' : 'Novo cliente'}</p>
            <button onClick={fechar} className="text-secondary hover:text-primary" aria-label="Fechar"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="field-label">Nome *</label>
              <input value={form.nome} onChange={(e) => set('nome', e.target.value)} className={INPUT} placeholder="Nome do cliente" autoFocus />
            </div>
            <div className="space-y-1">
              <label className="field-label">Telefone / WhatsApp</label>
              <input value={form.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} className={INPUT} placeholder="(19) 90000-0000" inputMode="tel" />
            </div>
            <div className="space-y-1">
              <label className="field-label">E-mail</label>
              <input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} className={INPUT} placeholder="cliente@email.com" inputMode="email" />
            </div>
            <div className="space-y-1">
              <label className="field-label">Endereço</label>
              <input value={form.endereco ?? ''} onChange={(e) => set('endereco', e.target.value)} className={INPUT} placeholder="Rua, nº, bairro" />
            </div>
            <div className="space-y-1">
              <label className="field-label">CPF / CNPJ</label>
              <input value={form.documento ?? ''} onChange={(e) => set('documento', e.target.value)} className={INPUT} placeholder="Documento" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="field-label">Observações</label>
              <textarea value={form.observacao ?? ''} onChange={(e) => set('observacao', e.target.value)} className={`${INPUT} min-h-[56px]`} placeholder="Preferências, restrições, notas…" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={fechar} className="px-4 py-2 rounded-lg border border-subtle text-ink-soft hover:bg-input text-sm">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="btn-primary px-5 disabled:opacity-50">
              {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : <><Check size={15} /> {editId ? 'Salvar alterações' : 'Salvar'}</>}
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
            <div key={c.id} className="card-surface px-5 py-3.5 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-playfair text-primary text-[16px] font-semibold leading-tight truncate">{c.nome}</p>
                <div className="flex items-center gap-x-4 gap-y-0.5 flex-wrap mt-1 text-secondary text-xs">
                  {c.telefone && <span className="inline-flex items-center gap-1"><Phone size={11} className="text-accent-primary/60" />{c.telefone}</span>}
                  {c.email && <span className="inline-flex items-center gap-1"><Mail size={11} className="text-accent-primary/60" />{c.email}</span>}
                  {c.documento && <span className="inline-flex items-center gap-1"><IdCard size={11} className="text-accent-primary/60" />{c.documento}</span>}
                  {c.endereco && <span className="inline-flex items-center gap-1 min-w-0"><MapPin size={11} className="text-accent-primary/60 shrink-0" /><span className="truncate">{c.endereco}</span></span>}
                </div>
                {c.observacao && <p className="text-faint text-xs mt-1 truncate">{c.observacao}</p>}
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
                  <button onClick={() => abrirEdicao(c)} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary/60 hover:text-primary hover:bg-input" aria-label="Editar">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => { setConfirmId(c.id) }} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary/40 hover:text-red-400 hover:bg-red-500/10" aria-label="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Converte o input do formulário em campos de linha (trim → null).
function limpaRow(f: ClienteInput): Omit<ClienteRow, 'id' | 'created_at'> {
  return {
    nome: f.nome.trim(),
    telefone: f.telefone?.trim() || null,
    email: f.email?.trim() || null,
    endereco: f.endereco?.trim() || null,
    documento: f.documento?.trim() || null,
    observacao: f.observacao?.trim() || null,
  }
}
