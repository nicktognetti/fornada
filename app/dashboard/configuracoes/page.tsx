import { Shield } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { createClient } from '@/lib/supabase/server'
import { listUsersWithPermissionsAction } from '@/app/actions/permissoes'
import { PermissoesTab } from './components/permissoes-tab'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const usuariosResult = await listUsersWithPermissionsAction()
  const usuarios = usuariosResult.data ?? []

  return (
    <div className="max-w-3xl">
      <PageTitle icon={Shield} subtitle="Controle de acesso por usuário">
        Permissões
      </PageTitle>
      <PermissoesTab usuarios={usuarios} currentUserId={user?.id ?? ''} />
    </div>
  )
}
