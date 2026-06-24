'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => {
      const result = await login(formData)
      return result ?? undefined
    },
    undefined
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">

      {/* Fundo: atmosfera quente multicamadas */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {/* Halo inferior quente */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px]"
          style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(217,141,95,0.13) 0%, transparent 68%)' }} />
        {/* Halo superior frio (contraponto) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px]"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(30,30,40,0.6) 0%, transparent 70%)' }} />
        {/* Vinheta nas bordas */}
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 85% 85% at 50% 50%, transparent 60%, rgba(14,14,18,0.7) 100%)' }} />
      </div>

      {/* Conteúdo */}
      <div className="relative w-full max-w-sm flex flex-col items-center">

        {/* Logo Flor do Trigo */}
        <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
          <Image
            src="/images/LOGO2claro.png"
            alt="Flor do Trigo — desde 1948"
            width={560}
            height={280}
            className="w-[220px] sm:w-[280px] h-auto drop-shadow-2xl"
            priority
            unoptimized
          />
        </div>

        {/* Wordmark Fornada — mesmo peso visual do logo */}
        <div
          className="animate-fade-up mt-3 mb-10 flex flex-col items-center gap-1.5 w-full"
          style={{ animationDelay: '120ms' }}
        >
          {/* Régua decorativa com "Fornada" centralizado */}
          <div className="flex items-center gap-3 w-full px-6">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(217,141,95,0.45))' }} />
            <p className="font-sacramento leading-none text-accent-primary"
               style={{ fontSize: '2.6rem', textShadow: '0 0 32px rgba(217,141,95,0.35)' }}>
              Fornada
            </p>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(217,141,95,0.45))' }} />
          </div>

          {/* Subtítulo produto */}
          <p className="font-outfit text-center"
             style={{ fontSize: '9px', letterSpacing: '0.32em', color: 'rgba(156,163,175,0.55)', textTransform: 'uppercase' }}>
            Sistema de Gestão&nbsp;&nbsp;·&nbsp;&nbsp;Custos &amp; Preços
          </p>
        </div>

        {/* Card do formulário */}
        <div
          className="animate-fade-up w-full relative rounded-2xl overflow-hidden"
          style={{
            animationDelay: '260ms',
            background: 'var(--t-card-bg)',
            border: '1px solid rgba(172,97,55,0.22)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 1px 0 rgba(217,141,95,0.06) inset',
          }}
        >
          {/* Linha accent no topo do card */}
          <div className="absolute top-0 left-0 right-0 h-px"
               style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(217,141,95,0.55) 40%, rgba(217,141,95,0.55) 60%, transparent 100%)' }} />

          <div className="px-8 pt-8 pb-9">
            <h1 className="font-playfair text-center mb-7"
                style={{ fontSize: '1.2rem', color: 'var(--t-text-1)', letterSpacing: '-0.01em' }}>
              Entrar no sistema
            </h1>

            <form action={action} className="space-y-5">
              {/* E-mail */}
              <div>
                <label htmlFor="email" className="field-label">E-mail</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input-field"
                  placeholder="seu@email.com"
                />
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="password" className="field-label">Senha</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="input-field"
                  placeholder="••••••••"
                />
              </div>

              {/* Erro */}
              {state?.error && (
                <p className="text-danger text-sm text-center">{state.error}</p>
              )}

              {/* Botão */}
              <button
                type="submit"
                disabled={pending}
                className="w-full mt-2 font-outfit font-semibold rounded-xl min-h-[46px] transition-all duration-200 relative overflow-hidden cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: pending
                    ? 'var(--t-accent)'
                    : 'linear-gradient(135deg, var(--t-accent-hover) 0%, var(--t-accent) 60%, rgba(185,105,55,1) 100%)',
                  color: '#1a1010',
                  fontSize: '0.875rem',
                  boxShadow: pending ? 'none' : '0 4px 20px rgba(217,141,95,0.3)',
                }}
              >
                {pending ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p
          className="animate-fade-up mt-8 font-outfit text-center"
          style={{
            animationDelay: '380ms',
            fontSize: '10px',
            letterSpacing: '0.06em',
            color: 'rgba(172,97,55,0.4)',
          }}
        >
          Flor do Trigo &middot; desde 1948
        </p>
      </div>
    </div>
  )
}
