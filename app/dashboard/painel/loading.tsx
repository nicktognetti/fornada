export default function PainelLoading() {
  return (
    <div className="max-w-5xl space-y-6 animate-pulse">
      {/* Title skeleton */}
      <div className="h-8 w-64 rounded-lg bg-surface-2" />
      {/* Filter skeleton */}
      <div className="h-9 w-48 rounded-lg bg-surface-2" />
      {/* KPIs skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface border border-subtle p-4 space-y-3">
            <div className="h-3 w-24 rounded bg-surface-2" />
            <div className="h-7 w-28 rounded bg-surface-2" />
            <div className="h-3 w-20 rounded bg-surface-2" />
          </div>
        ))}
      </div>
      {/* Tabela skeleton */}
      <div className="rounded-xl bg-surface border border-subtle overflow-hidden">
        <div className="px-5 py-3 border-b border-subtle bg-canvas">
          <div className="h-3 w-48 rounded bg-surface-2" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-subtle last:border-0">
            <div className="h-4 flex-1 rounded bg-surface-2" />
            <div className="h-4 w-16 rounded bg-surface-2" />
            <div className="h-4 w-16 rounded bg-surface-2" />
            <div className="h-4 w-14 rounded bg-surface-2" />
            <div className="h-4 w-14 rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  )
}
