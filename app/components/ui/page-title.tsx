import type { LucideIcon } from 'lucide-react'

interface Props {
  icon?: LucideIcon
  children: React.ReactNode
  subtitle?: string
}

export function PageTitle({ icon: Icon, children, subtitle }: Props) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-accent-primary/12 flex items-center justify-center shrink-0 ring-1 ring-accent-primary/20" style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--color-accent-primary) 18%, transparent)' }}>
            <Icon size={20} className="text-accent-primary" />
          </div>
        )}
        <h1 className="font-playfair text-primary text-[30px] font-bold leading-tight tracking-tight">
          {children}
        </h1>
      </div>
      {subtitle && (
        <p className="mt-1 text-sm text-secondary font-outfit ml-[52px]">{subtitle}</p>
      )}
    </div>
  )
}
