/**
 * PopupConfirmation.jsx
 * ----------------------------------------------------------------------------
 * Modal de confirmation noble, réutilisable pour toutes les actions
 * destructrices. Couvre les 4 scénarios de suppression du brief :
 *
 *   1. Enveloppe sans enfants, sans solde
 *   2. Enveloppe sans enfants, avec solde (libère vers "à répartir")
 *   3. Enveloppe avec enfants : DEUX choix (cascade OU remonter)
 *   4. Créance avec solde (crée 'creance_repaid' auto)
 *
 * Props :
 *   isOpen        — bool
 *   onClose       — handler() pour fermer sans action
 *   title         — string (titre du modal, serif italique)
 *   message       — string ou ReactNode (corps du message)
 *   actions       — array of { label: string, variant: 'primary' | 'destructive' | 'ghost', onClick: handler }
 *                   Au moins 1 action, 3 max pour les cas avec choix multiples.
 *   tone          — 'noble' (défaut) | 'destructive' (liseré bordeaux/rouge)
 *
 * Exemple usage cas 3 :
 *   <PopupConfirmation
 *     isOpen={true}
 *     onClose={fermer}
 *     title="Supprimer Épargne ?"
 *     message="Cette enveloppe contient 3 sous-catégories. Choisis."
 *     tone="destructive"
 *     actions={[
 *       { label: 'Annuler', variant: 'ghost', onClick: fermer },
 *       { label: 'Remonter les enfants', variant: 'primary', onClick: remonter },
 *       { label: 'Supprimer en cascade', variant: 'destructive', onClick: cascade },
 *     ]}
 *   />
 * ----------------------------------------------------------------------------
 */
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { X } from 'lucide-react';

const VARIANT_STYLES = {
  primary: 'bg-bordeaux text-velin-clair hover:bg-bordeaux-clair',
  destructive: 'bg-rouge text-velin-clair hover:bg-rouge-clair',
  ghost: 'bg-transparent text-encre-secondaire hover:text-encre hover:bg-velin-fonce',
};

export default function PopupConfirmation({
  isOpen,
  onClose,
  title,
  message,
  actions = [],
  tone = 'noble',
}) {
  // Échap pour fermer
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-titre"
          aria-describedby="confirm-message"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{
              background: 'var(--overlay-bg)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="
              relative w-full max-w-md
              surface-velin rounded-xl
              p-6 md:p-7
              flex flex-col gap-4
            "
            style={{
              // Liseré bordeaux si tone destructive
              boxShadow:
                tone === 'destructive'
                  ? '0 0 0 1px rgba(229, 57, 53, 0.3), 0 12px 32px color-mix(in srgb, var(--encre) 18%, transparent)'
                  : 'var(--shadow-lg)',
            }}
          >
            {/* Bouton fermer */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="
                absolute top-3 right-3
                p-2 rounded-md
                text-encre-tertiaire hover:text-encre hover:bg-velin-fonce
                transition-colors duration-200
              "
            >
              <X size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>

            {/* Titre */}
            <h2
              id="confirm-titre"
              className="font-serif italic font-medium text-2xl text-encre pr-8"
            >
              {title}
            </h2>

            {/* Message */}
            <div
              id="confirm-message"
              className="t-body-secondaire"
              style={{ color: 'var(--encre-secondaire)' }}
            >
              {message}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 mt-2 flex-wrap">
              {actions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={action.onClick}
                  className={`
                    h-10 min-h-[40px] px-4 rounded-md
                    transition-colors duration-200
                    text-sm font-medium
                    ${VARIANT_STYLES[action.variant || 'primary']}
                    focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2
                  `}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
