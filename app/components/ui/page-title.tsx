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
          <div className="w-10 h-10 rounded-xl bg-marrom-500/12 flex items-center justify-center shrink-0">
            <Icon size={20} className="text-marrom-500" />
          </div>
        )}
        <h1 className="font-playfair text-madrugada-800 text-[30px] font-bold leading-tight tracking-tight">
          {children}
        </h1>
      </div>
      {subtitle && (
        <p className="mt-1 text-sm text-demerara font-outfit ml-[52px]">{subtitle}</p>
      )}
    </div>
  )
}
