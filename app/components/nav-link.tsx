'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

interface NavLinkProps {
  href: string
  icon: LucideIcon
  label: string
  exact?: boolean
  onClick?: () => void
}

export function NavLink({ href, icon: Icon, label, exact = false, onClick }: NavLinkProps) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[44px] relative
        border-l-[3px] pl-[calc(0.75rem-3px)]
        ${active
          ? 'bg-marrom-500/[0.06] text-madrugada-800 font-semibold border-marrom-500'
          : 'text-madrugada-800 hover:bg-creme-200 border-transparent'
        }
      `}
    >
      <Icon
        size={18}
        strokeWidth={1.8}
        className={`shrink-0 ${active ? 'text-marrom-500' : 'text-demerara'}`}
      />
      <span>{label}</span>
    </Link>
  )
}
