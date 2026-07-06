'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, Plus, Loader2, Save, Bell, BellOff, Truck, ClipboardList, Zap } from 'lucide-react'
import { listarCanais, salvarCanal, type CanalConfig } from '@/app/actions/atendimento'
import type { CanalAtendimento } from '@/lib/atendimento/canal-tipos'

// Aba "Robô": números de WhatsApp por loja/canal + aviso de pedido novo
// para a equipe (liga/desliga por canal — ex.: delivery avisa, encomendas não).
export function CanaisView() {
  const [canais, setCanais] = useState<CanalConfig[]>([])
  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)

  const carregar = useCallback(async () => {
    const res = await listarCanais()
    if (res.error || !res.data) setErro(res.error ?? 'Erro ao carregar')
    else {
      setErro(null)
      setCanais(res.data.canais)
      setUnidades(res.data.unidades)
    }
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (carregando) {
    return <div className="flex items-center justify-center py-16 text-secondary"><Loader2 size={20} className="animate-spin" /></div>
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-xl bg-canvas border border-subtle px-4 py-3">
        <p className="text-sm text-primary flex items-center gap-2"><Bot size={14} className="text-accent-primary" /> Números do robô</p>
        <p className="text-xs text-faint mt-1">
          Cada loja pode ter um número de <b>Encomendas</b> e um de <b>Delivery</b> (Phone Number ID vem do painel da Meta).
          O aviso de pedido novo manda um resumo no WhatsApp da equipe — dá para ligar/desligar por número.
        </p>
      </div>

      {erro && <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{erro}</p>}

      {canais.map((c) => (
        <CanalCard key={c.id} canal={c} onSalvo={carregar} />
      ))}

      {canais.length === 0 && !erro && (
        <p className="text-sm text-secondary text-center py-6">Nenhum número cadastrado ainda.</p>
      )}

      {novoAberto ? (
        <NovoCanalForm unidades={unidades} onClose={() => setNovoAberto(false)} onSalvo={() => { setNovoAberto(false); carregar() }} />
      ) : (
        <button onClick={() => setNovoAberto(true)} className="btn-primary">
          <Plus size={16} />
          Adicionar número
        </button>
      )}
    </div>
  )
}

function CanalCard({ canal: c, onSalvo }: { canal: CanalConfig; onSalvo: () => void }) {
  const [avisarAtivo, setAvisarAtivo] = useState(c.avisar_ativo)
  const [avisarNumero, setAvisarNumero] = useState(c.avisar_numero ?? '')
  const [ativo, setAtivo] = useState(c.ativo)
  const [pedidoAuto, setPedidoAuto] = useState(c.pedido_auto)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const mudou = avisarAtivo !== c.avisar_ativo || (avisarNumero.trim() || null) !== (c.avisar_numero ?? null) || ativo !== c.ativo || pedidoAuto !== c.pedido_auto
  const CanalIcon = c.canal === 'delivery' ? Truck : ClipboardList

  async function salvar() {
    setSalvando(true)
    setErro(null)
    setOk(false)
    const res = await salvarCanal({
      id: c.id,
      unidade_id: c.unidade_id,
      canal: c.canal,
      phone_number_id: c.phone_number_id,
      numero_exibicao: c.numero_exibicao,
      ativo,
      avisar_ativo: avisarAtivo,
      avisar_numero: avisarNumero,
      pedido_auto: pedidoAuto,
    })
    setSalvando(false)
    if (res.error) { setErro(res.error); return }
    setOk(true)
    onSalvo()
  }

  return (
    <div className="card-surface p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border ${
          c.canal === 'delivery'
            ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
            : 'bg-accent-primary/15 text-accent-primary border-accent-primary/25'
        }`}>
          <CanalIcon size={11} />
          {c.canal === 'delivery' ? 'Delivery' : 'Encomendas'}
        </span>
        <span className="text-sm font-semibold text-primary">{c.unidade_nome}</span>
        {c.numero_exibicao && <span className="text-xs text-secondary">· {c.numero_exibicao}</span>}
        <span className="text-[11px] text-faint ml-auto tabular-nums" title="Phone Number ID (painel da Meta)">
          ID {c.phone_number_id}
        </span>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)}
            className="accent-[var(--color-accent-primary)]" />
          <span className="text-sm text-primary">Número ativo</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none" title="Manda um resumo do pedido no WhatsApp da equipe assim que o robô anotar">
          <input type="checkbox" checked={avisarAtivo} onChange={(e) => setAvisarAtivo(e.target.checked)}
            className="accent-[var(--color-accent-primary)]" />
          <span className="text-sm text-primary flex items-center gap-1.5">
            {avisarAtivo ? <Bell size={13} className="text-accent-primary" /> : <BellOff size={13} className="text-secondary/50" />}
            Avisar equipe no WhatsApp
          </span>
        </label>

        {avisarAtivo && (
          <input
            type="text"
            inputMode="numeric"
            value={avisarNumero}
            onChange={(e) => setAvisarNumero(e.target.value)}
            placeholder="Número da equipe (ex: 5511999999999)"
            className="input-field text-xs py-1.5 px-2 w-64"
          />
        )}

        <label className="flex items-center gap-2 cursor-pointer select-none"
          title="Todo pedido anotado pelo robô já vira encomenda oficial (entrega hoje, valor em aberto) no módulo de Encomendas">
          <input type="checkbox" checked={pedidoAuto} onChange={(e) => setPedidoAuto(e.target.checked)}
            className="accent-[var(--color-accent-primary)]" />
          <span className="text-sm text-primary flex items-center gap-1.5">
            <Zap size={13} className={pedidoAuto ? 'text-accent-primary' : 'text-secondary/50'} />
            Virar pedido automaticamente
          </span>
        </label>

        {mudou && (
          <button onClick={salvar} disabled={salvando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-primary/15 text-accent-primary border border-accent-primary/25 hover:bg-accent-primary/25 transition-colors disabled:opacity-50">
            {salvando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Salvar
          </button>
        )}
        {ok && !mudou && <span className="text-xs text-success">Salvo ✓</span>}
      </div>

      {avisarAtivo && (
        <p className="text-[11px] text-faint">
          Dica: para o aviso chegar sempre, o número da equipe deve mandar um &quot;oi&quot; para o robô de vez em quando
          (a Meta só libera mensagem livre dentro de 24h desde o último contato).
        </p>
      )}
      {erro && <p className="text-xs text-danger bg-danger-tint rounded-lg px-3 py-2">{erro}</p>}
    </div>
  )
}

function NovoCanalForm({
  unidades, onClose, onSalvo,
}: {
  unidades: { id: string; nome: string }[]
  onClose: () => void
  onSalvo: () => void
}) {
  const [unidadeId, setUnidadeId] = useState(unidades[0]?.id ?? '')
  const [canal, setCanal] = useState<CanalAtendimento>('delivery')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [numeroExibicao, setNumeroExibicao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    setSalvando(true)
    setErro(null)
    const res = await salvarCanal({
      unidade_id: unidadeId,
      canal,
      phone_number_id: phoneNumberId,
      numero_exibicao: numeroExibicao || null,
    })
    setSalvando(false)
    if (res.error) { setErro(res.error); return }
    onSalvo()
  }

  return (
    <div className="card-surface p-4 space-y-3">
      <p className="text-sm font-semibold text-primary">Adicionar número</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="field-label">Loja</label>
          <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} className="input-field">
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Canal</label>
          <select value={canal} onChange={(e) => setCanal(e.target.value as CanalAtendimento)} className="input-field">
            <option value="delivery">Delivery</option>
            <option value="encomendas">Encomendas</option>
          </select>
        </div>
        <div>
          <label className="field-label">Phone Number ID (Meta)</label>
          <input type="text" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="ex: 1188750080984804" className="input-field" />
        </div>
        <div>
          <label className="field-label">Apelido (opcional)</label>
          <input type="text" value={numeroExibicao} onChange={(e) => setNumeroExibicao(e.target.value)}
            placeholder="ex: (11) 99999-9999 delivery" className="input-field" />
        </div>
      </div>
      {erro && <p className="text-xs text-danger bg-danger-tint rounded-lg px-3 py-2">{erro}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-secondary hover:text-primary transition-colors">Cancelar</button>
        <button onClick={salvar} disabled={salvando || !phoneNumberId.trim()} className="btn-primary disabled:opacity-50">
          {salvando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Adicionar
        </button>
      </div>
    </div>
  )
}
