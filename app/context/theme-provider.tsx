'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Theme = 'classico' | 'quente'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'classico',
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('classico')

  useEffect(() => {
    const saved = localStorage.getItem('fornada-tom') as Theme | null
    const t = saved === 'quente' ? 'quente' : 'classico'
    setTheme(t)
    document.documentElement.classList.toggle('creme-quente', t === 'quente')
  }, [])

  function toggle() {
    setTheme((t) => {
      const next = t === 'classico' ? 'quente' : 'classico'
      document.documentElement.classList.toggle('creme-quente', next === 'quente')
      localStorage.setItem('fornada-tom', next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
