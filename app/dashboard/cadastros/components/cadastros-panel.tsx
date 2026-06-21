'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, X, Settings2, Weight, Tag, Check, AlertCircle } from 'lucide-react'
import { getConfigAction, saveConfigAction } from '@/app/actions/config'
import { usePermission } from '@/app/context/permissions-context'

type TabId = 'tipos' | 'unidades' | 'categorias'

const SEED_TIPOS = [
  'Final — produto de venda',
  'Base — preparo intermediário',
  'Massa',
  'Recheio',
  'Cobertura',
  'Calda',
]

const SEED_UNIDADES = [
  { label: 'g',   nome: 'grama'        },
  { label: 'kg',  nome: 'quilograma'   },
  { label: 'ml',  nome: 'mililitro'    },
  { label: 'L',   nome: 'litro'        },
  { label: 'un',  nome: 'unidade'      },
  { label: 'cx',  nome: 'caixa'        },
  { label: 'pct', nome: 'pacote'       },
]

const SEED_CATEGORIAS = [
  'Farinhas', 'Gorduras', 'Laticínios', 'Frutas',
  'Fermentos', 'Açúcares', 'Chocolates', 'Embalagens', 'Outros', 'Revisar',
]

type Unidade = { label: string; nome: string }

type Toast = { type: 'success' | 'error'; message: string }

