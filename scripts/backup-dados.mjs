// Backup completo dos DADOS do Fornada em JSON.
//
// Por que existe: as migrations não recriam o banco (ver docs/baseline-migrations.md),
// e o plano free do Supabase pausa projeto inativo — e depois de 90 dias pausado
// não dá mais para despausar, só baixar os dados. Este script é a rede de
// segurança enquanto a baseline real não existe.
//
//   node scripts/backup-dados.mjs
//
// Gera backups/fornada-dados-AAAA-MM-DD.json (ignorado pelo git — são dados
// reais de cliente e o repo é público).

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean).map((l) => {
    const i = l.indexOf('=')
    return [l.slice(0, i), l.slice(i + 1)]
  }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// Ordem importa para uma eventual restauração: pai antes de filho.
const TABELAS = [
  'empresa', 'unidade', 'usuario_empresa', 'usuario_unidade', 'permissao',
  'config_geral', 'meta_faturamento', 'despesa_fixa_empresa',
  'insumo', 'insumo_preco', 'insumo_saldo', 'insumo_saldo_historico',
  'receita', 'receita_item',
  'produto', 'produto_preco',
  'cliente',
  'orcamento', 'orcamento_item',
  'encomenda', 'encomenda_item', 'encomenda_status_log',
  'compra', 'compra_item',
  'transferencia', 'transferencia_item',
  'atendimento_canal', 'atendimento_loja_info', 'atendimento_conversa',
  'atendimento_mensagem', 'atendimento_encomenda',
]

const PAGINA = 1000

async function baixarTudo(tabela) {
  const linhas = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await sb.from(tabela).select('*').range(de, de + PAGINA - 1)
    if (error) return { erro: error.message }
    linhas.push(...(data ?? []))
    if (!data || data.length < PAGINA) break
  }
  return { linhas }
}

const dump = { gerado_em: new Date().toISOString(), projeto: env.NEXT_PUBLIC_SUPABASE_URL, tabelas: {} }
const problemas = []
let total = 0

for (const t of TABELAS) {
  const r = await baixarTudo(t)
  if (r.erro) {
    problemas.push(`${t}: ${r.erro}`)
    console.log(`⚠️  ${t.padEnd(26)} ${r.erro}`)
    continue
  }
  dump.tabelas[t] = r.linhas
  total += r.linhas.length
  console.log(`   ${t.padEnd(26)} ${String(r.linhas.length).padStart(6)} linhas`)
}

mkdirSync('backups', { recursive: true })
const dia = new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' })
const arquivo = `backups/fornada-dados-${dia}.json`
writeFileSync(arquivo, JSON.stringify(dump, null, 2))

console.log(`\n✅ ${total} linhas de ${Object.keys(dump.tabelas).length} tabelas → ${arquivo}`)
if (problemas.length) {
  console.log(`\n⚠️  ${problemas.length} tabela(s) não exportada(s):`)
  problemas.forEach((p) => console.log('   ' + p))
}
console.log('\nOBS: este é um backup de DADOS, não de schema. A recriação do banco')
console.log('depende da baseline pendente — ver docs/baseline-migrations.md')
