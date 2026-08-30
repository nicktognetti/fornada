/**
 * Pãozinho soltando fumaça — indicador de "assando" (carregando/salvando).
 * Sem hooks: pode ser usado em server e client components.
 */

export function Paozinho({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex ${className}`} style={{ width: size, height: size }} aria-label="Carregando" role="status">
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <style>{`
          @keyframes pao-fumaca {
            0%   { opacity: 0; transform: translateY(4px) scaleX(1); }
            30%  { opacity: .8; }
            100% { opacity: 0; transform: translateY(-9px) scaleX(1.35); }
          }
          @keyframes pao-quica {
            0%, 100% { transform: translateY(0); }
            50%      { transform: translateY(1.2px); }
          }
          .pao-corpo { animation: pao-quica 1.6s ease-in-out infinite; transform-origin: center 80%; }
          .pao-f { animation: pao-fumaca 1.6s ease-out infinite; }
          .pao-f2 { animation-delay: .45s; }
          .pao-f3 { animation-delay: .9s; }
        `}</style>
        {/* fumaça */}
        <path className="pao-f" d="M17 16c0-2 1.6-2.4 1.6-4S17 9.6 17 8" stroke="#C4A582" strokeWidth="2" strokeLinecap="round" />
        <path className="pao-f pao-f2" d="M24 15c0-2 1.6-2.4 1.6-4S24 8.6 24 7" stroke="#C4A582" strokeWidth="2" strokeLinecap="round" />
        <path className="pao-f pao-f3" d="M31 16c0-2 1.6-2.4 1.6-4S31 9.6 31 8" stroke="#C4A582" strokeWidth="2" strokeLinecap="round" />
        {/* pão */}
        <g className="pao-corpo">
          <ellipse cx="24" cy="31" rx="15" ry="9.5" fill="#D98D5F" />
          <ellipse cx="24" cy="29.4" rx="15" ry="8.6" fill="#E8A878" />
          {/* pestanas do pão */}
          <path d="M15.5 27.5c1.6 1.4 2.8 1.4 4.4 0" stroke="#B06F45" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M21.8 26.6c1.6 1.4 2.8 1.4 4.4 0" stroke="#B06F45" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M28.1 27.5c1.6 1.4 2.8 1.4 4.4 0" stroke="#B06F45" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </svg>
    </span>
  )
}

/** Versão mini para dentro de botões e campos ("salvando…"). */
export function PaozinhoMini({ className = '' }: { className?: string }) {
  return <Paozinho size={16} className={className} />
}

/**
 * Selo flutuante para as telas de loading (canto inferior direito),
 * por cima dos skeletons já existentes.
 */
export function PaozinhoOverlay() {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border border-subtle bg-surface px-4 py-2.5 shadow-lg pointer-events-none">
      <Paozinho size={30} />
      <span className="text-secondary text-xs">assando…</span>
    </div>
  )
}