export function CadastrosPanel() {
  const { canWrite, isLoading: isLoadingPerm } = usePermission('cadastros')
  // Nunca mostrar ações destrutivas enquanto permissão não resolveu
  const canEdit = !isLoadingPerm && canWrite

  const [activeTab, setActiveTab] = useState<TabId>('tipos')

  const [tipos, setTipos] = useState<string[]>(SEED_TIPOS)
  const [novoTipo, setNovoTipo] = useState('')
  const tipoInputRef = useRef<HTMLInputElement>(null)

  const [unidades, setUnidades] = useState<Unidade[]>(SEED_UNIDADES)
  const [novaLabel, setNovaLabel] = useState('')
  const [novaNome, setNovaNome] = useState('')

  const [categorias, setCategorias] = useState<string[]>(SEED_CATEGORIAS)
  const [novaCategoria, setNovaCategoria] = useState('')
  const catInputRef = useRef<HTMLInputElement>(null)

  const [isLoadingConfig, setIsLoadingConfig] = useState(true)
  const [toast, setToast] = useState<Toast | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(type: Toast['type'], message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ type, message })
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }

  // Carrega configurações do banco no mount
  useEffect(() => {
    let mounted = true
    async function loadConfigs() {
      const [tiposRes, unidadesRes, categoriasRes] = await Promise.all([
        getConfigAction<string[]>('tipos_receita'),
        getConfigAction<Unidade[]>('unidades_medida'),
        getConfigAction<string[]>('categorias_insumo'),
      ])

      if (!mounted) return

      if (tiposRes.data) setTipos(tiposRes.data)
      if (unidadesRes.data) setUnidades(unidadesRes.data)
      if (categoriasRes.data) setCategorias(categoriasRes.data)
      setIsLoadingConfig(false)
    }
    loadConfigs()
    return () => { mounted = false }
  }, [])

  async function saveTipos(next: string[]) {
    setTipos(next)
    setIsSaving(true)
    try {
      const res = await saveConfigAction('tipos_receita', next)
      if (res.error) showToast('error', res.error)
      else showToast('success', 'Tipos salvos')
    } finally {
      setIsSaving(false)
    }
  }

  async function saveUnidades(next: Unidade[]) {
    setUnidades(next)
    setIsSaving(true)
    try {
      const res = await saveConfigAction('unidades_medida', next)
      if (res.error) showToast('error', res.error)
      else showToast('success', 'Unidades salvas')
    } finally {
      setIsSaving(false)
    }
  }

  async function saveCategorias(next: string[]) {
    setCategorias(next)
    setIsSaving(true)
    try {
      const res = await saveConfigAction('categorias_insumo', next)
      if (res.error) showToast('error', res.error)
      else showToast('success', 'Categorias salvas')
    } finally {
      setIsSaving(false)
    }
  }

  function addTipo() {
    const v = novoTipo.trim()
    if (!v || tipos.includes(v)) return
    saveTipos([...tipos, v])
    setNovoTipo('')
    tipoInputRef.current?.focus()
  }

  function removeTipo(tipo: string) {
    saveTipos(tipos.filter((x) => x !== tipo))
  }

  function addUnidade() {
    const l = novaLabel.trim()
    const n = novaNome.trim()
    if (!l || !n || unidades.some((u) => u.label === l)) return
    saveUnidades([...unidades, { label: l, nome: n }])
    setNovaLabel('')
    setNovaNome('')
  }

  function removeUnidade(label: string) {
    saveUnidades(unidades.filter((x) => x.label !== label))
  }

  function addCategoria() {
    const v = novaCategoria.trim()
    if (!v || categorias.includes(v)) return
    saveCategorias([...categorias, v].sort())
    setNovaCategoria('')
    catInputRef.current?.focus()
  }

  function removeCategoria(cat: string) {
    saveCategorias(categorias.filter((x) => x !== cat))
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'tipos',      label: 'Tipos de Receita',     icon: <Settings2 size={14} /> },
    { id: 'unidades',   label: 'Unidades de Medida',   icon: <Weight size={14} />    },
    { id: 'categorias', label: 'Categorias de Insumo', icon: <Tag size={14} />       },
  ]

  const count =
    activeTab === 'tipos' ? `${tipos.length} tipo${tipos.length !== 1 ? 's' : ''}` :
    activeTab === 'unidades' ? `${unidades.length} unidade${unidades.length !== 1 ? 's' : ''}` :
    `${categorias.length} categoria${categorias.length !== 1 ? 's' : ''}`

  return (
    <div className="max-w-2xl space-y-5">
      {/* Toast */}
      {toast && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 border"
          style={{
            backgroundColor: toast.type === 'success' ? 'var(--t-success-tint, color-mix(in srgb, #5f9a5f 10%, transparent))' : 'color-mix(in srgb, #c74a4a 10%, transparent)',
            borderColor: toast.type === 'success' ? 'color-mix(in srgb, #5f9a5f 25%, transparent)' : 'color-mix(in srgb, #c74a4a 25%, transparent)',
          }}
        >
          {toast.type === 'success'
            ? <Check size={15} className="shrink-0" style={{ color: '#5f9a5f' }} />
            : <AlertCircle size={15} className="shrink-0 text-red-400" />
          }
          <p className="text-sm" style={{ color: toast.type === 'success' ? '#5f9a5f' : '#f87171' }}>
            {toast.message}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--t-input-bg)', border: '1px solid var(--t-input-border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all"
            style={{
              backgroundColor: activeTab === tab.id ? 'var(--t-card-bg)' : 'transparent',
              color: activeTab === tab.id ? 'var(--t-accent)' : 'var(--t-text-2)',
              boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TIPOS */}
      {activeTab === 'tipos' && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--t-border-sub)', backgroundColor: 'var(--t-inset-bg)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--t-accent)' }}>Tipos de Receita</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-2)' }}>Classificação usada ao criar fichas técnicas.</p>
          </div>
          {isLoadingConfig ? (
            <div className="px-5 py-6 flex justify-center">
              <span className="text-xs" style={{ color: 'var(--t-text-2)' }}>Carregando…</span>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 flex flex-wrap gap-2">
                {tipos.map((tipo) => (
                  <span key={tipo} className="inline-flex items-center gap-1.5 rounded-full text-sm font-medium" style={{ paddingLeft: '0.75rem', paddingRight: canEdit ? '0.5rem' : '0.75rem', paddingTop: '0.375rem', paddingBottom: '0.375rem', backgroundColor: 'color-mix(in srgb, var(--t-accent) 10%, transparent)', color: 'var(--t-accent)', border: '1px solid color-mix(in srgb, var(--t-accent) 25%, transparent)' }}>
                    {tipo}
                    {canEdit && (
                      <button onClick={() => removeTipo(tipo)} disabled={isSaving} className="w-4 h-4 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity">
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {canEdit && (
                <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--t-border-sub)' }}>
                  <input ref={tipoInputRef} type="text" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTipo())} placeholder="Novo tipo… (ex: Glacê)" className="input-field flex-1" disabled={isSaving} />
                  <button onClick={addTipo} disabled={isSaving} className="btn-primary px-4 min-h-[40px]"><Plus size={15} />Adicionar</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* UNIDADES */}
      {activeTab === 'unidades' && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--t-border-sub)', backgroundColor: 'var(--t-inset-bg)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--t-accent)' }}>Unidades de Medida</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-2)' }}>Unidades disponíveis nos seletores de insumos e receitas.</p>
          </div>
          {isLoadingConfig ? (
            <div className="px-5 py-6 flex justify-center">
              <span className="text-xs" style={{ color: 'var(--t-text-2)' }}>Carregando…</span>
            </div>
          ) : (
            <>
              <div className="divide-y" style={{ borderColor: 'var(--t-border-sub)' }}>
                {unidades.map((u) => (
                  <div key={u.label} className="flex items-center gap-3 px-5 py-3">
                    <span className="font-mono font-bold text-sm w-10 shrink-0" style={{ color: 'var(--t-accent)' }}>{u.label}</span>
                    <span className="text-sm flex-1" style={{ color: 'var(--t-text-2)' }}>{u.nome}</span>
                    {canEdit && (
                      <button onClick={() => removeUnidade(u.label)} disabled={isSaving} className="w-7 h-7 rounded-lg flex items-center justify-center opacity-40 hover:opacity-100 hover:text-red-400 transition-all" style={{ color: 'var(--t-text-2)' }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--t-border-sub)' }}>
                  <input type="text" value={novaLabel} onChange={(e) => setNovaLabel(e.target.value)} placeholder="Sigla (ex: dz)" className="input-field w-28" disabled={isSaving} />
                  <input type="text" value={novaNome} onChange={(e) => setNovaNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUnidade())} placeholder="Nome completo (ex: dúzia)" className="input-field flex-1" disabled={isSaving} />
                  <button onClick={addUnidade} disabled={isSaving} className="btn-primary px-4 shrink-0" style={{ minHeight: 40 }}><Plus size={15} /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CATEGORIAS */}
      {activeTab === 'categorias' && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--t-border-sub)', backgroundColor: 'var(--t-inset-bg)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--t-accent)' }}>Categorias de Insumo</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-2)' }}>Agrupamentos para filtrar e organizar os insumos.</p>
          </div>
          {isLoadingConfig ? (
            <div className="px-5 py-6 flex justify-center">
              <span className="text-xs" style={{ color: 'var(--t-text-2)' }}>Carregando…</span>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 flex flex-wrap gap-2">
                {categorias.map((cat) => (
                  <span key={cat} className="inline-flex items-center gap-1.5 rounded-full text-sm font-medium" style={{ paddingLeft: '0.75rem', paddingRight: canEdit ? '0.5rem' : '0.75rem', paddingTop: '0.375rem', paddingBottom: '0.375rem', backgroundColor: 'var(--t-input-bg)', color: 'var(--t-text-1)', border: '1px solid var(--t-input-border)' }}>
                    {cat}
                    {canEdit && (
                      <button onClick={() => removeCategoria(cat)} disabled={isSaving} className="w-4 h-4 rounded-full flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity">
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {canEdit && (
                <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--t-border-sub)' }}>
                  <input ref={catInputRef} type="text" value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategoria())} placeholder="Nova categoria… (ex: Sementes)" className="input-field flex-1" disabled={isSaving} />
                  <button onClick={addCategoria} disabled={isSaving} className="btn-primary px-4 shrink-0" style={{ minHeight: 40 }}><Plus size={15} />Adicionar</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <p className="text-xs text-right" style={{ color: 'var(--t-text-2)', opacity: 0.5 }}>{count}</p>
    </div>
  )
}
