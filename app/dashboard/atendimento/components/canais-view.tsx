'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, Plus, Loader2, Save, Bell, BellOff, Truck, ClipboardList, Zap, Store, Volume2, VolumeX } from 'lucide-react'
import {
  listarCanais, salvarCanal, listarInfoLojas, salvarInfoLoja,
  type CanalConfig, type InfoLojaConfig,
} from '@/app/actions/atendimento'
import type { CanalAtendimento } from '@/lib/atendimento/canal-tipos'

// Som e notificação de pedido novo são POR APARELHO (localStorage)
const SOM_KEY = 'fornada_atendimento_som'
const PUSH_KEY = 'fornada_atendimento_push'

// Aba "Robô": números de WhatsApp por loja/canal + aviso de pedido novo
// para a equipe (liga/desliga por canal — ex.: delivery avisa, encomendas não).
export function CanaisView() {
  const [canais, setCanais] = useState<CanalConfig[]>([])
  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([])
  const [infos, setInfos] = useState<InfoLojaConfig[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const [som, setSom] = useState(false)
  const [push, setPush] = useState(false)

  useEffect(() => {
    // localStorage só existe no cliente — init no mount evita mismatch de hidratação.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSom(localStorage.getItem(SOM_KEY) === '1')
    setPush(localStorage.getItem(PUSH_KEY) === '1')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])
  function toggleSom() {
    const novo = !som
    setSom(novo)
    localStorage.setItem(SOM_KEY, novo ? '1' : '0')
  }
  async function togglePush() {
    if (push) {
      setPush(false)
      localStorage.setItem(PUSH_KEY, '0')
      return
    }
    // Precisa da permissão do navegador (pergunta uma vez)
    if (typeof Notification === 'undefined') { alert('Este navegador não suporta notificações.'); return }
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (perm !== 'granted') { alert('Permissão de notificação negada no navegador.'); return }
    setPush(true)
    localStorage.setItem(PUSH_KEY, '1')
  }

  const carregar = useCallback(async () => {
    const [res, infoRes] = await Promise.all([listarCanais(), listarInfoLojas()])
    if (res.error || !res.data) setErro(res.error ?? 'Erro ao carregar')
    else {
      setErro(null)
      setCanais(res.data.canais)
      setUnidades(res.data.unidades)
    }
    if (infoRes.data) setInfos(infoRes.data.infos)
    setCarregando(false)
  }, [])

  // Carga inicial dos dados no mount (sem data layer do framework aqui).
  // eslint-disable-next-line react-hooks/set-state-in-effect
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

      {/* ── Som de pedido novo (este aparelho) ── */}
      <div className="card-surface p-4 flex items-center gap-3 flex-wrap">
        <button
          onClick={toggleSom}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            som
              ? 'bg-accent-primary/15 text-accent-primary border-accent-primary/30'
              : 'bg-input text-secondary border-transparent hover:text-primary'
          }`}
        >
          {som ? <Volume2 size={13} /> : <VolumeX size={13} />}
          {som ? 'Som de pedido novo: LIGADO' : 'Som de pedido novo'}
        </button>
        <button
          onClick={togglePush}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            push
              ? 'bg-accent-primary/15 text-accent-primary border-accent-primary/30'
              : 'bg-input text-secondary border-transparent hover:text-primary'
          }`}
        >
          {push ? <Bell size={13} /> : <BellOff size={13} />}
          {push ? 'Notificação do navegador: LIGADA' : 'Notificação do navegador'}
        </button>
        <p className="text-[11px] text-faint">
          Aviso sonoro e/ou notificação <b>neste aparelho</b> quando o robô anota um pedido (com o sistema aberto em qualquer tela).
        </p>
      </div>

      {/* ── Informações oficiais por loja ── */}
      <div className="rounded-xl bg-canvas border border-subtle px-4 py-3">
        <p className="text-sm text-primary flex items-center gap-2"><Store size={14} className="text-accent-primary" /> Informações oficiais da loja</p>
        <p className="text-xs text-faint mt-1">
          O que estiver preenchido aqui o robô <b>pode informar</b> ao cliente (horários, endereço, pagamento, entrega).
          O que ficar em branco, ele continua respondendo &quot;confirmo com a equipe&quot;.
        </p>
      </div>

      {infos.map((info) => (
        <InfoLojaCard key={info.unidade_id} info={info} />
      ))}
    </div>
  )
}

