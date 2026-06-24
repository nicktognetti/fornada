'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  X, Menu, LayoutDashboard, Package, BookOpen, Tag,
  BarChart3, Calculator, ArrowLeftRight, PackageCheck, LayoutGrid, Shield, Box,
} from 'lucide-react'
import { NavLink } from './nav-link'
import { logout } from '@/app/login/actions'
import { usePermissions } from '@/app/context/permissions-context'

const ALL_NAV_ITEMS = [
  { href: '/dashboard',                           icon: LayoutDashboard, label: 'Resumo',          tela: 'resumo',          exact: true },
  { href: '/dashboard/receitas',                  icon: BookOpen,        label: 'Fichas',           tela: 'receitas'         },
  { href: '/dashboard/insumos',                   icon: Package,         label: 'Insumos',          tela: 'insumos'          },
  { href: '/dashboard/precos',                    icon: Tag,             label: 'Preços',           tela: 'precos'           },
  { href: '/dashboard/produtos',                  icon: Box,             label: 'Produtos',         tela: 'produtos'         },
  { href: '/dashboard/painel',                    icon: BarChart3,       label: 'Painel',           tela: 'painel'           },
  { href: '/dashboard/cadastros',                 icon: LayoutGrid,      label: 'Cadastros',        tela: 'cadastros'        },
  { href: '/dashboard/simulador',                 icon: Calculator,      label: 'Simulador',        tela: 'simulador'        },
  { href: '/dashboard/transferencias',            icon: ArrowLeftRight,  label: 'Transferências',   tela: 'transferencias'   },
  { href: '/dashboard/transferencias/receber',    icon: PackageCheck,    label: 'Receber',          tela: 'receber'          },
  { href: '/dashboard/configuracoes',             icon: Shield,          label: 'Configurações',    tela: 'configuracoes'    },
]

// Tela sempre visível como fallback
const FALLBACK_TELAS = new Set(['resumo'])

interface SidebarProps {
  userEmail: string
}

export function Sidebar({ userEmail }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { canAccess, isLoading } = usePermissions()

  // Durante carregamento mostra todos (otimista); após carregamento filtra
  const navItems = isLoading
    ? ALL_NAV_ITEMS
    : ALL_NAV_ITEMS.filter((item) => FALLBACK_TELAS.has(item.tela) || canAccess(item.tela))

  const panel = (
    <aside className="flex flex-col h-full w-[260px] bg-canvas">
      {/* Branding */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-subtle">
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
            <p className="font-playfair text-primary text-[17px] font-bold leading-tight">Fornada</p>
            <p className="text-[10px] text-secondary uppercase tracking-wider leading-none mt-0.5">custos &amp; preços</p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-secondary hover:text-ink-soft p-1.5 rounded transition-colors shrink-0 ml-2"
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
      <div className="px-3 pb-4 pt-3 border-t border-subtle space-y-0.5">
        <div className="px-3 py-2">
          <p className="text-secondary text-[11px] truncate">{userEmail}</p>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-secondary hover:text-ink-soft hover:bg-input transition-all text-left"
          >
            <span className="text-xs">Sair →</span>
          </button>
        </form>

        <div className="px-3 pt-2">
          <p className="text-[11px]" style={{ color: 'rgba(172,97,55,0.5)', letterSpacing: '0.04em' }}>
            Flor do Trigo · desde 1948
          </p>
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
        className="lg:hidden fixed top-4 left-4 z-40 w-10 h-10 rounded-xl bg-canvas shadow-lg flex items-center justify-center text-secondary hover:text-ink-soft transition-colors"
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
