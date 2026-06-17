import { Settings } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { createClient } from '@/lib/supabase/server'
import { ConfigPanel } from './components/config-panel'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()

  // Busca categorias reais já usadas nos insumos
  const { data: insumos } = await supabase
    .from('insumo')
    .select('categoria')
    .eq('ativo', true)
    .not('categoria', 'is', null)

  const dbCategorias = [
    ...new Set(
      (insumos ?? [])
        .map((i: { categoria: string | null }) => i.categoria)
        .filter((c): c is string => Boolean(c))
    ),
  ]

  return (
    <div>
      <PageTitle icon={Settings} subtitle="Tipos, unidades e categorias">
        Configurações
      </PageTitle>
      <ConfigPanel dbCategorias={dbCategorias} />
    </div>
  )
}
