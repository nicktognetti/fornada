export default function CadastrosLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Título */}
      <div className="space-y-2">
        <div className="h-8 w-36 rounded-lg bg-surface-2" />
        <div className="h-3 w-48 rounded bg-surface-2" />
      </div>
      {/* Abas */}
      <div className="flex gap-2">
        <div className="h-10 w-40 rounded-lg bg-surface-2" />
        <div className="h-10 w-44 rounded-lg bg-surface-2" />
        <div className="h-10 w-48 rounded-lg bg-surface-2" />
      </div>
      {/* Painel com chips */}
      <div className="rounded-xl bg-surface border border-subtle p-6 space-y-5">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-surface-2" />
          <div className="h-3 w-56 rounded bg-surface-2" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[40, 56, 24, 28, 32].map((w, i) => (
            <div key={i} className="h-8 rounded-full bg-surface-2" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
        <div className="h-12 w-full max-w-md rounded-lg bg-surface-2" />
      </div>
    </div>
  )
}
