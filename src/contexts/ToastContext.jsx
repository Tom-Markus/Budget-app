/**
 * src/contexts/ToastContext.jsx
 * ----------------------------------------------------------------------------
 * Notifications "Toast" globales (bas d'écran).
 *
 * File de 3 toasts maximum, empilés discrètement (esprit feutré du design :
 * pas de spam). Au-delà de 3, le plus ancien est évincé. Chaque toast se
 * ferme seul après sa durée, ou d'un clic.
 *
 * Usage :
 *   const { showToast } = useToast()
 *   showToast({ message: 'Annulé', type: 'info' })
 *   showToast({ message: 'Erreur réseau', type: 'erreur', duration: 3000 })
 * ----------------------------------------------------------------------------
 */
import { useState, useCallback, useRef } from 'react'
import { ToastStack } from '../components/Toast'
import { ToastContext } from '../hooks/useToast'

const MAX_TOASTS = 3

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const hideToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback(({ message, type = 'info', duration = 2000 }) => {
    setToasts(prev => {
      // Déduplication : un toast identique déjà affiché n'est pas doublé
      if (prev.some(t => t.message === message && t.type === type)) return prev
      const next = [...prev, { id: ++idRef.current, message, type, duration }]
      return next.slice(-MAX_TOASTS)
    })
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Pile de toasts rendue au sommet de l'arbre → visible peu importe la page. */}
      <ToastStack toasts={toasts} onClose={hideToast} />
    </ToastContext.Provider>
  )
}
