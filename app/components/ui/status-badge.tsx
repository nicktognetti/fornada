interface StatusBadgeProps {
  status: 'pendente' | 'definido'
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 'definido') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ring-inset ring-emerald-500/30 bg-emerald-500/10 text-emerald-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        Definido
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ring-inset ring-amber-500/30 bg-amber-500/10 text-amber-700">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
      Pendente
    </span>
  )
}
