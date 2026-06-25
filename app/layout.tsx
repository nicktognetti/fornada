import type { Metadata } from 'next'
import { Outfit, Playfair_Display, Sacramento } from 'next/font/google'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const sacramento = Sacramento({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-sacramento',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Fornada — Flor do Trigo',
  description: 'Sistema de custos e precificação da Padaria Flor do Trigo',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${outfit.variable} ${playfair.variable} ${sacramento.variable} h-full`}
    >
      <body className="min-h-full font-outfit antialiased">
        {children}
      </body>
    </html>
  )
}
