export default function InsumosLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 rounded-lg bg-surface-2" />
        <div className="h-9 w-32 rounded-lg bg-surface-2" />
      </div>
      <div className="rounded-xl bg-surface border border-subtle overflow-hidden">
        <div className="px-5 py-3 border-b border-subtle bg-canvas flex gap-4">
          <div className="h-3 flex-1 rounded bg-surface-2" />
          <div className="h-3 w-20 rounded bg-surface-2" />
          <div className="h-3 w-20 rounded bg-surface-2" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-subtle last:border-0">
            <div className="h-4 flex-1 rounded bg-surface-2" />
            <div className="h-4 w-24 rounded bg-surface-2" />
            <div className="h-4 w-16 rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  )
}
