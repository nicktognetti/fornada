// Placeholder de imagem com a marca Flor do Trigo, para produtos/receitas sem foto.
// Usa o logo claro (LOGO2claro) sobre o fundo escuro `bg-input`, esmaecido para
// ler como "sem foto ainda" — não como se o logo fosse a foto do item.
export function LogoPlaceholder({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${className}`}
      style={{ backgroundColor: 'var(--color-input)' }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/LOGO2claro.png"
        alt=""
        className="w-[62%] h-auto max-h-[70%] object-contain opacity-35 select-none pointer-events-none"
      />
    </div>
  )
}
