/**
 * src/hooks/useApp.js
 * ----------------------------------------------------------------------------
 * Hook pour consommer l'état global (envelopes, mouvements, soldes, à répartir...).
 *
 * Usage :
 *   const { patrimoine, soldeDe, aRepartir, loading } = useApp()
 * ----------------------------------------------------------------------------
 */
import { useContext } from 'react'
import { AppContext } from '../contexts/AppContext'

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error("useApp doit être utilisé à l'intérieur d'un <AppProvider>")
  }
  return ctx
}