import { Clock, CheckCircle2, XCircle, CalendarX } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { OrcamentoStatusDisplay } from '@/lib/orcamento-status'

type Cfg = { label: string; cls: string; icon: LucideIcon }

export const ORC_STATUS_CFG: Record<OrcamentoStatusDisplay, Cfg> = {
  aguardando: { label: 'Aguardando cliente', cls: 'bg-amber-500/15 text-amber-400 ring-amber-500/25',   icon: Clock },
  aprovado:   { label: 'Aprovado',           cls: 'bg-success-tint text-success ring-success/20',       icon: CheckCircle2 },
  recusado:   { label: 'Recusado',           cls: 'bg-danger-tint text-danger ring-danger/20',          icon: XCircle },
  expirado:   { label: 'Expirado',           cls: 'bg-secondary/15 text-secondary ring-secondary/25',   icon: CalendarX },
}

export function StatusBadgeOrcamento({ status, size = 'md' }: { status: OrcamentoStatusDisplay; size?: 'sm' | 'md' }) {
  const { label, cls, icon: Icon } = ORC_STATUS_CFG[status]
  const textCls = size === 'sm' ? 'text-[10px]' : 'text-[11px]'
  const padCls = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
  return (
    <span className={`inline-flex items-center gap-1 ${padCls} rounded-full ${textCls} font-semibold ring-1 ring-inset ${cls}`}>
      <Icon size={size === 'sm' ? 10 : 12} />
      {label}
    </span>
  )
}
