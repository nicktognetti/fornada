#!/usr/bin/env node
// ============================================================
// AGENTE DE IMPRESSÃO — térmica silenciosa (roda no PC da loja)
//
// Fica de olho nos pedidos que o robô do WhatsApp anota e manda
// a comanda direto pra impressora térmica, SEM diálogo do
// navegador. Windows + Node 18+.
//
// Como usar (no computador que tem a térmica):
//   1. Instale o Node.js (https://nodejs.org)
//   2. Salve este arquivo (ex: C:\fornada\agente-impressao.mjs)
//   3. Rode:
//      node agente-impressao.mjs --token=SEU_IMPRESSAO_TOKEN ^
//        [--unidade=UUID_DA_LOJA] [--impressora="Nome da Térmica"] ^
//        [--url=https://fornada.vercel.app] [--intervalo=20]
//   4. Para iniciar com o Windows: crie um atalho desse comando na
//      pasta shell:startup
//
// O token é o env IMPRESSAO_TOKEN do Fornada (Vercel). Sem
// --impressora, sai na impressora PADRÃO do Windows.
// ============================================================

import { execFile } from 'node:child_process'
import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ── Config via argumentos ────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/)
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]
  })
)
const URL_BASE = (args.url || 'https://fornada.vercel.app').replace(/\/$/, '')
const TOKEN = args.token || process.env.IMPRESSAO_TOKEN
const UNIDADE = args.unidade || ''
const IMPRESSORA = args.impressora || ''
const INTERVALO_S = Math.max(5, Number(args.intervalo) || 20)

if (!TOKEN) {
  console.error('ERRO: informe o token (--token=... ou env IMPRESSAO_TOKEN).')
  process.exit(1)
}

// ── Comanda em texto puro (42 colunas, fonte da térmica) ────
const L = 42
const sep = '-'.repeat(L)
function centro(s) {
  s = s.slice(0, L)
  const pad = Math.max(0, Math.floor((L - s.length) / 2))
  return ' '.repeat(pad) + s
}
function quebra(rotulo, valor) {
  if (!valor) return []
  const texto = `${rotulo}${valor}`
  const linhas = []
  for (let i = 0; i < texto.length; i += L) linhas.push(texto.slice(i, i + L))
  return linhas
}

function comandaTexto(p) {
  const dt = new Date(p.criado_em)
  const quando = dt.toLocaleDateString('pt-BR') + ' ' +
    dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const linhas = [
    centro('FLOR DO TRIGO - PEDIDO DO ROBO'),
    centro(p.canal === 'delivery' ? '*** DELIVERY ***' : '*** ENCOMENDA ***'),
    centro(p.unidade_nome || ''),
    sep,
    ...quebra('Recebido: ', quando),
    sep,
    ...quebra('PRODUTO: ', p.produto),
    ...quebra('QTD: ', p.quantidade && p.quantidade !== '?' ? p.quantidade : ''),
    sep,
    ...(p.canal === 'delivery'
      ? [centro('>>> ENTREGAR EM <<<'), ...quebra('', p.endereco || 'ENDERECO NAO INFORMADO - VER PAINEL')]
      : quebra('RETIRADA: ', p.data_texto || '')),
    sep,
    ...quebra('Cliente: ', p.nome || ''),
    ...quebra('WhatsApp: ', p.cliente_numero || ''),
    sep,
    centro('Valor em aberto - confirmar.'),
    '', '', '', // avanço do papel
  ]
  return linhas.filter((l) => l !== undefined).join('\r\n')
}

// ── Impressão via PowerShell Out-Printer ────────────────────
async function imprimir(texto) {
  const arquivo = join(tmpdir(), `comanda-${Date.now()}.txt`)
  await writeFile(arquivo, texto, 'latin1') // térmicas gostam de ANSI
  const ps = IMPRESSORA
    ? `Get-Content -Path '${arquivo}' | Out-Printer -Name '${IMPRESSORA.replace(/'/g, "''")}'`
    : `Get-Content -Path '${arquivo}' | Out-Printer`
  await new Promise((resolve, reject) => {
    execFile('powershell', ['-NoProfile', '-Command', ps], (err) => (err ? reject(err) : resolve()))
  })
  await unlink(arquivo).catch(() => {})
}

// ── Laço principal ───────────────────────────────────────────
async function ciclo() {
  try {
    const url = `${URL_BASE}/api/atendimento/comandas?token=${encodeURIComponent(TOKEN)}` +
      (UNIDADE ? `&unidade=${encodeURIComponent(UNIDADE)}` : '')
    const resp = await fetch(url)
    if (!resp.ok) {
      console.error(`[${new Date().toLocaleTimeString()}] API respondeu ${resp.status}`)
      return
    }
    const { pedidos } = await resp.json()
    if (!pedidos?.length) return

    const impressos = []
    for (const p of pedidos) {
      try {
        await imprimir(comandaTexto(p))
        impressos.push(p.id)
        console.log(`[${new Date().toLocaleTimeString()}] 🖨️  Comanda impressa: ${p.produto} (${p.canal})`)
      } catch (e) {
        console.error(`Falha ao imprimir ${p.id}:`, e.message)
      }
    }
    if (impressos.length > 0) {
      await fetch(`${URL_BASE}/api/atendimento/comandas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, ids: impressos }),
      })
    }
  } catch (e) {
    console.error(`[${new Date().toLocaleTimeString()}] Erro no ciclo (tento de novo):`, e.message)
  }
}

console.log('🥐 Agente de impressão do Fornada')
console.log(`   Servidor: ${URL_BASE}`)
console.log(`   Loja: ${UNIDADE || '(todas)'} · Impressora: ${IMPRESSORA || '(padrão do Windows)'}`)
console.log(`   Conferindo pedidos a cada ${INTERVALO_S}s. Ctrl+C para sair.`)
ciclo()
setInterval(ciclo, INTERVALO_S * 1000)
