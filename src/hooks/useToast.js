/**
 * src/hooks/useToast.js
 * ----------------------------------------------------------------------------
 * Hook pour déclencher un toast depuis n'importe où dans l'app.
 *
 * Usage :
 *   const { showToast } = useToast()
 *   showToast({ message: 'Annulé', type: 'info' })
 * ----------------------------------------------------------------------------
 */
import { useContext } from 'react'
import { ToastContext } from '../contexts/ToastContext'

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast doit être utilisé à l'intérieur d'un <ToastProvider>")
  }
  return ctx
}