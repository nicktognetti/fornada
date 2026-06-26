import Image from 'next/image'

export default function DashboardHome() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] select-none">
      <div className="flex flex-col items-center gap-6 opacity-90">
        <Image
          src="/images/LOGO2claro.png"
          alt="Flor do Trigo"
          width={560}
          height={280}
          className="w-[200px] sm:w-[260px] h-auto"
          priority
          unoptimized
        />
        <div className="flex flex-col items-center gap-1">
          <p
            className="font-playfair font-bold italic leading-none"
            style={{ fontSize: '2.8rem', color: '#ede9e1', textShadow: '0 2px 24px rgba(237,233,225,0.1)' }}
          >
            Fornada
          </p>
          <p
            className="font-outfit text-center"
            style={{ fontSize: '9px', letterSpacing: '0.35em', color: 'rgba(156,163,175,0.45)', textTransform: 'uppercase' }}
          >
            Sistema de Gestão&nbsp;&nbsp;·&nbsp;&nbsp;Custos &amp; Preços
          </p>
        </div>
      </div>
      <p className="mt-10 text-sm text-secondary">
        Selecione uma opção no menu lateral para começar.
      </p>
    </div>
  )
}
