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
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] relative
        ${active
          ? 'bg-input text-primary font-semibold'
          : 'text-ink-soft hover:text-primary hover:bg-input/60'
        }
      `}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-accent-primary rounded-r-full" />
      )}
      <Icon
        size={17}
        strokeWidth={1.8}
        className={`shrink-0 ml-0.5 ${active ? 'text-accent-primary' : 'text-faint'}`}
      />
      <span>{label}</span>
    </Link>
  )
}
