/**
 * src/hooks/useApp.js
 * ----------------------------------------------------------------------------
 * Contexte global (envelopes, mouvements, soldes, à répartir...) + hook.
 * Le createContext vit ici (fichier non-composant) pour que le fichier du
 * provider n'exporte qu'un composant → Fast Refresh fiable.
 *
 * Usage :
 *   const { patrimoine, soldeDe, aRepartir, loading } = useApp()
 * ----------------------------------------------------------------------------
 */
import { createContext, useContext } from 'react'

export const AppContext = createContext(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error("useApp doit être utilisé à l'intérieur d'un <AppProvider>")
  }
  return ctx
}
