export default function ConfiguracoesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Título */}
      <div className="space-y-2">
        <div className="h-8 w-40 rounded-lg bg-surface-2" />
        <div className="h-3 w-44 rounded bg-surface-2" />
      </div>
      {/* Linha "N usuários" + botão */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-surface-2" />
        <div className="h-10 w-36 rounded-lg bg-surface-2" />
      </div>
      {/* Tabela de usuários */}
      <div className="rounded-xl bg-surface border border-subtle overflow-hidden">
        <div className="px-5 py-3 border-b border-subtle bg-canvas flex justify-between">
          <div className="h-3 w-20 rounded bg-surface-2" />
          <div className="h-3 w-16 rounded bg-surface-2" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-4 border-b border-subtle last:border-0">
            <div className="space-y-2">
              <div className="h-4 w-44 rounded bg-surface-2" />
              <div className="h-3 w-52 rounded bg-surface-2" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-6 w-20 rounded-full bg-surface-2" />
              <div className="h-5 w-5 rounded bg-surface-2" />
              <div className="h-5 w-5 rounded bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
