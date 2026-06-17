'use client'

import Image from 'next/image'
import { Menu, LogOut } from 'lucide-react'
import { logout } from '@/app/login/actions'

interface HeaderProps {
  userEmail: string
  onMenuClick: () => void
}

export function Header({ userEmail, onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 lg:px-6 bg-madrugada/90 backdrop-blur border-b border-white/5 shrink-0">

      {/* Esquerda: hambúrguer (mobile) + logo + título */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-demerara hover:text-creme p-2 -ml-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2.5">
          <Image
            src="/images/LOGO2claro.png"
            alt="Flor do Trigo"
            width={560}
            height={280}
            className="h-9 w-auto"
            priority
            unoptimized
          />
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-playfair text-creme font-semibold text-base leading-none">
              Fornada
            </span>
            <span className="font-sacramento text-croissant text-sm leading-tight">
              sistema interno
            </span>
          </div>
        </div>
      </div>

      {/* Direita: e-mail + sair */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:block text-demerara text-sm truncate max-w-[200px]">
          {userEmail}
        </span>

        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-demerara hover:text-creme text-sm px-3 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-colors min-h-[44px]"
            title="Sair"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </form>
      </div>
    </header>
  )
}
