import { PackageCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <PackageCheck size={22} className="text-[#d98d5f] shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold text-[#f5f5f0]">Recebimentos pendentes</h1>
          <p className="text-sm text-[#888888] mt-0.5">Transferências aguardando conferência</p>
        </div>
      </div>

      {!transferencias || transferencias.length === 0 ? (
        <div className="bg-[#222226] border border-[#333336] rounded-lg shadow-lg shadow-black/20 flex flex-col items-center py-16 text-[#888888]">
          <PackageCheck size={40} className="mb-4 text-[#d98d5f]/25" />
          <p className="font-medium text-[#f5f5f0] text-base">Nenhum recebimento pendente</p>
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
                className="bg-[#222226] border border-[#333336] rounded-lg shadow-lg shadow-black/20 p-5 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[15px] font-bold text-[#f5f5f0]">{t.codigo}</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ring-inset bg-[#2a2a1e] text-[#d9a05f] ring-[#d9a05f]/20">
                      Em Trânsito
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#888888]">
                    <span className="font-medium text-[#d4d4d0]">{unidadeMap.get(t.unidade_origem_id) ?? '—'}</span>
                    <ArrowRight size={11} className="text-[#d98d5f]/40 shrink-0" />
                    <span className="font-medium text-[#d4d4d0]">{unidadeMap.get(t.unidade_destino_id) ?? '—'}</span>
                    <span className="mx-1 text-[#333336]">·</span>
                    <span>{totalItens} {totalItens === 1 ? 'item' : 'itens'}</span>
                    <span className="mx-1 text-[#333336]">·</span>
                    <span>{formatDate(t.created_at)}</span>
                  </div>
                </div>
                <Link
                  href={`/dashboard/transferencias/${t.id}`}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#d98d5f] hover:bg-[#e8a57a] text-white text-sm font-semibold shadow-sm transition-colors shrink-0"
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
