import { Shield } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { createClient } from '@/lib/supabase/server'
import { listUsersWithPermissionsAction, getUnidadesGerenciaveis } from '@/app/actions/permissoes'
import { PermissoesTab } from './components/permissoes-tab'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [usuariosResult, unidadesResult] = await Promise.all([
    listUsersWithPermissionsAction(),
    getUnidadesGerenciaveis(),
  ])
  const usuarios = usuariosResult.data ?? []
  const unidades = unidadesResult.data ?? []

  return (
    <div className="max-w-3xl">
      <PageTitle icon={Shield} subtitle="Controle de acesso por usuário">
        Permissões
      </PageTitle>
      <PermissoesTab usuarios={usuarios} unidades={unidades} currentUserId={user?.id ?? ''} />
    </div>
  )
}
