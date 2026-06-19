import { Sidebar } from './sidebar'

interface DashboardShellProps {
  children: React.ReactNode
  userEmail: string
}

export function DashboardShell({ children, userEmail }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar userEmail={userEmail} />
      <main className="lg:pl-[260px] min-h-screen bg-canvas">
        <div className="p-5 sm:p-8 lg:p-10 pt-16 lg:pt-10 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
