'use client'

import { useState } from 'react'
import { Copy, X, Check } from 'lucide-react'
import { useUnidade } from '@/app/context/unidade-context'
import { copiarEntreUnidades, type TipoCopia } from '@/app/actions/unidade'
import { usePermission } from '@/app/context/permissions-context'

const TIPOS: { value: TipoCopia; label: string; desc: string }[] = [
  { value: 'fichas',  label: 'Fichas Técnicas', desc: 'Copia receitas e seus itens' },
  { value: 'insumos', label: 'Insumos',         desc: 'Copia cadastro de insumos' },
  { value: 'precos',  label: 'Preços',           desc: 'Copia preços de venda (requer fichas com mesmo nome no destino)' },
  { value: 'tudo',    label: 'Tudo',             desc: 'Insumos + Fichas + Preços' },
]

export function CopiarUnidadeModal() {
  const { unidades, unidadeAtual } = useUnidade()
  const { canWrite } = usePermission('cadastros')
  const [open, setOpen] = useState(false)
  const [paraUnidadeId, setParaUnidadeId] = useState('')
  const [tipo, setTipo] = useState<TipoCopia>('fichas')
  const [saving, setSaving] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // Só mostra se há mais de 1 unidade e usuário tem permissão de escrita
  if (unidades.length <= 1 || !canWrite) return null
  // Não mostra se estiver em "Todas"
  if (!unidadeAtual) return null

  const destinos = unidades.filter((u) => u.id !== unidadeAtual.id)

  function handleOpen() {
    setParaUnidadeId(destinos[0]?.id ?? '')
    setTipo('fichas')
    setResultado(null)
    setErro(null)
    setOpen(true)
  }

  async function handleConfirm() {
    if (!paraUnidadeId) return
    setSaving(true)
    setErro(null)
    setResultado(null)
    try {
      const res = await copiarEntreUnidades(unidadeAtual!.id, paraUnidadeId, tipo)
      if (res.error) {
        setErro(res.error)
      } else {
        const c = res.copiados ?? {}
        const partes = [
          c.fichas != null   ? `${c.fichas} ficha${c.fichas !== 1 ? 's' : ''}` : null,
          c.insumos != null  ? `${c.insumos} insumo${c.insumos !== 1 ? 's' : ''}` : null,
          c.precos != null   ? `${c.precos} preço${c.precos !== 1 ? 's' : ''}` : null,
        ].filter(Boolean)
        setResultado(partes.length > 0 ? `Copiado: ${partes.join(', ')}` : 'Nada novo para copiar (registros já existem no destino)')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        title={`Copiar de ${unidadeAtual.nome} para outra unidade`}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-secondary hover:text-ink-soft hover:bg-input/40 border border-subtle/50 transition-colors"
      >
        <Copy size={13} />
        Copiar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && setOpen(false)} />
          <div className="relative w-full max-w-md bg-surface border border-subtle rounded-2xl shadow-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Copy size={16} className="text-accent-primary" />
                <h2 className="text-base font-semibold text-primary">Copiar para outra unidade</h2>
              </div>
              <button onClick={() => !saving && setOpen(false)} className="text-faint hover:text-secondary p-1">
                <X size={16} />
              </button>
            </div>

            {/* De */}
            <div className="space-y-1">
              <label className="field-label">De</label>
              <div className="input-field opacity-60 cursor-not-allowed select-none">
                {unidadeAtual.nome}
              </div>
            </div>

            {/* Para */}
            <div className="space-y-1">
              <label className="field-label">Para</label>
              <select
                value={paraUnidadeId}
                onChange={(e) => setParaUnidadeId(e.target.value)}
                className="input-field"
                disabled={saving}
              >
                {destinos.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <label className="field-label">O que copiar</label>
              <div className="space-y-2">
                {TIPOS.map((t) => (
                  <label
                    key={t.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      tipo === t.value
                        ? 'border-accent-primary/40 bg-accent-primary/8'
                        : 'border-subtle hover:border-subtle/60 hover:bg-canvas/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipo"
                      value={t.value}
                      checked={tipo === t.value}
                      onChange={() => setTipo(t.value)}
                      className="mt-0.5 accent-[var(--color-accent-primary)]"
                      disabled={saving}
                    />
                    <div>
                      <p className="text-sm font-medium text-primary">{t.label}</p>
                      <p className="text-[11px] text-faint">{t.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Resultado / erro */}
            {resultado && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-success/10 border border-success/20 text-success text-sm">
                <Check size={14} />
                {resultado}
              </div>
            )}
            {erro && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-danger/10 border border-danger/20 text-danger text-sm">
                <X size={14} />
                {erro}
              </div>
            )}

            {/* Ações */}
            {!resultado ? (
              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={() => setOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm text-secondary hover:text-primary hover:bg-input transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving || !paraUnidadeId}
                  className="btn-primary px-5 py-2 disabled:opacity-50"
                >
                  {saving ? 'Copiando…' : 'Confirmar cópia'}
                </button>
              </div>
            ) : (
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setOpen(false)}
                  className="btn-primary px-5 py-2"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
