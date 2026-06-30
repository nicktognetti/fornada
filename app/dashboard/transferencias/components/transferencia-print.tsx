'use client'

import { formatBRL } from '@/lib/format'
import { DocumentoImpressao, BotaoImprimir, tabelaImpressao as T } from '@/app/components/ui/documento-impressao'

export interface ItemRomaneio {
  nome: string
  enviada: number
  recebida: number | null
  preco: number
}

interface Props {
  codigo: string
  tipoLabel: string
  origem: string
  destino: string
  criadaEm: string
  observacao: string | null
  itens: ItemRomaneio[]
  isAdmin: boolean
  valorTotal: number
}

export function TransferenciaPrint({ codigo, tipoLabel, origem, destino, criadaEm, observacao, itens, isAdmin, valorTotal }: Props) {
  return (
    <>
      <BotaoImprimir label="Imprimir romaneio" />

      <DocumentoImpressao titulo={`Romaneio — ${codigo}`} subtitulo={`${tipoLabel} · ${origem} → ${destino}`} unidade={origem}>
        <div style={{ display: 'flex', gap: '24px', marginBottom: '14px', fontSize: '12px' }}>
          <div><strong>Rota:</strong> {origem} → {destino}</div>
          <div><strong>Criada em:</strong> {criadaEm}</div>
        </div>

        <table style={T.table}>
          <thead>
            <tr>
              <th style={T.th}>Produto</th>
              <th style={T.thRight}>Enviado</th>
              <th style={T.thRight}>Recebido</th>
              {isAdmin && <th style={T.thRight}>Preço un.</th>}
              {isAdmin && <th style={T.thRight}>Subtotal</th>}
            </tr>
          </thead>
          <tbody>
            {itens.map((it, i) => (
              <tr key={i}>
                <td style={T.td}>{it.nome}</td>
                <td style={T.tdRight}>{it.enviada.toLocaleString('pt-BR')}</td>
                <td style={T.tdRight}>{it.recebida !== null ? it.recebida.toLocaleString('pt-BR') : '—'}</td>
                {isAdmin && <td style={T.tdRight}>R$ {formatBRL(it.preco)}</td>}
                {isAdmin && <td style={T.tdRight}>R$ {formatBRL(it.enviada * it.preco)}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        {isAdmin && valorTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '8px', borderTop: '2px solid #1a1a1a', fontWeight: 700, fontSize: '14px' }}>
            <span>Valor total</span>
            <span>R$ {formatBRL(valorTotal)}</span>
          </div>
        )}

        {observacao && <p style={{ marginTop: '12px', fontSize: '11px', color: '#555' }}>Obs.: {observacao}</p>}

        {/* Assinaturas */}
        <div style={{ display: 'flex', gap: '40px', marginTop: '48px', fontSize: '11px', color: '#444' }}>
          <div style={{ flex: 1, borderTop: '1px solid #1a1a1a', paddingTop: '4px', textAlign: 'center' }}>Responsável envio</div>
          <div style={{ flex: 1, borderTop: '1px solid #1a1a1a', paddingTop: '4px', textAlign: 'center' }}>Responsável recebimento</div>
        </div>
      </DocumentoImpressao>
    </>
  )
}