function InfoLojaCard({ info }: { info: InfoLojaConfig }) {
  const [horarios, setHorarios] = useState(info.horarios ?? '')
  const [endereco, setEndereco] = useState(info.endereco ?? '')
  const [pagamento, setPagamento] = useState(info.pagamento ?? '')
  const [entrega, setEntrega] = useState(info.entrega ?? '')
  const [extra, setExtra] = useState(info.extra ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  // Base = último estado salvo (para o botão Salvar aparecer só quando mudou)
  const [base, setBase] = useState({
    horarios: info.horarios ?? '', endereco: info.endereco ?? '',
    pagamento: info.pagamento ?? '', entrega: info.entrega ?? '', extra: info.extra ?? '',
  })

  const mudou =
    horarios.trim() !== base.horarios || endereco.trim() !== base.endereco ||
    pagamento.trim() !== base.pagamento || entrega.trim() !== base.entrega ||
    extra.trim() !== base.extra

  async function salvar() {
    setSalvando(true)
    setErro(null)
    setOk(false)
    const res = await salvarInfoLoja(info.unidade_id, { horarios, endereco, pagamento, entrega, extra })
    setSalvando(false)
    if (res.error) { setErro(res.error); return }
    setBase({ horarios: horarios.trim(), endereco: endereco.trim(), pagamento: pagamento.trim(), entrega: entrega.trim(), extra: extra.trim() })
    setOk(true)
  }

  const campos: { rotulo: string; valor: string; set: (v: string) => void; placeholder: string }[] = [
    { rotulo: 'Horários de funcionamento', valor: horarios, set: setHorarios, placeholder: 'ex: seg a sáb 6h–19h, dom 6h–12h' },
    { rotulo: 'Endereço da loja', valor: endereco, set: setEndereco, placeholder: 'ex: Rua do Trigo, 100 — Centro' },
    { rotulo: 'Formas de pagamento', valor: pagamento, set: setPagamento, placeholder: 'ex: dinheiro, pix, cartão (débito/crédito)' },
    { rotulo: 'Entrega (taxa/área/tempo)', valor: entrega, set: setEntrega, placeholder: 'ex: taxa R$ 5 no centro, ~40 min' },
    { rotulo: 'Outras informações', valor: extra, set: setExtra, placeholder: 'ex: encomendas de bolo com 48h de antecedência' },
  ]

  return (
    <div className="card-surface p-4 space-y-3">
      <p className="text-sm font-semibold text-primary flex items-center gap-2">
        <Store size={14} className="text-secondary" />
        {info.unidade_nome}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {campos.map((c) => (
          <div key={c.rotulo} className={c.rotulo === 'Outras informações' ? 'sm:col-span-2' : ''}>
            <label className="field-label">{c.rotulo}</label>
            <input type="text" value={c.valor} onChange={(e) => { c.set(e.target.value); setOk(false) }}
              placeholder={c.placeholder} className="input-field text-sm" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {mudou && (
          <button onClick={salvar} disabled={salvando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-primary/15 text-accent-primary border border-accent-primary/25 hover:bg-accent-primary/25 transition-colors disabled:opacity-50">
            {salvando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Salvar
          </button>
        )}
        {ok && <span className="text-xs text-success">Salvo ✓ — o robô já usa na próxima mensagem</span>}
        {erro && <span className="text-xs text-danger">{erro}</span>}
      </div>
    </div>
  )
}

function CanalCard({ canal: c, onSalvo }: { canal: CanalConfig; onSalvo: () => void }) {
  const [avisarAtivo, setAvisarAtivo] = useState(c.avisar_ativo)
  const [avisarNumero, setAvisarNumero] = useState(c.avisar_numero ?? '')
  const [avisarTemplate, setAvisarTemplate] = useState(c.avisar_template ?? '')
  const [ativo, setAtivo] = useState(c.ativo)
  const [pedidoAuto, setPedidoAuto] = useState(c.pedido_auto)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const mudou = avisarAtivo !== c.avisar_ativo || (avisarNumero.trim() || null) !== (c.avisar_numero ?? null) ||
    (avisarTemplate.trim() || null) !== (c.avisar_template ?? null) || ativo !== c.ativo || pedidoAuto !== c.pedido_auto
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
      avisar_template: avisarTemplate,
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
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[11px] text-secondary uppercase tracking-wider shrink-0">Template aprovado (opcional):</label>
            <input
              type="text"
              value={avisarTemplate}
              onChange={(e) => setAvisarTemplate(e.target.value)}
              placeholder="ex: aviso_pedido"
              className="input-field text-xs py-1.5 px-2 w-48"
              title="Nome de um template aprovado na Meta com {{1}} no corpo — o aviso passa a chegar SEMPRE, sem depender da janela de 24h"
            />
          </div>
          <p className="text-[11px] text-faint">
            {avisarTemplate.trim()
              ? <>Com template, o aviso <b>fura a janela de 24h</b> e chega sempre. O template precisa estar aprovado na Meta com <code>{'{{1}}'}</code> no corpo (se falhar, caímos na mensagem livre).</>
              : <>Sem template: para o aviso chegar, o número da equipe deve mandar um &quot;oi&quot; para o robô a cada 24h. Aprove um template na Meta (corpo com <code>{'{{1}}'}</code>) e informe o nome aqui para eliminar essa limitação.</>}
          </p>
        </div>
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
