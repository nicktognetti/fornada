'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { Printer } from 'lucide-react'
import { getConfigAction } from '@/app/actions/config'

/** Dados configuráveis do rodapé de impressão (Cadastros → Rodapé). */
export type RodapeConfig = {
  endereco?: string
  telefone?: string
  email?: string
  site?: string
  instagram?: string
  extra?: string
}
export const RODAPE_CONFIG_KEY = 'rodape_impressao'

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
  unidadeDoc?: string | null
  numero?: number | null
  /** Rótulos das linhas de assinatura no rodapé (ex.: ['Responsável', 'Produção']). */
  assinaturas?: string[]
  /** Força quebra de página depois deste documento (para imprimir vários numa tirada). */
  quebraPagina?: boolean
  children: React.ReactNode
}

/**
 * Documento de impressão (layout A4 claro). Fica oculto na tela e só aparece
 * ao imprimir (regras .print-doc em globals.css). Cores explícitas claras —
 * não usa os tokens do tema escuro.
 */
export function DocumentoImpressao({ titulo, subtitulo, unidade, unidadeDoc, numero, assinaturas, quebraPagina, children }: Props) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const [mounted, setMounted] = useState(false)
  const [rodape, setRodape] = useState<RodapeConfig | null>(null)
  useEffect(() => {
    // Guarda de hidratação: só renderiza o rodapé (config client-side) após montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    getConfigAction<RodapeConfig>(RODAPE_CONFIG_KEY).then((r) => { if (r.data) setRodape(r.data) })
  }, [])
  if (!mounted) return null

  // Linha de contato do rodapé (só os campos preenchidos).
  const contato = [
    rodape?.endereco,
    rodape?.telefone && `Tel: ${rodape.telefone}`,
    rodape?.email,
    rodape?.site,
    rodape?.instagram && (rodape.instagram.startsWith('@') ? rodape.instagram : `@${rodape.instagram}`),
  ].filter(Boolean).join('  ·  ')

  return createPortal(
    <div className="print-doc print-portal" style={{ color: '#1a1a1a', fontSize: '12px', lineHeight: 1.45, pageBreakAfter: quebraPagina ? 'always' : 'auto' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #1a1a1a', paddingBottom: '10px', marginBottom: '16px' }}>
        <div>
          {/* Logo cor invertida (creme → preto) para impressão em fundo branco */}
          <Image src="/images/LOGO2claro.png" alt="Flor do Trigo — desde 1948" width={560} height={280} unoptimized style={{ width: '96px', height: 'auto', display: 'block', filter: 'brightness(0)' }} />
          <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666', marginTop: '6px' }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
          <p style={{ fontSize: '16px', fontWeight: 700 }}>{titulo}</p>
          {numero != null && <p style={{ fontSize: '14px', fontWeight: 700, color: '#444' }}>Nº {numero}</p>}
        </div>
        {subtitulo && <p style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{subtitulo}</p>}
      </div>

      {/* Conteúdo */}
      <div>{children}</div>

      {/* Assinaturas */}
      {assinaturas && assinaturas.length > 0 && (
        <div style={{ display: 'flex', gap: '40px', marginTop: '46px' }}>
          {assinaturas.map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #1a1a1a', marginBottom: '5px' }} />
              <span style={{ fontSize: '10px', color: '#555' }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Rodapé */}
      <div style={{ marginTop: '22px', paddingTop: '8px', borderTop: '1px solid #ccc', fontSize: '10px', color: '#888' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span>Flor do Trigo · desde 1948{unidade ? ` · ${unidade}` : ''}{unidadeDoc ? ` · CNPJ ${unidadeDoc}` : ''}</span>
          <span>Emitido em {hoje}</span>
        </div>
        {contato && <p style={{ marginTop: '3px', textAlign: 'center' }}>{contato}</p>}
        {rodape?.extra && <p style={{ marginTop: '2px', textAlign: 'center' }}>{rodape.extra}</p>}
      </div>
    </div>,
    document.body,
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
