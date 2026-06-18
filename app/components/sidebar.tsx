'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, Menu, LayoutDashboard, Package, BookOpen, Tag, BarChart3, Settings, Calculator, Palette, Droplet, ArrowLeftRight, PackageCheck } from 'lucide-react'
import { NavLink } from './nav-link'
import { logout } from '@/app/login/actions'
import { useTheme } from '@/app/context/theme-provider'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Resumo', exact: true },
  { href: '/dashboard/receitas', icon: BookOpen, label: 'Fichas' },
  { href: '/dashboard/insumos', icon: Package, label: 'Insumos' },
  { href: '/dashboard/precos', icon: Tag, label: 'Preços' },
  { href: '/dashboard/painel', icon: BarChart3, label: 'Painel' },
  { href: '/dashboard/configuracoes', icon: Settings, label: 'Configurações' },
  { href: '/dashboard/simulador', icon: Calculator, label: 'Simulador' },
  { href: '/dashboard/transferencias', icon: ArrowLeftRight, label: 'Transferências' },
  { href: '/dashboard/transferencias/receber', icon: PackageCheck, label: 'Receber' },
]

interface SidebarProps {
  userEmail: string
}

export function Sidebar({ userEmail }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const ThemeIcon = theme === 'classico' ? Palette : Droplet
  const themeLabel = theme === 'classico' ? 'Creme Clássico' : 'Creme Quente'

  const panel = (
    <aside className="flex flex-col h-full w-[260px] bg-madrugada-800">
      {/* Branding */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src="/images/LOGO2claro.png"
            alt="Flor do Trigo"
            width={36}
            height={36}
            className="object-contain shrink-0"
            unoptimized
          />
          <div className="min-w-0">
            <p className="font-playfair text-white/90 text-[17px] font-bold leading-tight">Fornada</p>
            <p className="text-[10px] text-white/35 uppercase tracking-wider leading-none mt-0.5">custos &amp; preços</p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-white/40 hover:text-white/70 p-1.5 rounded transition-colors shrink-0 ml-2"
          aria-label="Fechar menu"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            exact={item.exact}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      {/* Rodapé */}
      <div className="px-3 pb-4 pt-3 border-t border-white/[0.06] space-y-0.5">
        <div className="px-3 py-2">
          <p className="text-white/35 text-[11px] truncate">{userEmail}</p>
        </div>

        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/45 hover:text-white/75 hover:bg-madrugada-700/50 transition-all text-left"
          title={themeLabel}
        >
          <ThemeIcon size={15} className="shrink-0" />
          <span className="text-xs">{themeLabel}</span>
        </button>

        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/45 hover:text-white/75 hover:bg-madrugada-700/50 transition-all text-left"
          >
            <span className="text-xs">Sair →</span>
          </button>
        </form>

        <div className="px-3 pt-2">
          <p className="text-white/20 text-[10px]">v0.5 · Flor do Trigo · desde 1948</p>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop: fixo à esquerda */}
      <div className="hidden lg:block fixed top-0 left-0 h-screen z-30">
        {panel}
      </div>

      {/* Mobile: botão hamburger flutuante */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 w-10 h-10 rounded-xl bg-madrugada-800 shadow-lg flex items-center justify-center text-white/70 hover:text-white transition-colors"
        aria-label="Abrir menu"
      >
        <Menu size={18} />
      </button>

      {/* Mobile: overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {panel}
          <div
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}
    </>
  )
}
