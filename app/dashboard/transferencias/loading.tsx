export default function Loading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="space-y-2">
          <div className="h-8 w-52 bg-subtle rounded-xl animate-pulse" />
          <div className="h-4 w-36 bg-input rounded-lg animate-pulse" />
        </div>
        <div className="h-10 w-40 bg-input rounded-lg animate-pulse shrink-0" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-1 mb-5 border-b border-subtle pb-0">
        {[72, 96, 88, 128].map((w, i) => (
          <div
            key={i}
            className="h-7 rounded bg-input animate-pulse mb-px"
            style={{ width: w }}
          />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-surface border border-subtle rounded-lg shadow-lg shadow-black/20 overflow-hidden">
        {/* Thead */}
        <div className="bg-surface border-b border-subtle px-4 py-3 flex items-center gap-6">
          {[72, 60, 160, 104, 96, 48].map((w, i) => (
            <div
              key={i}
              className="h-3 rounded bg-subtle animate-pulse shrink-0"
              style={{ width: w }}
            />
          ))}
        </div>

        {/* 5 row skeletons */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center gap-6 px-4 py-4 border-b border-subtle ${
              i % 2 === 0 ? 'bg-canvas' : 'bg-surface-2'
            }`}
          >
            <div className="h-4 w-20 bg-input rounded animate-pulse shrink-0" />
            <div className="h-5 w-16 bg-input rounded-full animate-pulse shrink-0" />
            <div className="h-4 w-44 bg-input rounded animate-pulse" />
            <div className="h-5 w-24 bg-input rounded-full animate-pulse shrink-0" />
            <div className="h-4 w-24 bg-input rounded animate-pulse shrink-0" />
            <div className="h-7 w-12 bg-input rounded-lg animate-pulse shrink-0 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
