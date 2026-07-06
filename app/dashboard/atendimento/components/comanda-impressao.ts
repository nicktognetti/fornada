// Comanda de pedido do robô para impressora TÉRMICA (80mm).
// Imprime via iframe oculto (não é bloqueado como popup e funciona também
// no disparo automático). A impressão "automática" abre o diálogo do
// navegador com a comanda pronta — deixe a térmica como impressora padrão
// e é um Enter. (Impressão 100% silenciosa exige um agente local — futuro.)

import type { PedidoAnotado } from '@/app/actions/atendimento'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function htmlComanda(p: PedidoAnotado): string {
  const quando = new Date(p.criado_em)
  const dataHora = quando.toLocaleDateString('pt-BR') + ' ' +
    quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const canal = p.canal === 'delivery' ? 'DELIVERY' : 'ENCOMENDA'
  const cliente = p.nome || p.cliente_nome || '—'

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: 80mm auto; margin: 3mm; }
    * { margin: 0; padding: 0; }
    body { font-family: 'Courier New', monospace; color: #000; width: 72mm; }
    .center { text-align: center; }
    .titulo { font-size: 15px; font-weight: bold; padding: 2mm 0; border-bottom: 1px dashed #000; }
    .canal { font-size: 20px; font-weight: bold; padding: 2mm 0; }
    .linha { font-size: 13px; padding: 1mm 0; }
    .rotulo { font-size: 10px; text-transform: uppercase; }
    .destaque { font-size: 16px; font-weight: bold; }
    .endereco { font-size: 17px; font-weight: bold; border: 2px solid #000; padding: 2mm; margin: 2mm 0; }
    .rodape { font-size: 10px; border-top: 1px dashed #000; margin-top: 2mm; padding-top: 1mm; }
  </style></head><body>
    <div class="center titulo">FLOR DO TRIGO — PEDIDO DO ROBÔ</div>
    <div class="center canal">${canal}</div>
    <div class="linha rotulo">Recebido</div>
    <div class="linha">${esc(dataHora)}</div>
    <div class="linha rotulo">Produto</div>
    <div class="linha destaque">${esc(p.produto)}</div>
    ${p.quantidade && p.quantidade !== '?' ? `<div class="linha rotulo">Quantidade</div><div class="linha destaque">${esc(p.quantidade)}</div>` : ''}
    ${p.canal === 'delivery'
      ? `<div class="endereco">${p.endereco ? esc(p.endereco) : 'ENDEREÇO NÃO INFORMADO — VER PAINEL'}</div>`
      : (p.data_texto ? `<div class="linha rotulo">Retirada</div><div class="linha destaque">${esc(p.data_texto)}</div>` : '')}
    <div class="linha rotulo">Cliente</div>
    <div class="linha">${esc(cliente)}</div>
    <div class="linha">WhatsApp: ${esc(p.cliente_numero)}</div>
    <div class="rodape center">Valor em aberto — confirmar com o cliente.<br/>Fornada &middot; Atendimento</div>
  </body></html>`
}

// Fila: se chegarem vários pedidos de uma vez, imprime um por vez.
let imprimindo = false
const fila: PedidoAnotado[] = []

export function imprimirComanda(pedido: PedidoAnotado): void {
  fila.push(pedido)
  processarFila()
}

function processarFila(): void {
  if (imprimindo) return
  const pedido = fila.shift()
  if (!pedido) return
  imprimindo = true

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    imprimindo = false
    return
  }
  doc.open()
  doc.write(htmlComanda(pedido))
  doc.close()

  let finalizado = false
  const proximo = () => {
    if (finalizado) return
    finalizado = true
    setTimeout(() => {
      iframe.remove()
      imprimindo = false
      processarFila()
    }, 500)
  }

  setTimeout(() => {
    try {
      const w = iframe.contentWindow
      if (!w) { proximo(); return }
      w.onafterprint = proximo
      w.focus()
      w.print()
      // Fallback: se onafterprint não disparar (varia por navegador)
      setTimeout(proximo, 15_000)
    } catch (e) {
      console.error('Falha ao imprimir comanda:', e)
      proximo()
    }
  }, 250)
}
