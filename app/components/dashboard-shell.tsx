import { Navigation } from './navigation'

interface DashboardShellProps {
  children: React.ReactNode
  userEmail: string
}

export function DashboardShell({ children, userEmail }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[#1a1a1d]">
      <Navigation userEmail={userEmail} />
      <main className="p-5 sm:p-8 lg:p-10 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  )
}
