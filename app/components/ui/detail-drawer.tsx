'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: LucideIcon
  children: React.ReactNode
}

/**
 * Drawer de detalhamento sobreposto (desliza pela direita).
 * Fecha no clique do backdrop e na tecla Esc. Usado para drill-down
 * de informação (produto, KPI, margem) sem sair da tela.
 */
export function DetailDrawer({ open, onClose, title, subtitle, icon: Icon, children }: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Trava o scroll do body enquanto o drawer está aberto
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-[fadeIn_120ms_ease-out]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-[460px] h-full bg-surface border-l border-subtle shadow-2xl shadow-black/40 flex flex-col animate-[slideInRight_180ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-subtle shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="w-9 h-9 rounded-xl bg-accent-primary/12 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-accent-primary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-base font-semibold text-primary truncate">{title}</p>
              {subtitle && <p className="text-xs text-secondary mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-lg text-secondary hover:text-accent-primary hover:bg-accent-tint transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body rolável */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
