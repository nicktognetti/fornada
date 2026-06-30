import { Sidebar } from './sidebar'
import { UnidadeSelector } from './unidade-selector'
import { CopiarUnidadeModal } from './copiar-unidade-modal'
import { EmpresaSwitcher } from './empresa-switcher'

interface DashboardShellProps {
  children: React.ReactNode
  userEmail: string
}

export function DashboardShell({ children, userEmail }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar userEmail={userEmail} />
      <main className="md:pl-[260px] min-h-screen bg-canvas">
        <div className="p-5 sm:p-8 lg:p-10 pt-16 md:pt-10 max-w-5xl mx-auto">
          {/* Empresa → Unidade, empilhados */}
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-0">
              <EmpresaSwitcher />
              <UnidadeSelector />
            </div>
            <CopiarUnidadeModal />
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
