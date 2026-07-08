import { Shield } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { createClient } from '@/lib/supabase/server'
import { listUsersWithPermissionsAction, getUnidadesGerenciaveis } from '@/app/actions/permissoes'
import { getConfigAction } from '@/app/actions/config'
import { LOCAIS_CONFIG_KEY, LOCAIS_PADRAO } from '@/app/lib/locais'
import { PermissoesTab } from './components/permissoes-tab'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [usuariosResult, unidadesResult, locaisResult] = await Promise.all([
    listUsersWithPermissionsAction(),
    getUnidadesGerenciaveis(),
    getConfigAction<string[]>(LOCAIS_CONFIG_KEY),
  ])
  const usuarios = usuariosResult.data ?? []
  const unidades = unidadesResult.data ?? []
  const locais = locaisResult.data && locaisResult.data.length > 0 ? locaisResult.data : LOCAIS_PADRAO

  return (
    <div className="max-w-3xl">
      <PageTitle icon={Shield} subtitle="Controle de acesso por usuário">
        Permissões
      </PageTitle>
      <PermissoesTab usuarios={usuarios} unidades={unidades} locaisDisponiveis={locais} currentUserId={user?.id ?? ''} />
    </div>
  )
}
