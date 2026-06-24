export default function DashboardLoading() {
  return (
    <div className="max-w-2xl space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface border border-subtle p-6 space-y-3">
            <div className="h-3 w-32 rounded bg-surface-2" />
            <div className="h-9 w-16 rounded bg-surface-2" />
            <div className="h-3 w-24 rounded bg-surface-2" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-4 w-40 rounded bg-surface-2" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface border border-subtle px-5 py-4 space-y-2">
            <div className="flex justify-between">
              <div className="h-4 w-36 rounded bg-surface-2" />
              <div className="h-4 w-12 rounded bg-surface-2" />
            </div>
            <div className="h-2 w-full rounded-full bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  )
}
