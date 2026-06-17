'use client'

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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <p className="font-sacramento text-croissant text-5xl leading-tight">
            Flor do Trigo
          </p>
          <p className="font-playfair text-demerara text-sm tracking-widest uppercase mt-1">
            Fornada
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#1e1e26] rounded-2xl p-8 shadow-xl border border-white/5">
          <h1 className="font-playfair text-creme text-xl mb-6 text-center">
            Entrar no sistema
          </h1>

          <form action={action} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-demerara text-sm mb-1.5"
              >
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full bg-madrugada border border-white/10 rounded-lg px-4 py-3 text-creme placeholder-demerara/50 focus:outline-none focus:ring-2 focus:ring-croissant/50 focus:border-croissant transition-colors"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-demerara text-sm mb-1.5"
              >
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full bg-madrugada border border-white/10 rounded-lg px-4 py-3 text-creme placeholder-demerara/50 focus:outline-none focus:ring-2 focus:ring-croissant/50 focus:border-croissant transition-colors"
                placeholder="••••••••"
              />
            </div>

            {state?.error && (
              <p className="text-red-400 text-sm text-center">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-croissant hover:bg-croissant/90 disabled:opacity-60 text-creme font-outfit font-medium rounded-lg py-3 mt-2 transition-colors cursor-pointer min-h-[44px]"
            >
              {pending ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
