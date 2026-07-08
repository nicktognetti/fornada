'use client'

import { useRef, useState } from 'react'
import { X, ChevronDown, Clock, ListOrdered, Lightbulb, Camera, Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { SectionLabel } from '@/app/components/ui/section-label'
import { PassosEditor } from '@/app/dashboard/receitas/components/passos-editor'
import { updateModoPreparo, uploadReceitaFoto, removeReceitaFoto } from '@/app/dashboard/receitas/actions'
import type { Receita } from '@/app/dashboard/receitas/types'

interface Props {
  receita: Receita
  onClose: () => void
}

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

export function ModoPreparoModal({ receita, onClose }: Props) {
  const router = useRouter()
  const [passos, setPassos] = useState<string[]>(receita.passos?.length ? receita.passos : [''])
  const [prep, setPrep] = useState(receita.tempo_preparo_min?.toString() ?? '')
  const [tempC, setTempC] = useState(receita.temperatura_forno?.toString() ?? '')
  const [tempMin, setTempMin] = useState(receita.tempo_forno_min?.toString() ?? '')
  const [dificuldade, setDificuldade] = useState(receita.dificuldade ?? '')
  const [observacao, setObservacao] = useState(receita.observacao ?? '')
  const [fotoUrl, setFotoUrl] = useState<string | null>(receita.foto_url)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const fotoInputRef = useRef<HTMLInputElement>(null)

  async function onFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setErro('Imagem muito grande (máx. 5 MB)'); return }
    setErro('')
    setEnviandoFoto(true)
    const fd = new FormData()
    fd.append('foto', file)
    const res = await uploadReceitaFoto(receita.id, fd)
    setEnviandoFoto(false)
    if (res.error || !res.data) setErro(res.error ?? 'Falha no upload')
    else setFotoUrl(res.data.foto_url)
  }

  async function onRemoverFoto() {
    const anterior = fotoUrl
    setFotoUrl(null)
    const res = await removeReceitaFoto(receita.id)
    if (res.error) { setFotoUrl(anterior); setErro(res.error) }
  }

  async function salvar() {
    setErro('')
    setSalvando(true)
    const res = await updateModoPreparo(receita.id, {
      passos: passos.map((p) => p.trim()).filter(Boolean),
      tempo_preparo_min: toInt(prep),
      temperatura_forno: toInt(tempC),
      tempo_forno_min: toInt(tempMin),
      dificuldade: (dificuldade || null) as 'facil' | 'media' | 'dificil' | null,
      observacao: observacao.trim() || null,
    })
    setSalvando(false)
    if (res.error) { setErro(res.error); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl border border-accent-primary/12 shadow-[0_8px_40px_rgba(0,0,0,0.12)] w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-accent-primary/10 shrink-0">
          <div>
            <h2 className="font-playfair text-primary text-[22px] font-bold leading-tight">{receita.nome}</h2>
            <p className="text-secondary text-xs mt-0.5">editar o modo de fazer</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-accent-primary hover:bg-accent-primary/10 transition-all" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Foto */}
          <div className="flex items-center gap-4">
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoUrl} alt={receita.nome} className="w-20 h-20 rounded-xl object-cover border border-subtle shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-input flex items-center justify-center shrink-0">
                <Camera size={22} className="text-secondary/50" />
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => fotoInputRef.current?.click()} disabled={enviandoFoto}
                className="btn-ghost text-xs px-3 py-2 min-h-[36px]">
                {enviandoFoto ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                {enviandoFoto ? 'Enviando…' : fotoUrl ? 'Trocar foto' : 'Adicionar foto'}
              </button>
              {fotoUrl && !enviandoFoto && (
                <button onClick={onRemoverFoto}
                  className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-red-400 px-2 py-2">
                  <Trash2 size={13} /> Remover
                </button>
              )}
            </div>
            <input ref={fotoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFotoChange} className="hidden" />
          </div>

          {/* Tempos e forno */}
          <div className="space-y-4">
            <SectionLabel icon={Clock}>Tempos e forno</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="field-label">Preparo (min)</label>
                <input type="text" inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="25" className="input-field" />
              </div>
              <div>
                <label className="field-label">Forno (°C)</label>
                <input type="text" inputMode="numeric" value={tempC} onChange={(e) => setTempC(e.target.value)} placeholder="180" className="input-field" />
              </div>
              <div>
                <label className="field-label">Forno (min)</label>
                <input type="text" inputMode="numeric" value={tempMin} onChange={(e) => setTempMin(e.target.value)} placeholder="40" className="input-field" />
              </div>
              <div>
                <label className="field-label">Dificuldade</label>
                <div className="relative">
                  <select value={dificuldade} onChange={(e) => setDificuldade(e.target.value as typeof dificuldade)} className="input-field appearance-none pr-8">
                    {DIFICULDADES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Modo de preparo */}
          <div className="space-y-3">
            <SectionLabel icon={ListOrdered}>Modo de preparo</SectionLabel>
            <PassosEditor passos={passos} onChange={setPassos} />
          </div>

          {/* Dica */}
          <div className="space-y-3">
            <SectionLabel icon={Lightbulb}>Dica / segredo da casa <span className="normal-case font-normal text-secondary/70">(opcional)</span></SectionLabel>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: não abra o forno nos primeiros 25 min ou o bolo sola."
              rows={2} className="input-field resize-none" />
          </div>

          {erro && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400 text-sm">{erro}</div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex gap-3 px-6 py-4 border-t border-accent-primary/10 shrink-0">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
          <button type="button" onClick={salvar} disabled={salvando || enviandoFoto} className="btn-primary flex-1">
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
