/**
 * src/contexts/ToastContext.jsx
 * ----------------------------------------------------------------------------
 * Notifications "Toast" globales (bas d'écran).
 *
 * Un seul toast affiché à la fois (cohérent avec l'esprit feutré du design :
 * pas de spam de notifications). Un nouveau toast écrase le précédent.
 *
 * Usage :
 *   const { showToast } = useToast()
 *   showToast({ message: 'Annulé', type: 'info' })
 *   showToast({ message: 'Erreur réseau', type: 'erreur', duration: 3000 })
 * ----------------------------------------------------------------------------
 */
import { createContext, useState, useCallback } from 'react'
import { Toast } from '../components/Toast'

export const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  // current = { message, type, duration, key } | null
  // key = timestamp, sert à forcer un nouveau cycle d'animation à chaque toast.
  const [current, setCurrent] = useState(null)

  const showToast = useCallback(({ message, type = 'info', duration = 2000 }) => {
    setCurrent({ message, type, duration, key: Date.now() })
  }, [])

  const hideToast = useCallback(() => {
    setCurrent(null)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast rendu au sommet de l'arbre → visible peu importe la page. */}
      <Toast
        key={current?.key}
        message={current?.message ?? ''}
        type={current?.type ?? 'info'}
        duration={current?.duration ?? 2000}
        isOpen={current !== null}
        onClose={hideToast}
      />
    </ToastContext.Provider>
  )
}