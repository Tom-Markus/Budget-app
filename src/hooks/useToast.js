/**
 * src/hooks/useToast.js
 * ----------------------------------------------------------------------------
 * Contexte des toasts + hook pour déclencher un toast depuis n'importe où.
 * Le createContext vit ici (fichier non-composant) pour que le fichier du
 * provider n'exporte qu'un composant → Fast Refresh fiable.
 *
 * Usage :
 *   const { showToast } = useToast()
 *   showToast({ message: 'Annulé', type: 'info' })
 * ----------------------------------------------------------------------------
 */
import { createContext, useContext } from 'react'

export const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast doit être utilisé à l'intérieur d'un <ToastProvider>")
  }
  return ctx
}
