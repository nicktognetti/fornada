'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  X, Menu, LayoutDashboard, Package, BookOpen, Tag,
  BarChart3, Calculator, ArrowLeftRight, PackageCheck, LayoutGrid, Shield, Box, FileText, ClipboardList, Users, HelpCircle, MessageCircle, ChefHat,
} from 'lucide-react'
import { NavLink } from './nav-link'
import { logout } from '@/app/login/actions'
import { usePermissions } from '@/app/context/permissions-context'
import { contarPedidosPendentes } from '@/app/actions/atendimento'

// Aviso sonoro de pedido novo (dois toques curtos, sem arquivo de áudio).
// Liga/desliga por aparelho na aba Robô do Atendimento (localStorage).
function tocarAvisoSonoro() {
  try {
    type JanelaComAudio = Window & { webkitAudioContext?: typeof AudioContext }
    const Ctx = window.AudioContext ?? (window as JanelaComAudio).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const tocar = (freq: number, inicio: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + inicio)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + inicio + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + inicio)
      osc.stop(ctx.currentTime + inicio + 0.4)
    }
    tocar(880, 0)
    tocar(1174, 0.28)
    setTimeout(() => ctx.close().catch(() => {}), 1500)
  } catch {
    // navegador bloqueou o áudio (sem interação ainda) — segue só o badge
  }
}

// Menu agrupado por fluxo: visão geral → custos/produtos → vendas/clientes → estoque → config.
// Cada grupo interno é separado por uma divisória (grupos vazios após filtro somem).
const NAV_GROUPS: { href: string; icon: typeof LayoutDashboard; label: string; tela: string }[][] = [
  [
    { href: '/dashboard/resumo',                  icon: LayoutDashboard, label: 'Resumo',         tela: 'resumo'         },
    { href: '/dashboard/painel',                  icon: BarChart3,       label: 'Painel',         tela: 'painel'         },
  ],
  [
    { href: '/dashboard/receitas',                icon: BookOpen,        label: 'Fichas',         tela: 'receitas'       },
    { href: '/dashboard/caderno',                 icon: ChefHat,         label: 'Caderno',        tela: 'caderno'        },
    { href: '/dashboard/insumos',                 icon: Package,         label: 'Insumos',        tela: 'insumos'        },
    { href: '/dashboard/produtos',                icon: Box,             label: 'Produtos',       tela: 'produtos'       },
    { href: '/dashboard/precos',                  icon: Tag,             label: 'Preços',         tela: 'precos'         },
    { href: '/dashboard/simulador',               icon: Calculator,      label: 'Simulador',      tela: 'simulador'      },
    { href: '/dashboard/cadastros',               icon: LayoutGrid,      label: 'Cadastros',      tela: 'cadastros'      },
  ],
  [
    { href: '/dashboard/orcamentos',              icon: FileText,        label: 'Orçamentos',     tela: 'orcamento'      },
    { href: '/dashboard/encomendas',              icon: ClipboardList,   label: 'Encomendas',     tela: 'encomenda'      },
    { href: '/dashboard/clientes',                icon: Users,           label: 'Clientes',       tela: 'clientes'       },
    { href: '/dashboard/atendimento',             icon: MessageCircle,   label: 'Atendimento',    tela: 'atendimento'    },
  ],
  [
    { href: '/dashboard/transferencias',          icon: ArrowLeftRight,  label: 'Transferências', tela: 'transferencias' },
    { href: '/dashboard/transferencias/receber',  icon: PackageCheck,    label: 'Receber',        tela: 'receber'        },
  ],
  [
    { href: '/dashboard/configuracoes',           icon: Shield,          label: 'Configurações',  tela: 'configuracoes'  },
  ],
]

interface SidebarProps {
  userEmail: string
}

export function Sidebar({ userEmail }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { canAccess, isLoading } = usePermissions()

  // Badge do Atendimento: nº de pedidos anotados pelo robô ainda não tratados.
  // Atualiza a cada 60s (só para quem tem a tela).
  const [pendentes, setPendentes] = useState(0)
  const temAtendimento = !isLoading && canAccess('atendimento')
  useEffect(() => {
    if (!temAtendimento) return
    let ativo = true
    let anterior: number | null = null
    const carregar = () =>
      contarPedidosPendentes()
        .then((r) => {
          if (!ativo || !r.data) return
          const total = r.data.total
          // Subiu = pedido novo → som e/ou notificação (se ligados neste aparelho)
          if (anterior !== null && total > anterior) {
            if (localStorage.getItem('fornada_atendimento_som') === '1') tocarAvisoSonoro()
            if (
              localStorage.getItem('fornada_atendimento_push') === '1' &&
              typeof Notification !== 'undefined' && Notification.permission === 'granted'
            ) {
              try {
                new Notification('🥐 Pedido novo no WhatsApp', {
                  body: `${total} pedido${total !== 1 ? 's' : ''} aguardando no Atendimento`,
                  tag: 'fornada-atendimento',
                })
              } catch { /* navegador sem suporte — segue o badge */ }
            }
          }
          anterior = total
          setPendentes(total)
        })
        .catch(() => {})
    carregar()
    const t = setInterval(carregar, 60_000)
    return () => { ativo = false; clearInterval(t) }
  }, [temAtendimento])

  // Durante carregamento mostra todos (otimista); após carregamento filtra por permissão real.
  // Mantém a estrutura de grupos para desenhar as divisórias entre eles.
  const navGroups = NAV_GROUPS
    .map((grupo) => (isLoading ? grupo : grupo.filter((item) => canAccess(item.tela))))
    .filter((grupo) => grupo.length > 0)

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
          className="md:hidden text-secondary hover:text-ink-soft p-1.5 rounded transition-colors shrink-0 ml-2"
          aria-label="Fechar menu"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navGroups.map((grupo, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-3 pt-3 border-t border-subtle' : ''}>
            <div className="space-y-0.5">
              {grupo.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  badge={item.tela === 'atendimento' ? pendentes : undefined}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Rodapé */}
      <div className="px-3 pb-4 pt-3 border-t border-subtle space-y-0.5">
        <a
          href="/manual.html"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setMobileOpen(false)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-secondary hover:text-ink-soft hover:bg-input transition-all"
        >
          <HelpCircle size={16} />
          Manual de uso
        </a>

        <div className="px-3 py-2">
          <p className="text-secondary text-[11px] truncate">{userEmail}</p>
        </div>

        <form action={logout}>
          <button
            type="submit"
            aria-label="Sair do sistema"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-secondary hover:text-ink-soft hover:bg-input transition-all text-left"
          >
            <span className="text-xs" aria-hidden>Sair →</span>
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
      <div className="hidden md:block fixed top-0 left-0 h-screen z-30">
        {panel}
      </div>

      {/* Mobile: botão hamburger flutuante */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 w-10 h-10 rounded-xl bg-canvas shadow-lg flex items-center justify-center text-secondary hover:text-ink-soft transition-colors"
        aria-label="Abrir menu"
      >
        <Menu size={18} />
      </button>

      {/* Mobile: overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
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
