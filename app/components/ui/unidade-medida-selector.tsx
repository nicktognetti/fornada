'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

export interface UnidadeOpcao {
  value: string
  label: string
  nome: string
}

interface Props {
  name: string
  options: UnidadeOpcao[]
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
}

export function UnidadeMedidaSelector({ name, options, defaultValue, value: controlled, onChange }: Props) {
  const isControlled = controlled !== undefined
  const [internal, setInternal] = useState(defaultValue ?? options[0]?.value ?? '')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const value = isControlled ? controlled : internal
  const selected = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function pick(v: string) {
    if (!isControlled) setInternal(v)
    onChange?.(v)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full rounded-[0.625rem] px-3.5 py-[0.625rem] text-left text-sm transition-all outline-none"
        style={{
          backgroundColor: 'var(--t-input-bg)',
          border: '1px solid var(--t-input-border)',
          color: 'var(--t-text-1)',
        }}
      >
        <span className="flex-1 flex items-baseline gap-1.5">
          <span className="font-semibold">{selected?.label}</span>
          <span className="text-xs" style={{ color: 'var(--t-text-2)' }}>
            — {selected?.nome}
          </span>
        </span>
        <ChevronsUpDown size={14} style={{ color: 'var(--t-text-2)', flexShrink: 0 }} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-[0.625rem] overflow-hidden shadow-xl"
          style={{
            backgroundColor: 'var(--t-card-bg)',
            border: '1px solid var(--t-card-border)',
          }}
        >
          {options.map((opt) => {
            const isActive = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => pick(opt.value)}
                className="flex items-center gap-2 w-full px-3.5 py-2.5 text-left text-sm transition-colors"
                style={{
                  backgroundColor: isActive ? 'color-mix(in srgb, var(--t-accent) 8%, transparent)' : 'transparent',
                  color: isActive ? 'var(--t-accent)' : 'var(--t-text-1)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--t-row-hover)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                }}
              >
                <span className="font-semibold w-8 shrink-0">{opt.label}</span>
                <span className="text-xs flex-1" style={{ color: isActive ? 'var(--t-accent)' : 'var(--t-text-2)' }}>
                  {opt.nome}
                </span>
                {isActive && <Check size={13} style={{ color: 'var(--t-accent)', flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
