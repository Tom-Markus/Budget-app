/**
 * src/hooks/useAuth.js
 * ----------------------------------------------------------------------------
 * Contexte d'authentification + hook pour le consommer.
 * Le createContext vit ici (fichier non-composant) pour que le fichier du
 * provider n'exporte qu'un composant → Fast Refresh fiable.
 *
 * Usage :
 *   const { user, login, logout, loading, loginLoading, loginError } = useAuth()
 * ----------------------------------------------------------------------------
 */
import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un <AuthProvider>")
  }
  return ctx
}
