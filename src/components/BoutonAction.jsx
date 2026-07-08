/**
 * BoutonAction.jsx
 * ----------------------------------------------------------------------------
 * Bouton d'action central de l'app (+, -, ↩, ⤴).
 *
 * Comportement :
 *   - Au repos : icône claire et noble
 *   - Hover (PC) : légère élévation, fond crème plus chaud
 *   - Press : scale(0.97) instantané
 *   - Disabled : opacité 40%, curseur not-allowed
 *   - Loading : pulse-or microscopique
 *   - Success : check vert fugace 500ms
 *   - Error : shake horizontal + toast en bas d'écran
 *
 * Quand variant === 'input', le bouton se transforme en champ de saisie
 * qui prend la largeur disponible (animation côté parent via AnimatePresence).
 *
 * Props :
 *   icon         — composant Lucide (Plus, Minus, Undo2, CornerUpLeft, etc.)
 *   onClick      — handler
 *   ariaLabel    — texte pour lecteurs d'écran (obligatoire)
 *   state        — 'normal' | 'loading' | 'success' | 'error' (défaut: 'normal')
 *   disabled     — bool
 *   variant      — 'icon' (carré) | 'pill' (allongé)
 *   tone         — 'noble' (par défaut, encre sur crème) | 'bordeaux' | 'or'
 *
 * Stack : Tailwind + tokens CSS + Framer Motion + Lucide
 * ----------------------------------------------------------------------------
 */
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const TONE_STYLES = {
  noble: {
    bg: 'bg-velin-clair',
    bgHover: 'hover:bg-velin-fonce',
    text: 'text-encre',
    border: 'border border-encre/[0.08]',
  },
  bordeaux: {
    bg: 'bg-bordeaux',
    bgHover: 'hover:bg-bordeaux-clair',
    text: 'text-velin-clair',
    border: '',
  },
  or: {
    bg: 'bg-or',
    bgHover: 'hover:bg-or-clair',
    text: 'text-encre',
    border: '',
  },
};

export default function BoutonAction({
  icon: Icon,
  onClick,
  ariaLabel,
  state = 'normal',
  disabled = false,
  variant = 'icon',
  tone = 'noble',
  className = '',
}) {
  const tones = TONE_STYLES[tone];
  const isDisabled = disabled || state === 'loading';

  // Dimensions : minimum 44x44 pour respecter accessibilité tactile
  const sizeClasses =
    variant === 'icon'
      ? 'h-11 w-11 min-h-[44px] min-w-[44px]'
      : 'h-11 min-h-[44px] px-5';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={state === 'loading'}
      whileHover={isDisabled ? {} : { y: -2, transition: { type: 'spring', stiffness: 380, damping: 22 } }}
      whileTap={isDisabled ? {} : { scale: 0.96, y: 0 }}
      animate={
        state === 'error'
          ? { x: [-4, 4, -3, 3, 0] }
          : state === 'success'
          ? { boxShadow: ['0 0 0 rgba(184,149,74,0)', '0 0 24px rgba(184,149,74,0.4)', '0 0 0 rgba(184,149,74,0)'] }
          : {}
      }
      transition={{
        duration: state === 'error' ? 0.22 : 0.5,
        ease: state === 'error' ? [0, 0, 0.2, 1] : [0.34, 1.56, 0.64, 1],
      }}
      className={`
        ${sizeClasses}
        ${tones.bg} ${tones.text} ${tones.border}
        ${!isDisabled ? tones.bgHover : ''}
        rounded-md
        flex items-center justify-center
        transition-all duration-200 ease-noble
        ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}
        ${state === 'loading' ? 'animate-pulse-or' : ''}
        focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2
        ${className}
      `}
    >
      {state === 'success' ? (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <Check size={20} strokeWidth={2.5} className="text-vert" />
        </motion.span>
      ) : (
        Icon && <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      )}
    </motion.button>
  );
}
