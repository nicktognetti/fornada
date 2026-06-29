export default function PrecosLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Título */}
      <div className="space-y-2">
        <div className="h-8 w-32 rounded-lg bg-surface-2" />
        <div className="h-3 w-44 rounded bg-surface-2" />
      </div>
      {/* Seção + linhas */}
      <div className="space-y-3">
        <div className="h-3 w-40 rounded bg-surface-2" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-surface border border-subtle px-5 py-4">
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-surface-2" />
              <div className="h-3 w-56 rounded bg-surface-2" />
            </div>
            <div className="h-6 w-16 rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  )
}
