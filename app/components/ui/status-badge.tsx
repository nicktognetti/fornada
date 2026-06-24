interface StatusBadgeProps {
  status: 'pendente' | 'definido'
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 'definido') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ring-inset ring-success/30 bg-success/10 text-success">
        <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
        Definido
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ring-inset ring-warning/30 bg-warning/10 text-warning">
      <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
      Pendente
    </span>
  )
}
