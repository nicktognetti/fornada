'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Palette } from 'lucide-react'
import { logout } from '@/app/login/actions'
import { useTheme } from '@/app/context/theme-provider'

const navItems = [
  { href: '/dashboard', label: 'RESUMO', exact: true },
  { href: '/dashboard/receitas', label: 'FICHAS' },
  { href: '/dashboard/insumos', label: 'INSUMOS' },
  { href: '/dashboard/precos', label: 'PREÇOS' },
  { href: '/dashboard/painel', label: 'PAINEL' },
  { href: '/dashboard/configuracoes', label: 'CONFIG' },
  { href: '/dashboard/simulador', label: 'SIMULADOR' },
]

interface NavigationProps {
  userEmail: string
}

export function Navigation({ userEmail }: NavigationProps) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()

  return (
    <header className="app-nav sticky top-0 z-40">

      {/* Linha 1 — Branding + usuário */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2.5">
        {/* Logo + nome */}
        <div className="flex items-center gap-3">
          <Image
            src="/images/LOGO2claro.png"
            alt="Flor do Trigo"
            width={40}
            height={40}
            className="object-contain shrink-0"
            unoptimized
          />
          <div>
            <p className="font-playfair text-white/90 text-[18px] font-bold leading-tight">
              Fornada
            </p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider leading-none mt-0.5">
              · custos &amp; preços
            </p>
          </div>
        </div>

        {/* Direita: branding padaria + usuário */}
        <div className="flex items-end gap-5">
          <div className="text-right hidden sm:block">
            <p className="text-[#e8e6e3] text-[10px] uppercase tracking-[0.15em] font-semibold leading-none">
              FLOR DO TRIGO
            </p>
            <p className="text-[#9e9e9e] text-[10px] mt-0.5">DESDE 1948</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              title="Alternar tom"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9e9e9e] hover:text-[#d68a57] hover:bg-[rgba(214,138,87,0.10)] transition-all"
            >
              <Palette size={15} />
            </button>
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
