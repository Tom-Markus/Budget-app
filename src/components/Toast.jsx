/**
 * Toast.jsx + Loader.jsx
 * ----------------------------------------------------------------------------
 * Composants utilitaires :
 *   - Toast : notification bas d'écran (erreur, annulé)
 *   - LoaderNoble : état de chargement initial
 * ----------------------------------------------------------------------------
 */
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

/**
 * Toast d'erreur ou d'information bas d'écran.
 *
 * Props :
 *   message    — string
 *   type       — 'erreur' | 'info' (défaut: 'info')
 *   isOpen     — bool
 *   onClose    — handler (appelé après duration)
 *   duration   — ms (défaut: 2000)
 */
export function Toast({ message, type = 'info', isOpen, onClose, duration = 2000 }) {
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(t);
  }, [isOpen, duration, onClose]);

  const Icon = type === 'erreur' ? AlertCircle : CheckCircle;
  const colorBorder = type === 'erreur' ? 'border-rouge/40' : 'border-or/40';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
          className="fixed bottom-20 md:bottom-8 left-0 right-0 flex justify-center px-4 z-[1000] pointer-events-none"
          role={type === 'erreur' ? 'alert' : 'status'}
          aria-live={type === 'erreur' ? 'assertive' : 'polite'}
        >
          <div
            className={`
              pointer-events-auto
              flex items-center gap-3 px-5 py-3
              bg-velin-clair text-encre
              border ${colorBorder}
              rounded-md shadow-md
              max-w-md
            `}
          >
            <Icon
              size={18}
              strokeWidth={1.75}
              className={type === 'erreur' ? 'text-rouge' : 'text-or'}
              aria-hidden="true"
            />
            <span className="t-body-secondaire text-encre">{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/**
 * Loader noble : utilisé au chargement initial de l'app pendant que
 * Supabase rapatrie les données.
 *
 * Visuel : T orné avec pulse-or microscopique.
 */
export function LoaderNoble({ message = 'Chargement...' }) {
  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 px-6"
      role="status"
      aria-live="polite"
    >
      <motion.div
        animate={{
          opacity: [0.4, 1, 0.4],
        }}
        transition={{
          duration: 1.4,
          ease: 'easeInOut',
          repeat: Infinity,
        }}
      >
        <svg viewBox="0 0 100 100" width="80" height="80" xmlns="http://www.w3.org/2000/svg">
          <path d="M 12 50 Q 22 44, 28 50 Q 22 56, 12 50 Z" fill="var(--or)" opacity="0.7" />
          <path d="M 88 50 Q 78 44, 72 50 Q 78 56, 88 50 Z" fill="var(--or)" opacity="0.7" />
          <text
            x="50"
            y="74"
            textAnchor="middle"
            fontFamily="EB Garamond, Cormorant Garamond, Georgia, serif"
            fontStyle="italic"
            fontWeight="500"
            fontSize="68"
            fill="var(--nuit)"
          >
            T
          </text>
        </svg>
      </motion.div>

      <p className="t-label-noble">{message}</p>
    </div>
  );
}

/**
 * Indicateur de syncing : très subtil, pulse-or microscopique
 * sur un élément en cours de synchronisation avec Supabase.
 *
 * Usage : wrapper autour d'un élément, lui appliquer cette indication.
 * Variation : <span className="animate-pulse-or" />
 */
export function SyncingDot({ active }) {
  if (!active) return null;
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-or animate-pulse-or"
      aria-label="Synchronisation en cours"
      role="status"
    />
  );
}
