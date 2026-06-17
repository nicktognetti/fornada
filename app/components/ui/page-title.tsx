import type { LucideIcon } from 'lucide-react'

interface Props {
  icon?: LucideIcon
  children: React.ReactNode
}

export function PageTitle({ icon: Icon, children }: Props) {
  return (
    <div className="flex items-center gap-3 mb-8">
      {Icon && (
        <div className="w-10 h-10 rounded-xl bg-croissant/15 flex items-center justify-center shrink-0">
          <Icon size={20} className="text-croissant" />
        </div>
      )}
      <h1 className="font-playfair text-creme text-[30px] font-bold leading-tight tracking-tight">
        {children}
      </h1>
    </div>
  )
}
