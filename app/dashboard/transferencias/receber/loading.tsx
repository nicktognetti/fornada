export default function ReceberLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-44 rounded-lg bg-surface-2" />
      <div className="h-10 w-64 rounded-lg bg-surface-2" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-surface border border-subtle p-5 flex items-center gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-surface-2" />
            <div className="h-3 w-24 rounded bg-surface-2" />
          </div>
          <div className="h-4 w-20 rounded bg-surface-2" />
          <div className="h-8 w-24 rounded-lg bg-surface-2" />
        </div>
      ))}
    </div>
  )
}
