import { createClient } from '@/lib/supabase/server'
import { ChefHat } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { temAcesso, setoresPermitidosCaderno } from '@/app/lib/authz'
import { CadernoCatalogo, type ReceitaCaderno } from './components/caderno-catalogo'

// Caderno de Receitas — a "capa" do caderno para a produção/confeitaria.
// Lê a receita direta (SEM a view de custo): aqui não existe valor nenhum.
export default async function CadernoPage() {
  const [unidadeId, supabase] = await Promise.all([getUnidadePreferida(), createClient()])

  const [{ data }, { data: { user } }] = await Promise.all([
    (unidadeId
      ? supabase.from('receita').select('id, nome, tipo, categoria, rendimento, rendimento_unidade, foto_url, passos, tempo_preparo_min, dificuldade, revisao_pendente').eq('ativo', true).eq('unidade_id', unidadeId).order('nome')
      : supabase.from('receita').select('id, nome, tipo, categoria, rendimento, rendimento_unidade, foto_url, passos, tempo_preparo_min, dificuldade, revisao_pendente').eq('ativo', true).order('nome')),
    supabase.auth.getUser(),
  ])

  const receitas = (data as ReceitaCaderno[]) ?? []

  // Restrição por setor: produção só vê os setores liberados (+ as sem setor).
  // Gestão/admin → permitidos = null (vê tudo).
  let visiveis = receitas
  if (user) {
    const permitidos = await setoresPermitidosCaderno(user.id, unidadeId)
    if (permitidos !== null) {
      const set = new Set(permitidos)
      visiveis = receitas.filter((r) => !r.categoria?.trim() || set.has(r.categoria.trim()))
    }
  }

  const podeCriar = user
    ? await temAcesso(user.id, ['receitas', 'caderno'], { nivel: 'escrita' })
    : false

  return (
    <div>
      <PageTitle icon={ChefHat}>Caderno de Receitas</PageTitle>
      <CadernoCatalogo receitas={visiveis} podeCriar={podeCriar} />
    </div>
  )
}
