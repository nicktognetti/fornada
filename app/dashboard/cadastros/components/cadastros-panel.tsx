'use client'

import { useState, useRef } from 'react'
import { Plus, X, Settings2, Weight, Tag, Info } from 'lucide-react'

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

interface Props {
  dbCategorias: string[]
}

export function CadastrosPanel({ dbCategorias }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('tipos')

  const [tipos, setTipos] = useState<string[]>(SEED_TIPOS)
  const [novoTipo, setNovoTipo] = useState('')
  const tipoInputRef = useRef<HTMLInputElement>(null)

  const [unidades, setUnidades] = useState(SEED_UNIDADES)
  const [novaLabel, setNovaLabel] = useState('')
  const [novaNome, setNovaNome] = useState('')

  const [categorias, setCategorias] = useState<string[]>(() =>
    [...new Set([...SEED_CATEGORIAS, ...dbCategorias])].sort()
  )
  const [novaCategoria, setNovaCategoria] = useState('')
  const catInputRef = useRef<HTMLInputElement>(null)

  function addTipo() {
    const v = novoTipo.trim()
    if (!v || tipos.includes(v)) return
    setTipos((t) => [...t, v])
    setNovoTipo('')
    tipoInputRef.current?.focus()
  }

  function addUnidade() {
    const l = novaLabel.trim()
    const n = novaNome.trim()
    if (!l || !n || unidades.some((u) => u.label === l)) return
    setUnidades((u) => [...u, { label: l, nome: n }])
    setNovaLabel('')
    setNovaNome('')
  }

  function addCategoria() {
    const v = novaCategoria.trim()
    if (!v || categorias.includes(v)) return
    setCategorias((c) => [...c, v].sort())
    setNovaCategoria('')
    catInputRef.current?.focus()
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
      {/* Aviso de persistência */}
      <div className="flex items-start gap-3 rounded-xl px-4 py-3 border border-blue-500/20 bg-blue-500/8">
        <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />
        <p className="text-blue-400/80 text-sm">
          As alterações ficam salvas nesta sessão. A persistência no banco de dados será
          ativada após a criação das tabelas de configuração.
        </p>
      </div>

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
          <div className="px-5 py-4 flex flex-wrap gap-2">
            {tipos.map((tipo) => (
              <span key={tipo} className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--t-accent) 10%, transparent)', color: 'var(--t-accent)', border: '1px solid color-mix(in srgb, var(--t-accent) 25%, transparent)' }}>
                {tipo}
                <button onClick={() => setTipos((t) => t.filter((x) => x !== tipo))} className="w-4 h-4 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--t-border-sub)' }}>
            <input ref={tipoInputRef} type="text" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTipo())} placeholder="Novo tipo… (ex: Glacê)" className="input-field flex-1" />
            <button onClick={addTipo} className="btn-primary px-4 min-h-[40px]"><Plus size={15} />Adicionar</button>
          </div>
        </div>
      )}

      {/* UNIDADES */}
      {activeTab === 'unidades' && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--t-border-sub)', backgroundColor: 'var(--t-inset-bg)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--t-accent)' }}>Unidades de Medida</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-2)' }}>Unidades disponíveis nos seletores de insumos e receitas.</p>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--t-border-sub)' }}>
            {unidades.map((u) => (
              <div key={u.label} className="flex items-center gap-3 px-5 py-3">
                <span className="font-mono font-bold text-sm w-10 shrink-0" style={{ color: 'var(--t-accent)' }}>{u.label}</span>
                <span className="text-sm flex-1" style={{ color: 'var(--t-text-2)' }}>{u.nome}</span>
                <button onClick={() => setUnidades((arr) => arr.filter((x) => x.label !== u.label))} className="w-7 h-7 rounded-lg flex items-center justify-center opacity-40 hover:opacity-100 hover:text-red-400 transition-all" style={{ color: 'var(--t-text-2)' }}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--t-border-sub)' }}>
            <input type="text" value={novaLabel} onChange={(e) => setNovaLabel(e.target.value)} placeholder="Sigla (ex: dz)" className="input-field w-28" />
            <input type="text" value={novaNome} onChange={(e) => setNovaNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUnidade())} placeholder="Nome completo (ex: dúzia)" className="input-field flex-1" />
            <button onClick={addUnidade} className="btn-primary px-4 shrink-0" style={{ minHeight: 40 }}><Plus size={15} /></button>
          </div>
        </div>
      )}

      {/* CATEGORIAS */}
      {activeTab === 'categorias' && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--t-border-sub)', backgroundColor: 'var(--t-inset-bg)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--t-accent)' }}>Categorias de Insumo</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-2)' }}>Agrupamentos para filtrar e organizar os insumos.</p>
          </div>
          <div className="px-5 py-4 flex flex-wrap gap-2">
            {categorias.map((cat) => (
              <span key={cat} className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm font-medium" style={{ backgroundColor: 'var(--t-input-bg)', color: 'var(--t-text-1)', border: '1px solid var(--t-input-border)' }}>
                {cat}
                <button onClick={() => setCategorias((c) => c.filter((x) => x !== cat))} className="w-4 h-4 rounded-full flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--t-border-sub)' }}>
            <input ref={catInputRef} type="text" value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategoria())} placeholder="Nova categoria… (ex: Sementes)" className="input-field flex-1" />
            <button onClick={addCategoria} className="btn-primary px-4 shrink-0" style={{ minHeight: 40 }}><Plus size={15} />Adicionar</button>
          </div>
        </div>
      )}

      <p className="text-xs text-right" style={{ color: 'var(--t-text-2)', opacity: 0.5 }}>{count}</p>
    </div>
  )
}
