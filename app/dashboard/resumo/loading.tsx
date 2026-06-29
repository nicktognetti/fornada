export default function ResumoLoading() {
  return (
    <div className="max-w-2xl space-y-8 animate-pulse">
      {/* Título */}
      <div className="space-y-2">
        <div className="h-8 w-40 rounded-lg bg-surface-2" />
        <div className="h-3 w-48 rounded bg-surface-2" />
      </div>
      {/* Chips de ação */}
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-32 rounded-full bg-surface-2" />
        <div className="h-9 w-32 rounded-full bg-surface-2" />
        <div className="h-9 w-28 rounded-full bg-surface-2" />
      </div>
      {/* Cards de KPI */}
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface border border-subtle p-6 space-y-3">
            <div className="h-3 w-32 rounded bg-surface-2" />
            <div className="h-9 w-16 rounded bg-surface-2" />
            <div className="h-3 w-28 rounded bg-surface-2" />
          </div>
        ))}
      </div>
      {/* Seção */}
      <div className="rounded-xl bg-surface border border-subtle p-6">
        <div className="h-3 w-40 rounded bg-surface-2" />
      </div>
    </div>
  )
}
