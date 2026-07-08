/**
 * Toast.jsx + Loader.jsx
 * ----------------------------------------------------------------------------
 * Composants utilitaires :
 *   - ToastStack : pile de notifications bas d'écran (succès, info, erreur)
 *   - LoaderNoble : état de chargement initial
 * ----------------------------------------------------------------------------
 */
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

/** Un toast de la pile — se ferme seul après `duration`, ou au clic. */
function ToastItem({ toast, onClose }) {
  const { id, message, type, duration } = toast;

  useEffect(() => {
    const t = setTimeout(() => onClose(id), duration ?? 2000);
    return () => clearTimeout(t);
  }, [id, duration, onClose]);

  const isErreur = type === 'erreur';
  const isSucces = type === 'succes';
  const Icon = isErreur ? AlertCircle : CheckCircle;
  const colorBorder = isErreur ? 'border-rouge/40' : isSucces ? 'border-vert/40' : 'border-or/40';
  const colorIcon = isErreur ? 'text-rouge' : isSucces ? 'text-vert' : 'text-or';

  return (
    <motion.button
      type="button"
      layout
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      onClick={() => onClose(id)}
      className={`
        pointer-events-auto text-left cursor-pointer
        flex items-center gap-3 px-5 py-3
        bg-velin-clair text-encre
        border ${colorBorder}
        rounded-lg shadow-md
        max-w-md
      `}
      role={isErreur ? 'alert' : 'status'}
      aria-live={isErreur ? 'assertive' : 'polite'}
    >
      <Icon size={18} strokeWidth={1.75} className={colorIcon} aria-hidden="true" />
      <span className="t-body-secondaire text-encre">{message}</span>
    </motion.button>
  );
}

/**
 * Pile de toasts (3 max, gérée par ToastProvider).
 *
 * Props :
 *   toasts   — Array<{ id, message, type: 'info'|'succes'|'erreur', duration }>
 *   onClose  — handler(id)
 */
export function ToastStack({ toasts, onClose }) {
  return createPortal(
    <div
      className="fixed bottom-20 md:bottom-8 left-0 right-0 flex flex-col items-center gap-2 px-4 z-[1000] pointer-events-none"
      aria-label="Notifications"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={onClose} />
        ))}
      </AnimatePresence>
    </div>,
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
