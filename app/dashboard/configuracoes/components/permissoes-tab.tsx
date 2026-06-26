'use client'

import { useState, useTransition } from 'react'
import { useUnidade } from '@/app/context/unidade-context'
import {
  Shield, Loader2, Check, X, Plus, UserPlus,
  Pencil, KeyRound, UserX, ChevronLeft, Trash2,
} from 'lucide-react'
import {
  savePermissionsAction,
  createUserAction,
  disableUserAction,
  resetPasswordAction,
  deleteUserAction,
} from '@/app/actions/permissoes'
import type { PermissaoInput } from '@/app/actions/permissoes'
import { TELAS, TELA_LABEL } from '@/app/lib/permissions'
import type { UsuarioComPermissoes, PermissaoInicialInput } from '@/app/actions/permissoes'
import type { NivelAcesso } from '@/app/lib/permissions'

interface Props {
  usuarios: UsuarioComPermissoes[]
  unidades: { id: string; nome: string }[]
  currentUserId: string
}

const ACESSO_OPTS: { value: NivelAcesso; label: string }[] = [
  { value: 'leitura', label: 'Leitura' },
  { value: 'escrita', label: 'Escrita' },
  { value: 'admin',   label: 'Admin'   },
]

// ── Subcomponente: grade de permissões ───────────────────────────────────────
function PermissaoGrade({
  permissoes,
  onChange,
  hideGlobal = false,
}: {
  permissoes: Record<string, NivelAcesso | 'none'>
  onChange: (tela: string, valor: NivelAcesso | 'none') => void
  hideGlobal?: boolean
}) {
  // Admin Global ativo bloqueia edição das telas individuais
  const adminGlobalAtivo = !hideGlobal && permissoes['*'] === 'admin'

  return (
    <div className="rounded-xl overflow-hidden border border-subtle">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-4 py-2.5 bg-canvas border-b border-subtle">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Tela</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-16 text-center">Sem acesso</span>
        {ACESSO_OPTS.map((o) => (
          <span key={o.value} className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-16 text-center">{o.label}</span>
        ))}
      </div>

      {adminGlobalAtivo && (
        <p className="px-4 py-2 text-[11px] text-accent-primary/80 bg-accent-primary/5 border-b border-subtle">
          Admin Global ativo — acesso total a todas as telas. Para restringir uma tela específica, remova Admin Global primeiro.
        </p>
      )}

      <div className="divide-y divide-subtle">
        {(['*', ...TELAS] as const).filter((tela) => !hideGlobal || tela !== '*').map((tela) => {
          const label = tela === '*' ? '★ Admin global (todas as telas)' : TELA_LABEL[tela]
          const efetivo = permissoes[tela] ?? 'none'
          // Telas individuais ficam desabilitadas enquanto Admin Global estiver ativo
          const desabilitada = adminGlobalAtivo && tela !== '*'
          return (
            <div key={tela} className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 px-4 py-2.5 ${tela === '*' ? 'bg-accent-primary/5' : desabilitada ? 'opacity-40' : 'hover:bg-input/40'}`}>
              <span className={`text-sm ${tela === '*' ? 'font-semibold text-accent-primary' : 'text-primary'}`}>{label}</span>
              <div className="w-16 flex justify-center">
                <button
                  onClick={() => !desabilitada && onChange(tela, 'none')}
                  disabled={desabilitada}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${efetivo === 'none' ? 'border-danger bg-danger/20 text-danger' : 'border-subtle text-faint hover:border-subtle/80'} ${desabilitada ? 'cursor-not-allowed' : ''}`}
                >
                  {efetivo === 'none' && <X size={9} />}
                </button>
              </div>
              {ACESSO_OPTS.map((opt) => (
                <div key={opt.value} className="w-16 flex justify-center">
                  <button
                    onClick={() => !desabilitada && onChange(tela, opt.value)}
                    disabled={desabilitada}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${efetivo === opt.value ? opt.value === 'admin' ? 'border-accent-primary bg-accent-primary/20 text-accent-primary' : 'border-success bg-success/20 text-success' : 'border-subtle text-faint hover:border-subtle/80'} ${desabilitada ? 'cursor-not-allowed' : ''}`}
                  >
                    {efetivo === opt.value && <Check size={9} />}
                  </button>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export function PermissoesTab({ usuarios: usuariosIniciais, unidades, currentUserId }: Props) {
  const { unidadeAtual } = useUnidade()
  const [usuarios, setUsuarios] = useState(usuariosIniciais)

  // Vista: 'lista' | 'editar' | 'novo' | 'reset' | 'desabilitar' | 'excluir'
  type Vista = 'lista' | 'editar' | 'novo' | 'reset' | 'desabilitar' | 'excluir'
  const [vista, setVista] = useState<Vista>('lista')
  const [targetUser, setTargetUser] = useState<UsuarioComPermissoes | null>(null)

  // Edição de permissões
  const [pendente, setPendente] = useState<Record<string, NivelAcesso | 'none'>>({})
  const [escopoEditar, setEscopoEditar] = useState<string | null>(null) // null = todas as unidades
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  // Modal novo usuário
  const [novoEmail, setNovoEmail] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [novoTipoAcesso, setNovoTipoAcesso] = useState<'admin_global' | 'personalizado'>('admin_global')
  // Map: '__global__' | unidade_id → permissoes do escopo
  const [novoPermsMap, setNovoPermsMap] = useState<Record<string, Record<string, NivelAcesso | 'none'>>>({})
  const [novoEscopoAtivo, setNovoEscopoAtivo] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [erroModal, setErroModal] = useState('')

  // Reset senha
  const [novaSenhaReset, setNovaSenhaReset] = useState('')
  const [resetando, setResetando] = useState(false)
  const [erroReset, setErroReset] = useState('')

  // Desabilitar
  const [desabilitando, setDesabilitando] = useState(false)
  const [erroDesabilitar, setErroDesabilitar] = useState('')

  // Excluir
  const [excluindo, setExcluindo] = useState(false)
  const [erroExcluir, setErroExcluir] = useState('')

  // ── helpers ──────────────────────────────────────────────────────────────

  function abrirEditar(u: UsuarioComPermissoes) {
    const mapa: Record<string, NivelAcesso | 'none'> = {}
    for (const p of u.permissoes) {
      if (p.unidade_id === null) mapa[p.tela] = p.acesso
    }
    setTargetUser(u)
    setEscopoEditar(null)
    setPendente(mapa)
    setFeedback(null)
    setVista('editar')
  }

  // Troca o escopo (unidade) que está sendo editado e recarrega a grade
  function trocarEscopoEditar(novo: string | null) {
    if (!targetUser) return
    setEscopoEditar(novo)
    const mapa: Record<string, NivelAcesso | 'none'> = {}
    for (const p of targetUser.permissoes) {
      if (p.unidade_id === novo) mapa[p.tela] = p.acesso
    }
    setPendente(mapa)
    setFeedback(null)
  }

  function voltar() {
    setVista('lista')
    setTargetUser(null)
    setPendente({})
    setFeedback(null)
    setNovaSenhaReset('')
    setErroReset('')
    setErroDesabilitar('')
  }

  function abrirNovo() {
    setNovoEmail('')
    setNovoNome('')
    setNovaSenha('')
    setNovoTipoAcesso('admin_global')
    setNovoPermsMap({})
    // Padrão: primeira unidade (não global), para não virar admin das duas lojas por acidente
    setNovoEscopoAtivo(unidadeAtual?.id ?? unidades[0]?.id ?? null)
    setErroModal('')
    setVista('novo')
  }

  // ── salvar permissões ────────────────────────────────────────────────────

  function handleSalvar() {
    if (!targetUser) return
    const tu = targetUser
    const escopo = escopoEditar
    setFeedback(null)
    startTransition(async () => {
      const toUpsert: PermissaoInput[] = []

      for (const [tela, acesso] of Object.entries(pendente)) {
        if (acesso !== 'none') toUpsert.push({ usuario_id: tu.id, tela, acesso, unidade_id: escopo })
      }

      // Sempre chama savePermissionsAction — mesmo com toUpsert vazio,
      // o DELETE limpa permissões antigas do escopo (ex: globais null que sobraram).
      const r = await savePermissionsAction(tu.id, escopo, toUpsert)
      if (r.error) { setFeedback({ ok: false, msg: r.error }); return }

      // Atualiza estado local trocando apenas as permissões do escopo (unidade) atual
      const novasPerms = [
        ...tu.permissoes.filter((p) => p.unidade_id !== escopo),
        ...toUpsert.map((up) => ({ tela: up.tela, acesso: up.acesso, unidade_id: escopo })),
      ]
      const isAdminGlobal = novasPerms.some((p) => p.tela === '*' && p.acesso === 'admin' && p.unidade_id === null)
      const tuAtualizado = { ...tu, permissoes: novasPerms, isAdminGlobal }
      setTargetUser(tuAtualizado)
      setUsuarios((prev) => prev.map((u) => (u.id === tu.id ? tuAtualizado : u)))

      setFeedback({ ok: true, msg: escopo ? 'Permissões da unidade salvas.' : 'Permissões salvas.' })
    })
  }

  // ── criar usuário ────────────────────────────────────────────────────────

  async function handleCriarUsuario() {
    if (!novoEmail.trim() || !novaSenha || !novoNome.trim()) {
      setErroModal('Preencha todos os campos.')
      return
    }
    if (novaSenha.length < 6) {
      setErroModal('Senha deve ter pelo menos 6 caracteres.')
      return
    }
    setCriando(true)
    setErroModal('')

    // Achata o map de permissões por escopo em array plano para a action
    const permissoesPersonalizadas = Object.entries(novoPermsMap).flatMap(([scopeKey, perms]) => {
      const unidade_id = scopeKey === '__global__' ? null : scopeKey
      return Object.entries(perms)
        .filter(([, v]) => v !== 'none')
        .map(([tela, acesso]) => ({ tela, acesso: acesso as NivelAcesso, unidade_id }))
    })

    const permissaoInicial: PermissaoInicialInput =
      novoTipoAcesso === 'admin_global'
        ? { tipo: 'admin_global' }
        : { tipo: 'personalizado', permissoes: permissoesPersonalizadas }

    const result = await createUserAction(novoEmail.trim(), novaSenha, novoNome.trim(), permissaoInicial)
    setCriando(false)

    if (result.error) { setErroModal(result.error); return }

    if (result.data) {
      const permsNovo =
        novoTipoAcesso === 'admin_global'
          ? [{ tela: '*', acesso: 'admin' as NivelAcesso, unidade_id: null }]
          : permissoesPersonalizadas.map((p) => ({ tela: p.tela, acesso: p.acesso, unidade_id: p.unidade_id ?? null }))

      const novo: UsuarioComPermissoes = {
        id: result.data.id,
        email: result.data.email,
        nome: novoNome.trim(),
        isAdminGlobal: novoTipoAcesso === 'admin_global',
        permissoes: permsNovo,
        criadoEm: new Date().toISOString(),
      }
      setUsuarios((prev) => [...prev, novo])
    }
    voltar()
  }

  // ── resetar senha ─────────────────────────────────────────────────────────

  async function handleResetSenha() {
    if (!targetUser) return
    if (novaSenhaReset.length < 6) { setErroReset('Mínimo 6 caracteres.'); return }
    setResetando(true)
    setErroReset('')
    const r = await resetPasswordAction(targetUser.id, novaSenhaReset)
    setResetando(false)
    if (r.error) { setErroReset(r.error); return }
    setNovaSenhaReset('')
    setFeedback({ ok: true, msg: `Senha de ${targetUser.email} redefinida.` })
    voltar()
  }

  // ── excluir usuário permanentemente ──────────────────────────────────────

  async function handleExcluir() {
    if (!targetUser) return
    setExcluindo(true)
    setErroExcluir('')
    const r = await deleteUserAction(targetUser.id)
    setExcluindo(false)
    if (r.error) { setErroExcluir(r.error); return }
    setUsuarios((prev) => prev.filter((u) => u.id !== targetUser.id))
    voltar()
  }

  // ── desabilitar usuário ───────────────────────────────────────────────────

  async function handleDesabilitar() {
    if (!targetUser) return
    setDesabilitando(true)
    setErroDesabilitar('')
    const r = await disableUserAction(targetUser.id)
    setDesabilitando(false)
    if (r.error) { setErroDesabilitar(r.error); return }
    setUsuarios((prev) => prev.map((u) =>
      u.id === targetUser.id ? { ...u, permissoes: [], isAdminGlobal: false } : u
    ))
    voltar()
  }

  // ── RENDER: lista de usuários ─────────────────────────────────────────────

  if (vista === 'lista') {
    return (
      <div className="space-y-4">
        {feedback && (
          <p className={`text-sm ${feedback.ok ? 'text-success' : 'text-danger'}`}>{feedback.msg}</p>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-secondary">{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''}</p>
          <button
            onClick={abrirNovo}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-sm font-semibold shadow-sm transition-colors"
          >
            <UserPlus size={14} />
            Novo Usuário
          </button>
        </div>

        <div className="rounded-xl overflow-hidden border border-subtle">
          {/* Cabeçalho */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-5 py-3 bg-canvas border-b border-subtle">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Usuário</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-28 text-center">Acesso</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-8" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-8" />
          </div>

          <div className="divide-y divide-subtle">
            {usuarios.map((u) => {
              const ehVoce = u.id === currentUserId
              const desabilitado = u.permissoes.length === 0
              return (
                <div key={u.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-5 py-3.5 hover:bg-input/40 transition-colors">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${desabilitado ? 'text-faint line-through' : 'text-primary'}`}>
                      {u.nome || u.email}
                      {ehVoce && <span className="ml-2 text-[10px] text-accent-primary font-semibold">(você)</span>}
                    </p>
                    <p className="text-xs text-secondary truncate">{u.email}</p>
                  </div>

                  <div className="w-28 flex justify-center">
                    {desabilitado ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-danger-tint text-danger border border-danger/20">
                        Desabilitado
                      </span>
                    ) : u.isAdminGlobal ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-primary/15 text-accent-primary border border-accent-primary/25">
                        Admin Global
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-tint text-success border border-success/20">
                        {u.permissoes.length} tela{u.permissoes.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Editar permissões */}
                  <button
                    onClick={() => abrirEditar(u)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-accent-primary hover:bg-accent-primary/10 transition-all"
                    title="Editar permissões"
                  >
                    <Pencil size={14} />
                  </button>

                  {/* Mais ações */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setTargetUser(u); setVista('reset') }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                      title="Resetar senha"
                    >
                      <KeyRound size={14} />
                    </button>
                    {!ehVoce && (
                      <button
                        onClick={() => { setTargetUser(u); setVista('desabilitar') }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-danger hover:bg-danger-tint transition-all"
                        title="Desabilitar acesso"
                      >
                        <UserX size={14} />
                      </button>
                    )}
                    {!ehVoce && (
                      <button
                        onClick={() => { setTargetUser(u); setErroExcluir(''); setVista('excluir') }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-danger hover:bg-danger-tint transition-all"
                        title="Excluir usuário permanentemente"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-xs text-faint">
          Admin global (★) tem acesso a todas as telas. Desabilitar remove todas as permissões sem excluir o usuário.
        </p>
      </div>
    )
  }

  // ── RENDER: editar permissões ─────────────────────────────────────────────

  if (vista === 'editar' && targetUser) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={voltar} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-input transition-all">
            <ChevronLeft size={16} />
          </button>
          <div>
            <p className="text-sm font-semibold text-primary">{targetUser.nome || targetUser.email}</p>
            <p className="text-xs text-secondary">{targetUser.email}</p>
          </div>
        </div>

        {unidades.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-secondary mr-1">Escopo:</span>
            <button
              onClick={() => trocarEscopoEditar(null)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${escopoEditar === null ? 'bg-accent-primary/15 text-accent-primary border-accent-primary/25' : 'text-secondary border-subtle hover:bg-input/50'}`}
            >
              Todas as unidades
            </button>
            {unidades.map((u) => (
              <button
                key={u.id}
                onClick={() => trocarEscopoEditar(u.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${escopoEditar === u.id ? 'bg-accent-primary/15 text-accent-primary border-accent-primary/25' : 'text-secondary border-subtle hover:bg-input/50'}`}
              >
                {u.nome}
              </button>
            ))}
          </div>
        )}
        {escopoEditar !== null && (
          <p className="text-[11px] text-faint -mt-1">
            Permissões aplicadas só a esta unidade. &quot;Admin global&quot; existe apenas em &quot;Todas as unidades&quot;.
          </p>
        )}

        <PermissaoGrade
          permissoes={pendente}
          hideGlobal={escopoEditar !== null}
          onChange={(tela, valor) => { setPendente((p) => ({ ...p, [tela]: valor })); setFeedback(null) }}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={voltar}
            className="px-5 py-2.5 rounded-lg border border-subtle text-secondary hover:text-primary hover:bg-input text-sm font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-sm font-semibold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
            {isPending ? 'Salvando...' : 'Salvar Permissões'}
          </button>
          {feedback && <p className={`text-sm ${feedback.ok ? 'text-success' : 'text-danger'}`}>{feedback.msg}</p>}
        </div>
      </div>
    )
  }

  // ── RENDER: novo usuário ──────────────────────────────────────────────────

  if (vista === 'novo') {
    return (
      <div className="space-y-5 max-w-lg">
        <div className="flex items-center gap-3">
          <button onClick={voltar} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-input transition-all">
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-accent-primary" />
            <h2 className="font-playfair text-primary text-lg font-bold">Novo Usuário</h2>
          </div>
        </div>

        {/* Dados básicos */}
        <div className="card-surface px-5 py-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-primary">Dados</p>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">Nome</label>
            <input type="text" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: Natali Tognetti" className="input-field w-full" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">E-mail</label>
            <input type="email" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} placeholder="usuario@empresa.com.br" className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">Senha inicial</label>
            <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" className="input-field w-full" />
          </div>
        </div>

        {/* Permissões iniciais */}
        <div className="card-surface px-5 py-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-primary">Permissões Iniciais</p>
          <div className="flex gap-3">
            <button
              onClick={() => setNovoTipoAcesso('admin_global')}
              className={`flex-1 px-4 py-3 rounded-xl border-2 text-sm font-semibold text-left transition-all ${novoTipoAcesso === 'admin_global' ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-subtle text-secondary hover:border-subtle/70'}`}
            >
              <p className="font-bold">★ Admin Global</p>
              <p className="text-xs font-normal mt-0.5 opacity-70">Acesso completo a todas as telas</p>
            </button>
            <button
              onClick={() => setNovoTipoAcesso('personalizado')}
              className={`flex-1 px-4 py-3 rounded-xl border-2 text-sm font-semibold text-left transition-all ${novoTipoAcesso === 'personalizado' ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-subtle text-secondary hover:border-subtle/70'}`}
            >
              <p className="font-bold">Personalizado</p>
              <p className="text-xs font-normal mt-0.5 opacity-70">Definir tela por tela</p>
            </button>
          </div>

          {novoTipoAcesso === 'personalizado' && (
            <>
              {unidades.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-secondary mr-1">Escopo:</span>
                  <button
                    onClick={() => setNovoEscopoAtivo(null)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${novoEscopoAtivo === null ? 'bg-accent-primary/15 text-accent-primary border-accent-primary/25' : 'text-secondary border-subtle hover:bg-input/50'}`}
                  >
                    Todas as unidades
                  </button>
                  {unidades.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setNovoEscopoAtivo(u.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${novoEscopoAtivo === u.id ? 'bg-accent-primary/15 text-accent-primary border-accent-primary/25' : 'text-secondary border-subtle hover:bg-input/50'}`}
                    >
                      {u.nome}
                    </button>
                  ))}
                </div>
              )}
              {novoEscopoAtivo !== null && (
                <p className="text-[11px] text-faint -mt-1">
                  Permissões aplicadas só a esta unidade. &quot;Admin global&quot; existe apenas em &quot;Todas as unidades&quot;.
                </p>
              )}
              <PermissaoGrade
                permissoes={novoPermsMap[novoEscopoAtivo === null ? '__global__' : novoEscopoAtivo] ?? {}}
                hideGlobal={novoEscopoAtivo !== null}
                onChange={(tela, valor) => {
                  const key = novoEscopoAtivo === null ? '__global__' : novoEscopoAtivo
                  setNovoPermsMap((prev) => ({ ...prev, [key]: { ...(prev[key] ?? {}), [tela]: valor } }))
                }}
              />
            </>
          )}
        </div>

        {erroModal && <p className="text-danger text-sm">{erroModal}</p>}

        <div className="flex gap-2">
          <button onClick={voltar} className="flex-1 px-4 py-2.5 rounded-lg border border-subtle text-secondary hover:text-primary hover:bg-input text-sm font-semibold transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleCriarUsuario}
            disabled={criando}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            {criando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {criando ? 'Criando...' : 'Criar Usuário'}
          </button>
        </div>
      </div>
    )
  }

  // ── RENDER: resetar senha ─────────────────────────────────────────────────

  if (vista === 'reset' && targetUser) {
    return (
      <div className="space-y-5 max-w-sm">
        <div className="flex items-center gap-3">
          <button onClick={voltar} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-input transition-all">
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-amber-400" />
            <h2 className="font-playfair text-primary text-lg font-bold">Redefinir Senha</h2>
          </div>
        </div>

        <div className="card-surface px-5 py-4 space-y-3">
          <p className="text-sm text-secondary">
            Definir nova senha para <span className="text-primary font-medium">{targetUser.email}</span>
          </p>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">Nova Senha</label>
            <input
              type="password"
              value={novaSenhaReset}
              onChange={(e) => setNovaSenhaReset(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="input-field w-full"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleResetSenha()}
            />
          </div>
          {erroReset && <p className="text-danger text-sm">{erroReset}</p>}
        </div>

        <div className="flex gap-2">
          <button onClick={voltar} className="flex-1 px-4 py-2.5 rounded-lg border border-subtle text-secondary hover:text-primary hover:bg-input text-sm font-semibold transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleResetSenha}
            disabled={resetando}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            {resetando ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            {resetando ? 'Redefinindo...' : 'Redefinir Senha'}
          </button>
        </div>
      </div>
    )
  }

  // ── RENDER: confirmar excluir ─────────────────────────────────────────────

  if (vista === 'excluir' && targetUser) {
    return (
      <div className="space-y-5 max-w-sm">
        <div className="flex items-center gap-3">
          <button onClick={voltar} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-input transition-all">
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <Trash2 size={18} className="text-danger" />
            <h2 className="font-playfair text-primary text-lg font-bold">Excluir Usuário</h2>
          </div>
        </div>

        <div className="rounded-xl border border-danger/30 bg-danger-tint px-5 py-4 space-y-2">
          <p className="text-sm text-danger font-medium">
            Tem certeza que deseja <strong>excluir permanentemente</strong> <span className="font-bold">{targetUser.email}</span>?
          </p>
          <p className="text-xs text-danger/70">
            Esta ação não pode ser desfeita. O usuário será removido do Supabase Auth e todos os dados associados serão apagados.
          </p>
        </div>

        {erroExcluir && <p className="text-danger text-sm">{erroExcluir}</p>}

        <div className="flex gap-2">
          <button onClick={voltar} className="flex-1 px-4 py-2.5 rounded-lg border border-subtle text-secondary hover:text-primary hover:bg-input text-sm font-semibold transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleExcluir}
            disabled={excluindo}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-danger hover:bg-danger/80 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {excluindo ? 'Excluindo...' : 'Excluir Permanentemente'}
          </button>
        </div>
      </div>
    )
  }

  // ── RENDER: confirmar desabilitar ─────────────────────────────────────────

  if (vista === 'desabilitar' && targetUser) {
    return (
      <div className="space-y-5 max-w-sm">
        <div className="flex items-center gap-3">
          <button onClick={voltar} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-input transition-all">
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <UserX size={18} className="text-danger" />
            <h2 className="font-playfair text-primary text-lg font-bold">Desabilitar Acesso</h2>
          </div>
        </div>

        <div className="rounded-xl border border-danger/30 bg-danger-tint px-5 py-4 space-y-2">
          <p className="text-sm text-danger font-medium">
            Tem certeza que deseja remover o acesso de <span className="font-bold">{targetUser.email}</span>?
          </p>
          <p className="text-xs text-danger/70">
            O usuário perderá acesso a todas as telas do sistema. A conta no Supabase Auth não será excluída — é possível reabilitar atribuindo novas permissões.
          </p>
        </div>

        {erroDesabilitar && <p className="text-danger text-sm">{erroDesabilitar}</p>}

        <div className="flex gap-2">
          <button onClick={voltar} className="flex-1 px-4 py-2.5 rounded-lg border border-subtle text-secondary hover:text-primary hover:bg-input text-sm font-semibold transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleDesabilitar}
            disabled={desabilitando}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-danger hover:bg-danger/80 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            {desabilitando ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}
            {desabilitando ? 'Desabilitando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    )
  }

  return null
}
