/**
 * src/hooks/useAuth.js
 * ----------------------------------------------------------------------------
 * Hook pour consommer le contexte d'authentification.
 *
 * Usage :
 *   const { user, login, logout, loading, loginLoading, loginError } = useAuth()
 * ----------------------------------------------------------------------------
 */
import { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un <AuthProvider>")
  }
  return ctx
}