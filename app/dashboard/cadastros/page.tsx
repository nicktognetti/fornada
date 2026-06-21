import { LayoutGrid } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { CadastrosPanel } from './components/cadastros-panel'

export default async function CadastrosPage() {
  return (
    <div>
      <PageTitle icon={LayoutGrid} subtitle="Tipos, unidades e categorias">
        Cadastros
      </PageTitle>
      <CadastrosPanel />
    </div>
  )
}
