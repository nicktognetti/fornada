import { PackageCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageTitle } from '@/app/components/ui/page-title'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function ReceberPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: ue } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('usuario_id', user?.id ?? '')
    .single()

  const empresaId = ue?.empresa_id

  const { data: transferencias } = empresaId
    ? await supabase
        .schema('fornada')
        .from('transferencia')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('status', 'EM_TRANSITO')
        .order('created_at', { ascending: true })
    : { data: [] }

  const { data: unidades } = await supabase.from('unidade').select('id, nome')
  const unidadeMap = new Map((unidades ?? []).map((u) => [u.id, u.nome]))

  const ids = (transferencias ?? []).map((t: { id: string }) => t.id)
  const { data: itensCount } = ids.length > 0
    ? await supabase
        .schema('fornada')
        .from('transferencia_item')
        .select('transferencia_id')
        .in('transferencia_id', ids)
    : { data: [] }

  const countMap = new Map<string, number>()
  for (const row of itensCount ?? []) {
    const r = row as { transferencia_id: string }
    countMap.set(r.transferencia_id, (countMap.get(r.transferencia_id) ?? 0) + 1)
  }

  return (
    <div>
      <PageTitle icon={PackageCheck} subtitle="Transferências aguardando conferência">
        Recebimentos pendentes
      </PageTitle>

      {!transferencias || transferencias.length === 0 ? (
        <div className="bg-white border border-[#e5ddd3] rounded-lg shadow-md flex flex-col items-center py-16 text-[#78716c]">
          <PackageCheck size={40} className="mb-4 text-[#c2410c]/25" />
          <p className="font-medium text-[#1c1917] text-base">Nenhum recebimento pendente</p>
          <p className="text-sm mt-1">Todas as transferências foram conferidas.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(transferencias as any[]).map((t) => {
            const totalItens = countMap.get(t.id) ?? 0
            return (
              <div
                key={t.id}
                className="bg-white border border-[#e5ddd3] rounded-lg shadow-md p-5 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[15px] font-bold text-[#1c1917]">
                      {t.codigo}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ring-inset bg-[#fef3c7] text-[#92400e] ring-[#92400e]/20">
                      Em Trânsito
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#78716c]">
                    <span className="font-medium text-[#44403c]">{unidadeMap.get(t.unidade_origem_id) ?? '—'}</span>
                    <ArrowRight size={11} className="text-[#c2410c]/40 shrink-0" />
                    <span className="font-medium text-[#44403c]">{unidadeMap.get(t.unidade_destino_id) ?? '—'}</span>
                    <span className="mx-1 text-[#e5ddd3]">·</span>
                    <span>{totalItens} {totalItens === 1 ? 'item' : 'itens'}</span>
                    <span className="mx-1 text-[#e5ddd3]">·</span>
                    <span>{formatDate(t.created_at)}</span>
                  </div>
                </div>
                <Link
                  href={`/dashboard/transferencias/${t.id}`}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#c2410c] hover:bg-[#d97747] text-white text-sm font-semibold shadow-sm transition-colors shrink-0"
                >
                  <PackageCheck size={14} />
                  Conferir
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
