'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'

const navItems = [
  { href: '/dashboard', label: 'RESUMO', exact: true },
  { href: '/dashboard/receitas', label: 'FICHAS' },
  { href: '/dashboard/insumos', label: 'INSUMOS' },
  { href: '/dashboard/precos', label: 'PREÇOS' },
  { href: '/dashboard/painel', label: 'PAINEL' },
  { href: '/dashboard/simulador', label: 'SIMULADOR' },
]

interface NavigationProps {
  userEmail: string
}

export function Navigation({ userEmail }: NavigationProps) {
  const pathname = usePathname()

  return (
    <header className="bg-[#1a1a1d] border-b border-[rgba(255,255,255,0.06)] sticky top-0 z-40">

      {/* Linha 1 — Branding + usuário */}
      <div className="flex items-end justify-between px-6 pt-4 pb-2.5">
        <div>
          <p className="font-playfair text-[#9e9e9e] text-[12px] leading-none mb-1">
            flor do trigo
          </p>
          <p className="font-playfair text-[#e8e6e3] text-[20px] font-bold leading-none">
            Fornada{' '}
            <span className="text-[#9e9e9e] font-normal text-[14px]">
              · custos &amp; preços
            </span>
          </p>
        </div>

        <div className="flex items-end gap-5">
          <div className="text-right hidden sm:block">
            <p className="text-[#e8e6e3] text-[10px] uppercase tracking-[0.15em] font-semibold leading-none">
              FLOR DO TRIGO
            </p>
            <p className="text-[#9e9e9e] text-[10px] mt-0.5">DESDE 1948</p>
          </div>
          <div className="text-right">
            <p className="text-[#9e9e9e] text-[11px] hidden sm:block">{userEmail}</p>
            <form action={logout}>
              <button
                type="submit"
                className="text-[#9e9e9e] text-[11px] hover:text-[#d68a57] transition-colors"
              >
                sair →
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Linha 2 — Abas de navegação (pill) */}
      <div className="flex items-center gap-1 px-4 pb-3 overflow-x-auto">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                shrink-0 px-5 py-2 rounded-full text-[12px] font-semibold tracking-wider
                transition-all duration-150 whitespace-nowrap
                ${active
                  ? 'bg-[#d68a57] text-[#1a1a1d]'
                  : 'text-[#9e9e9e] hover:text-[#e8e6e3] hover:bg-[rgba(255,255,255,0.07)]'
                }
              `}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </header>
  )
}
