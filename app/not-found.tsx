import Link from 'next/link'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <p className="font-playfair text-[64px] font-bold leading-none text-accent-primary mb-2">
        404
      </p>
      <h1 className="font-playfair text-xl font-bold text-primary mb-2">
        Página não encontrada
      </h1>
      <p className="text-sm text-secondary max-w-sm mb-8">
        O endereço acessado não existe ou foi movido.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-sm font-semibold transition-colors shadow-sm"
      >
        <Home size={15} />
        Voltar ao início
      </Link>
    </div>
  )
}
