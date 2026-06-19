'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Theme = 'classico' | 'quente'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'classico',
  toggle: () => {},
})

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'classico'
  return localStorage.getItem('fornada-tom') === 'quente' ? 'quente' : 'classico'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  // Aplica classe no <html> sempre que theme mudar
  useEffect(() => {
    document.documentElement.classList.toggle('creme-quente', theme === 'quente')
  }, [theme])

  function toggle() {
    setTheme((t) => {
      const next = t === 'classico' ? 'quente' : 'classico'
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
