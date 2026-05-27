/**
 * src/contexts/ThemeContext.jsx
 * ----------------------------------------------------------------------------
 * Gestion du thème clair / sombre.
 * Applique data-theme="light"|"dark" sur <html> et persiste en localStorage.
 * ----------------------------------------------------------------------------
 */
import { createContext, useState, useEffect } from 'react'

export const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') ?? 'light' } catch { return 'light' }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('theme', theme) } catch {}
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
