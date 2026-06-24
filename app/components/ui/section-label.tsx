import type { LucideIcon } from 'lucide-react'

interface Props {
  icon?: LucideIcon
  children: React.ReactNode
}

export function SectionLabel({ icon: Icon, children }: Props) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon size={13} className="text-accent-primary shrink-0" />}
      <span className="text-accent-primary font-outfit text-[11px] uppercase tracking-widest font-semibold whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, color-mix(in srgb, var(--color-accent-primary) 22%, transparent), transparent)' }} />
    </div>
  )
}
