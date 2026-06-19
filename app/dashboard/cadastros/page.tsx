import { LayoutGrid } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { createClient } from '@/lib/supabase/server'
import { CadastrosPanel } from './components/cadastros-panel'

export default async function CadastrosPage() {
  const supabase = await createClient()

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
      <PageTitle icon={LayoutGrid} subtitle="Tipos, unidades e categorias">
        Cadastros
      </PageTitle>
      <CadastrosPanel dbCategorias={dbCategorias} />
    </div>
  )
}
