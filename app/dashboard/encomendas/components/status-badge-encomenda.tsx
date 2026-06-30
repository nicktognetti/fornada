import { Clock, ChefHat, PackageCheck, CheckCircle2, MinusCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { EncomendaStatus } from '@/app/actions/encomenda'

type Cfg = { label: string; cls: string; icon: LucideIcon }

export const STATUS_CFG: Record<EncomendaStatus, Cfg> = {
  pendente:    { label: 'Pendente',     cls: 'bg-neutral-tint text-secondary ring-secondary/20',          icon: Clock },
  em_producao: { label: 'Em produção',  cls: 'bg-amber-500/15 text-amber-400 ring-amber-500/25',          icon: ChefHat },
  pronto:      { label: 'Pronto',       cls: 'bg-blue-500/15 text-blue-400 ring-blue-500/25',             icon: PackageCheck },
  entregue:    { label: 'Entregue',     cls: 'bg-success-tint text-success ring-success/20',              icon: CheckCircle2 },
  cancelada:   { label: 'Cancelada',    cls: 'bg-danger-tint text-danger ring-danger/20',                 icon: MinusCircle },
}

export function StatusBadgeEncomenda({ status, size = 'md' }: { status: EncomendaStatus; size?: 'sm' | 'md' }) {
  const { label, cls, icon: Icon } = STATUS_CFG[status]
  const textCls = size === 'sm' ? 'text-[10px]' : 'text-[11px]'
  const padCls = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
  return (
    <span className={`inline-flex items-center gap-1 ${padCls} rounded-full ${textCls} font-semibold ring-1 ring-inset ${cls}`}>
      <Icon size={size === 'sm' ? 10 : 12} />
      {label}
    </span>
  )
}
