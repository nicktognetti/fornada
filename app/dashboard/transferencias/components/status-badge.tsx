import { Truck, CheckCircle2, AlertTriangle, Clock, MinusCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type StatusTransferencia =
  | 'PENDENTE'
  | 'EM_TRANSITO'
  | 'RECEBIDO'
  | 'RECEBIDO_COM_DIVERGENCIA'
  | 'CANCELADA'

export type StatusItem = 'PENDENTE' | 'RECEBIDO' | 'DIFERENCA' | 'AUSENTE'

type BadgeConfig = { label: string; cls: string; icon: LucideIcon }

const STATUS_CONFIG: Record<StatusTransferencia, BadgeConfig> = {
  PENDENTE: {
    label: 'Pendente',
    cls: 'bg-neutral-tint text-secondary ring-secondary/20',
    icon: Clock,
  },
  EM_TRANSITO: {
    label: 'Em Trânsito',
    cls: 'bg-accent-tint text-accent-primary ring-accent-primary/20',
    icon: Truck,
  },
  RECEBIDO: {
    label: 'Recebido',
    cls: 'bg-success-tint text-success ring-success/20',
    icon: CheckCircle2,
  },
  RECEBIDO_COM_DIVERGENCIA: {
    label: 'Com Divergência',
    cls: 'bg-danger-tint text-danger ring-danger/20',
    icon: AlertTriangle,
  },
  CANCELADA: {
    label: 'Cancelada',
    cls: 'bg-neutral-tint text-secondary ring-secondary/20',
    icon: MinusCircle,
  },
}

const ITEM_CONFIG: Record<StatusItem, BadgeConfig> = {
  PENDENTE:  { label: 'Pendente',  cls: 'bg-neutral-tint text-secondary ring-secondary/20',     icon: Clock },
  RECEBIDO:  { label: 'Recebido',  cls: 'bg-success-tint text-success ring-success/20',         icon: CheckCircle2 },
  DIFERENCA: { label: 'Diferença', cls: 'bg-danger-tint text-danger ring-danger/20',            icon: AlertTriangle },
  AUSENTE:   { label: 'Ausente',   cls: 'bg-accent-tint text-accent-primary ring-accent-primary/20', icon: MinusCircle },
}

interface BadgeProps {
  status: StatusTransferencia
  showIcon?: boolean
  size?: 'sm' | 'md'
}

export function StatusBadgeTransferencia({ status, showIcon = true, size = 'md' }: BadgeProps) {
  const { label, cls, icon: Icon } = STATUS_CONFIG[status]
  const textCls = size === 'sm' ? 'text-[10px]' : 'text-[11px]'
  const padCls  = size === 'sm' ? 'px-2 py-0.5'  : 'px-2.5 py-1'
  const iconSz  = size === 'sm' ? 10 : 12

  return (
    <span className={`inline-flex items-center gap-1 ${padCls} rounded-full ${textCls} font-semibold ring-1 ring-inset ${cls}`}>
      {showIcon && <Icon size={iconSz} />}
      {label}
    </span>
  )
}

interface ItemBadgeProps {
  status: StatusItem
  showIcon?: boolean
  size?: 'sm' | 'md'
}

export function StatusBadgeItem({ status, showIcon = true, size = 'md' }: ItemBadgeProps) {
  const { label, cls, icon: Icon } = ITEM_CONFIG[status]
  const textCls = size === 'sm' ? 'text-[10px]' : 'text-[11px]'
  const padCls  = size === 'sm' ? 'px-2 py-0.5'  : 'px-2.5 py-1'
  const iconSz  = size === 'sm' ? 10 : 12

  return (
    <span className={`inline-flex items-center gap-1 ${padCls} rounded-full ${textCls} font-semibold ring-1 ring-inset ${cls}`}>
      {showIcon && <Icon size={iconSz} />}
      {label}
    </span>
  )
}
