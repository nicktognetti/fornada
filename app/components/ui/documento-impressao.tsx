'use client'

import { Printer } from 'lucide-react'

/** Botão "Imprimir" — dispara o diálogo de impressão do navegador. */
export function BotaoImprimir({ label = 'Imprimir', className = '' }: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`no-print inline-flex items-center justify-center gap-2 px-4 rounded-xl text-sm font-semibold border border-subtle text-ink-soft hover:text-primary hover:bg-input transition-colors min-h-[36px] ${className}`}
    >
      <Printer size={15} />
      {label}
    </button>
  )
}

interface Props {
  titulo: string
  subtitulo?: string
  unidade?: string | null
  children: React.ReactNode
}

/**
 * Documento de impressão (layout A4 claro). Fica oculto na tela e só aparece
 * ao imprimir (regras .print-doc em globals.css). Cores explícitas claras —
 * não usa os tokens do tema escuro.
 */
export function DocumentoImpressao({ titulo, subtitulo, unidade, children }: Props) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return (
    <div className="print-doc" style={{ color: '#1a1a1a', fontSize: '12px', lineHeight: 1.45 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #1a1a1a', paddingBottom: '10px', marginBottom: '16px' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '22px', fontWeight: 700, lineHeight: 1 }}>
            Flor do Trigo
          </p>
          <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666', marginTop: '3px' }}>
            Fornada · Sistema de Gestão
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: '11px', color: '#444' }}>
          {unidade && <p style={{ fontWeight: 600 }}>{unidade}</p>}
          <p>{hoje}</p>
        </div>
      </div>

      {/* Título do documento */}
      <div style={{ marginBottom: '14px' }}>
        <p style={{ fontSize: '16px', fontWeight: 700 }}>{titulo}</p>
        {subtitulo && <p style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{subtitulo}</p>}
      </div>

      {/* Conteúdo */}
      <div>{children}</div>

      {/* Rodapé */}
      <div style={{ marginTop: '24px', paddingTop: '8px', borderTop: '1px solid #ccc', fontSize: '10px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
        <span>Flor do Trigo · desde 1948</span>
        <span>Emitido em {hoje}</span>
      </div>
    </div>
  )
}

/** Estilos utilitários para tabelas dentro do documento de impressão. */
export const tabelaImpressao = {
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '12px' },
  th: { textAlign: 'left' as const, borderBottom: '1.5px solid #1a1a1a', padding: '6px 8px', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#444' },
  thRight: { textAlign: 'right' as const, borderBottom: '1.5px solid #1a1a1a', padding: '6px 8px', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#444' },
  td: { textAlign: 'left' as const, borderBottom: '1px solid #e2e2e2', padding: '6px 8px' },
  tdRight: { textAlign: 'right' as const, borderBottom: '1px solid #e2e2e2', padding: '6px 8px', fontVariantNumeric: 'tabular-nums' as const },
}
