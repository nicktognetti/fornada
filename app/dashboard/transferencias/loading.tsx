export default function Loading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="space-y-2">
          <div className="h-8 w-52 bg-marrom-500/10 rounded-xl animate-pulse" />
          <div className="h-4 w-36 bg-marrom-500/6 rounded-lg animate-pulse" />
        </div>
        <div className="h-10 w-40 bg-marrom-500/10 rounded-lg animate-pulse shrink-0" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-1 mb-5">
        {[72, 96, 88, 128].map((w, i) => (
          <div
            key={i}
            className="h-8 rounded-lg bg-marrom-500/8 animate-pulse"
            style={{ width: w }}
          />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="card-surface overflow-hidden">
        {/* Thead */}
        <div className="bg-creme-100 border-b border-marrom-500/8 px-4 py-3 flex items-center gap-6">
          {[72, 60, 160, 104, 96, 48].map((w, i) => (
            <div
              key={i}
              className="h-3 rounded bg-marrom-500/15 animate-pulse shrink-0"
              style={{ width: w }}
            />
          ))}
        </div>

        {/* 5 row skeletons */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center gap-6 px-4 py-4 border-b border-marrom-500/6 ${
              i % 2 === 1 ? 'bg-creme-50/50' : 'bg-white'
            }`}
          >
            <div className="h-4 w-20 bg-marrom-500/10 rounded animate-pulse shrink-0" />
            <div className="h-5 w-16 bg-marrom-500/10 rounded-full animate-pulse shrink-0" />
            <div className="h-4 w-44 bg-marrom-500/10 rounded animate-pulse" />
            <div className="h-5 w-24 bg-marrom-500/10 rounded-full animate-pulse shrink-0" />
            <div className="h-4 w-24 bg-marrom-500/10 rounded animate-pulse shrink-0" />
            <div className="h-7 w-12 bg-marrom-500/10 rounded-lg animate-pulse shrink-0 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
