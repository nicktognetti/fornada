export default function ProdutosLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Título */}
      <div className="space-y-2">
        <div className="h-8 w-36 rounded-lg bg-surface-2" />
        <div className="h-3 w-52 rounded bg-surface-2" />
      </div>
      {/* Busca + filtros + ação */}
      <div className="flex items-center gap-3">
        <div className="h-10 flex-1 rounded-lg bg-surface-2" />
        <div className="h-10 w-48 rounded-lg bg-surface-2" />
        <div className="h-10 w-32 rounded-lg bg-surface-2" />
      </div>
      {/* Linhas de produto */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-surface border border-subtle px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-surface-2" />
              <div className="space-y-2">
                <div className="h-4 w-44 rounded bg-surface-2" />
                <div className="h-3 w-48 rounded bg-surface-2" />
              </div>
            </div>
            <div className="h-5 w-16 rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  )
}
