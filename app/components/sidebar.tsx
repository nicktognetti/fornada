'use client'

import Image from 'next/image'
import { X, LayoutDashboard, Package, BookOpen, Tag, BarChart3 } from 'lucide-react'
import { NavLink } from './nav-link'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Resumo', exact: true },
  { href: '/dashboard/insumos', icon: Package, label: 'Insumos' },
  { href: '/dashboard/receitas', icon: BookOpen, label: 'Fichas' },
  { href: '/dashboard/precos', icon: Tag, label: 'Preços' },
  { href: '/dashboard/painel', icon: BarChart3, label: 'Painel' },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Painel */}
      <aside
        className={`
          fixed top-0 left-0 h-screen w-60 z-50 flex flex-col
          bg-[#0f0f14] border-r border-white/5
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
          <div className="flex flex-col gap-1 min-w-0">
            <Image
              src="/images/LOGO2claro.png"
              alt="Flor do Trigo"
              width={560}
              height={280}
              className="h-11 w-auto"
              unoptimized
            />
            <p className="font-sacramento text-croissant text-base leading-none pl-0.5">
              Fornada
            </p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-demerara hover:text-creme p-1.5 rounded transition-colors shrink-0 ml-2"
            aria-label="Fechar menu"
          >
            <X size={18} />
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
              onClick={onClose}
            />
          ))}
        </nav>

        {/* Rodapé */}
        <div className="px-5 py-4 border-t border-white/5">
          <p className="text-demerara/40 text-[10px] text-center tracking-wide">
            Padaria Flor do Trigo
          </p>
        </div>
      </aside>
    </>
  )
}
