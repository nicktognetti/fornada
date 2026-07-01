export default function EncomendasLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-44 rounded-lg bg-surface-2" />
        <div className="h-3 w-56 rounded bg-surface-2" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 flex-1 rounded-lg bg-surface-2" />
        <div className="h-10 w-40 rounded-lg bg-surface-2" />
      </div>
      <div className="h-9 w-72 rounded-xl bg-surface-2" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-surface border border-subtle px-5 py-4">
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-surface-2" />
              <div className="h-3 w-48 rounded bg-surface-2" />
            </div>
            <div className="h-6 w-20 rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  )
}
