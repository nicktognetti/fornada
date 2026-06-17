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
  userEmail: string
}

export function Sidebar({ isOpen, onClose, userEmail }: SidebarProps) {
  const initial = userEmail ? userEmail[0].toUpperCase() : '?'

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Painel */}
      <aside
        className={`
          fixed top-0 left-0 h-screen w-60 z-50 flex flex-col
          bg-creme-100 border-r border-[rgba(159,147,131,0.15)]
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Branding */}
        <div className="flex items-center justify-between px-5 pt-6 pb-5 border-b border-[rgba(159,147,131,0.12)]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <Image
                src="/images/logo-flor-do-trigo.svg"
                alt="Flor do Trigo"
                width={40}
                height={40}
                className="w-10 h-10 shrink-0"
                unoptimized
              />
              <div className="min-w-0">
                <p className="font-playfair text-madrugada-800 text-[22px] font-bold leading-none tracking-tight">
                  Fornada
                </p>
                <p className="font-outfit text-[10px] uppercase tracking-[0.12em] text-demerara font-medium mt-1">
                  sistema interno
                </p>
              </div>
            </div>
            <div className="w-10 h-[2px] bg-marrom-500 mt-4" />
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-demerara hover:text-madrugada-800 p-1.5 rounded transition-colors shrink-0 ml-2 self-start mt-1"
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

        {/* Rodapé: usuário */}
        <div className="px-4 py-4 border-t border-[rgba(159,147,131,0.12)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-marrom-500 flex items-center justify-center shrink-0">
              <span className="font-playfair text-creme-100 text-sm font-bold leading-none">
                {initial}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-madrugada-800 truncate">Padaria Flor do Trigo</p>
              <p className="text-[10px] text-demerara truncate">{userEmail}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
