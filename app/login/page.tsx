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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 100%, color-mix(in srgb, var(--color-accent-primary) 9%, transparent) 0%, transparent 70%)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10 gap-3">
          <Image
            src="/images/LOGO2claro.png"
            alt="Flor do Trigo — desde 1948"
            width={560}
            height={280}
            className="w-[200px] sm:w-[280px] h-auto"
            priority
            unoptimized
          />
          <p className="font-sacramento text-accent-primary text-2xl leading-none">
            Fornada
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl p-8 shadow-xl border border-subtle">
          <h1 className="font-playfair text-primary text-xl mb-6 text-center">
            Entrar no sistema
          </h1>

          <form action={action} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-secondary text-sm mb-1.5"
              >
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full bg-input border border-subtle rounded-lg px-4 py-3 text-primary placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-secondary text-sm mb-1.5"
              >
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full bg-input border border-subtle rounded-lg px-4 py-3 text-primary placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors"
                placeholder="••••••••"
              />
            </div>

            {state?.error && (
              <p className="text-red-400 text-sm text-center">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-accent-primary hover:bg-accent-hover disabled:opacity-60 text-accent-ink font-outfit font-medium rounded-lg py-3 mt-2 transition-colors cursor-pointer min-h-[44px]"
            >
              {pending ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
