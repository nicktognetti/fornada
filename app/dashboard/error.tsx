'use client'

import Link from 'next/link'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-danger-tint mb-5">
        <AlertTriangle size={26} className="text-danger" />
      </div>

      <h1 className="font-playfair text-2xl font-bold text-primary mb-2">
        Algo deu errado
      </h1>
      <p className="text-sm text-secondary max-w-md mb-1">
        Não foi possível carregar esta página. Pode ter sido uma falha temporária
        de conexão com o servidor.
      </p>
      {error?.digest && (
        <p className="text-[11px] text-faint mb-7 mt-1">
          Código: <span className="font-mono">{error.digest}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-sm font-semibold transition-colors shadow-sm"
        >
          <RotateCcw size={15} />
          Tentar novamente
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-transparent border border-subtle text-ink-soft hover:bg-input hover:text-primary text-sm font-medium transition-colors"
        >
          <Home size={15} />
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
