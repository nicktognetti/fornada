import type { LucideIcon } from 'lucide-react'

interface Props {
  icon?: LucideIcon
  children: React.ReactNode
}

export function SectionLabel({ icon: Icon, children }: Props) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon size={13} className="text-croissant shrink-0" />}
      <span className="text-croissant font-outfit text-[11px] uppercase tracking-widest font-semibold whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-croissant/20" />
    </div>
  )
}
