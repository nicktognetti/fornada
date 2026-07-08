'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronDown, Pencil, Clock, ListOrdered, Lightbulb } from 'lucide-react'
import { SectionLabel } from '@/app/components/ui/section-label'
import { UnidadeMedidaSelector } from '@/app/components/ui/unidade-medida-selector'
import { PassosEditor } from '@/app/dashboard/receitas/components/passos-editor'
import { SetorField } from '@/app/dashboard/receitas/components/setor-field'
import { createReceitaCaderno } from '@/app/dashboard/receitas/actions'

interface Props {
  onClose: () => void
}

const UNIDADES = [
  { value: 'g',  label: 'g',  nome: 'grama' },
  { value: 'kg', label: 'kg', nome: 'quilograma' },
  { value: 'ml', label: 'ml', nome: 'mililitro' },
  { value: 'l',  label: 'l',  nome: 'litro' },
  { value: 'un', label: 'un', nome: 'unidade' },
]

const DIFICULDADES = [
  { value: '', label: 'Não informar' },
  { value: 'facil', label: 'Fácil' },
  { value: 'media', label: 'Média' },
  { value: 'dificil', label: 'Difícil' },
]

function toInt(v: string): number | null {
  const n = parseInt(v.replace(/\D/g, ''), 10)
  return !isNaN(n) && n > 0 ? n : null
}

export function NovaReceitaModal({ onClose }: Props) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('')
  const [rendimento, setRendimento] = useState('')
  const [unidade, setUnidade] = useState<'g' | 'kg' | 'ml' | 'l' | 'un'>('un')
  const [passos, setPassos] = useState<string[]>([''])
  const [prep, setPrep] = useState('')
  const [tempC, setTempC] = useState('')
  const [tempMin, setTempMin] = useState('')
  const [dificuldade, setDificuldade] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setErro('')
    setSalvando(true)
    const res = await createReceitaCaderno({
      nome: nome.trim(),
      categoria: categoria.trim() || null,
      rendimento,
      rendimento_unidade: unidade,
      passos: passos.map((p) => p.trim()).filter(Boolean),
      tempo_preparo_min: toInt(prep),
      temperatura_forno: toInt(tempC),
      tempo_forno_min: toInt(tempMin),
      dificuldade: (dificuldade || null) as 'facil' | 'media' | 'dificil' | null,
      observacao: observacao.trim() || null,
    })
    setSalvando(false)
    if (res.error || !res.id) { setErro(res.error ?? 'Erro ao criar receita'); return }
    // Vai direto pra receita nova, onde a produção adiciona os ingredientes.
    router.push(`/dashboard/caderno/${res.id}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl border border-accent-primary/12 shadow-[0_8px_40px_rgba(0,0,0,0.12)] w-full max-w-2xl max-h-[92vh] flex flex-col">

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-accent-primary/10 shrink-0">
          <div>
            <h2 className="font-playfair text-primary text-[22px] font-bold leading-tight">Nova Receita</h2>
            <p className="text-secondary text-xs mt-0.5">os ingredientes você adiciona no próximo passo</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-accent-primary hover:bg-accent-primary/10 transition-all" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          <div className="space-y-5">
            <SectionLabel icon={Pencil}>Dados da receita</SectionLabel>
            <div>
              <label className="field-label">Nome</label>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Bolo de cenoura, Brigadeiro…" className="input-field" />
            </div>
            <div>
              <label className="field-label">Setor <span className="normal-case font-normal text-secondary/70">(opcional)</span></label>
              <SetorField value={categoria} onChange={setCategoria} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Rendimento</label>
                <input type="text" inputMode="decimal" value={rendimento} onChange={(e) => setRendimento(e.target.value)} placeholder="Ex: 12" className="input-field" />
              </div>
              <div>
                <label className="field-label">Unidade</label>
                <UnidadeMedidaSelector name="rendimento_unidade" options={UNIDADES} defaultValue={unidade} onChange={(v) => setUnidade(v as typeof unidade)} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <SectionLabel icon={Clock}>Tempos e forno <span className="normal-case font-normal text-secondary/70">(opcional)</span></SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><label className="field-label">Preparo (min)</label><input type="text" inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="25" className="input-field" /></div>
              <div><label className="field-label">Forno (°C)</label><input type="text" inputMode="numeric" value={tempC} onChange={(e) => setTempC(e.target.value)} placeholder="180" className="input-field" /></div>
              <div><label className="field-label">Forno (min)</label><input type="text" inputMode="numeric" value={tempMin} onChange={(e) => setTempMin(e.target.value)} placeholder="40" className="input-field" /></div>
              <div>
                <label className="field-label">Dificuldade</label>
                <div className="relative">
                  <select value={dificuldade} onChange={(e) => setDificuldade(e.target.value)} className="input-field appearance-none pr-8">
                    {DIFICULDADES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <SectionLabel icon={ListOrdered}>Modo de preparo</SectionLabel>
            <PassosEditor passos={passos} onChange={setPassos} />
          </div>

          <div className="space-y-3">
            <SectionLabel icon={Lightbulb}>Dica / segredo da casa <span className="normal-case font-normal text-secondary/70">(opcional)</span></SectionLabel>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: não abra o forno nos primeiros 25 min ou o bolo sola."
              rows={2} className="input-field resize-none" />
          </div>

          {erro && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400 text-sm">{erro}</div>}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-accent-primary/10 shrink-0">
          <button type="button" onClick={onClose} className="btn-ghost flex-1" disabled={salvando}>Cancelar</button>
          <button type="button" onClick={salvar} disabled={salvando} className="btn-primary flex-1">{salvando ? 'Criando…' : 'Criar e adicionar ingredientes'}</button>
        </div>
      </div>
    </div>
  )
}
