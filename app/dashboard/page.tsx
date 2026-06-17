import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <p className="font-sacramento text-croissant text-5xl">Flor do Trigo</p>
        <p className="font-playfair text-demerara text-sm tracking-widest uppercase mt-1">
          Fornada
        </p>
      </div>

      <div className="bg-[#1e1e26] rounded-2xl p-8 text-center border border-white/5 max-w-sm w-full">
        <p className="text-demerara text-sm mb-1">Logado como</p>
        <p className="text-creme font-medium">{user?.email}</p>

        <form action={logout} className="mt-6">
          <button
            type="submit"
            className="w-full border border-croissant/40 text-croissant hover:bg-croissant/10 rounded-lg py-2.5 text-sm transition-colors min-h-[44px]"
          >
            Sair
          </button>
        </form>
      </div>

      <p className="text-demerara/60 text-xs">
        Dashboard em construção — Etapa 2
      </p>
    </div>
  )
}
