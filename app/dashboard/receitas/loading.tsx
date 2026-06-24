export default function ReceitasLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-44 rounded-lg bg-surface-2" />
        <div className="h-9 w-36 rounded-lg bg-surface-2" />
      </div>
      <div className="rounded-xl bg-surface border border-subtle overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-subtle last:border-0">
            <div className="h-4 flex-1 rounded bg-surface-2" />
            <div className="h-4 w-20 rounded bg-surface-2" />
            <div className="h-4 w-16 rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  )
}
