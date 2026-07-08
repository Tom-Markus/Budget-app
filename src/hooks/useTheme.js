/**
 * src/hooks/useTheme.js
 * ----------------------------------------------------------------------------
 * Contexte du thème clair/sombre + hook pour le consommer.
 * Le createContext vit ici (fichier non-composant) pour que le fichier du
 * provider n'exporte qu'un composant → Fast Refresh fiable.
 * ----------------------------------------------------------------------------
 */
import { createContext, useContext } from 'react'

export const ThemeContext = createContext(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
