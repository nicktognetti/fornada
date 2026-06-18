import { Truck, CheckCircle2, AlertTriangle, Clock, MinusCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type StatusTransferencia =
  | 'PENDENTE'
  | 'EM_TRANSITO'
  | 'RECEBIDO'
  | 'RECEBIDO_COM_DIVERGENCIA'

export type StatusItem = 'PENDENTE' | 'RECEBIDO' | 'DIFERENCA' | 'AUSENTE'

type BadgeConfig = { label: string; cls: string; icon: LucideIcon }

const STATUS_CONFIG: Record<StatusTransferencia, BadgeConfig> = {
  PENDENTE: {
    label: 'Pendente',
    cls: 'bg-[#f3f4f6] text-[#6b7280] ring-[#6b7280]/20',
    icon: Clock,
  },
  EM_TRANSITO: {
    label: 'Em Trânsito',
    cls: 'bg-[#fef3c7] text-[#92400e] ring-[#92400e]/20',
    icon: Truck,
  },
  RECEBIDO: {
    label: 'Recebido',
    cls: 'bg-[#dcfce7] text-[#166534] ring-[#166534]/20',
    icon: CheckCircle2,
  },
  RECEBIDO_COM_DIVERGENCIA: {
    label: 'Com Divergência',
    cls: 'bg-[#fee2e2] text-[#991b1b] ring-[#991b1b]/20',
    icon: AlertTriangle,
  },
}

const ITEM_CONFIG: Record<StatusItem, BadgeConfig> = {
  PENDENTE:  { label: 'Pendente',   cls: 'bg-[#f3f4f6] text-[#6b7280] ring-[#6b7280]/20',   icon: Clock },
  RECEBIDO:  { label: 'Recebido',   cls: 'bg-[#dcfce7] text-[#166534] ring-[#166534]/20',   icon: CheckCircle2 },
  DIFERENCA: { label: 'Diferença',  cls: 'bg-[#fee2e2] text-[#991b1b] ring-[#991b1b]/20',   icon: AlertTriangle },
  AUSENTE:   { label: 'Ausente',    cls: 'bg-[#fff7ed] text-[#9a3412] ring-[#9a3412]/20',   icon: MinusCircle },
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
