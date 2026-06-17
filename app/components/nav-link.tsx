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
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[44px]
        ${active
          ? 'bg-croissant/15 text-croissant font-medium'
          : 'text-demerara hover:text-creme hover:bg-white/5'
        }
      `}
    >
      <Icon size={18} strokeWidth={1.8} className="shrink-0" />
      <span>{label}</span>
    </Link>
  )
}
