import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/components/dashboard-shell'
import { UnidadeProviderWrapper } from '@/app/components/unidade-provider-wrapper'
import type { UnidadeOption } from '@/app/context/unidade-context'

async function getUnidadesDoUsuario(userId: string): Promise<UnidadeOption[]> {
  const supabase = await createClient()

  const { data: vinculos } = await supabase
    .schema('fornada')
    .from('usuario_unidade')
    .select('unidade_id')
    .eq('user_id', userId)
    .order('created_at')

  if (!vinculos || vinculos.length === 0) return []

  const ids = vinculos.map((v) => v.unidade_id)

  const { data: unidades } = await supabase
    .from('unidade')
    .select('id, nome')
    .in('id', ids)
    .order('nome')

  return (unidades ?? []) as UnidadeOption[]
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const unidades = await getUnidadesDoUsuario(user.id)

  return (
    <UnidadeProviderWrapper unidades={unidades}>
      <DashboardShell userEmail={user.email ?? ''}>
        {children}
      </DashboardShell>
    </UnidadeProviderWrapper>
  )
}
