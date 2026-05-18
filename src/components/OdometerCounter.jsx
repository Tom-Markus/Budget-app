/**
 * OdometerCounter.jsx
 * ----------------------------------------------------------------------------
 * Compteur façon "odomètre" : chaque chiffre défile verticalement quand
 * la valeur change. Inspiré de Terminal Industries.
 *
 * Props :
 *   value        — number, montant à afficher (peut être négatif)
 *   showSign     — bool, affiche un + explicite si positif (défaut: false)
 *   decimals     — nombre de décimales (défaut: 2)
 *   color        — 'positif' | 'zero' | 'negatif' | 'neutre' (défaut: auto)
 *   size         — 'xl' | 'lg' | 'md' | 'sm' (défaut: 'lg')
 *   currency     — bool, affiche le sigle € à droite (défaut: true)
 *
 * Format européen strict : séparateur de milliers = point, décimal = virgule,
 * sigle € à droite avec espace fine (U+202F).
 *
 * Respecte prefers-reduced-motion : pas d'animation, valeur change directement.
 * ----------------------------------------------------------------------------
 */
import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';

const SIZE_CLASSES = {
  xl: 't-chiffre-xl',
  lg: 't-chiffre-lg',
  md: 't-chiffre-md',
  sm: 't-chiffre-sm',
};

const DIGIT_HEIGHT_EM = 1;

function formatNumber(value, decimals) {
  const abs = Math.abs(value);
  return abs.toLocaleString('fr-BE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const Character = memo(function Character({ char, sizeClass, reducedMotion }) {
  const isDigit = /[0-9]/.test(char);

  if (!isDigit) {
    return (
      <span className={sizeClass} style={{ display: 'inline-block' }}>
        {char}
      </span>
    );
  }

  const digit = parseInt(char, 10);

  return (
    <span
      className={sizeClass}
      style={{
        display: 'inline-block',
        overflow: 'hidden',
        height: `${DIGIT_HEIGHT_EM}em`,
        verticalAlign: 'top',
        position: 'relative',
      }}
      aria-hidden="true"
    >
      <motion.span
        style={{ display: 'flex', flexDirection: 'column' }}
        initial={false}
        animate={{ y: `-${digit * DIGIT_HEIGHT_EM}em` }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }
        }
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n} style={{ height: `${DIGIT_HEIGHT_EM}em`, lineHeight: 1 }}>
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
})

export default memo(function OdometerCounter({
  value,
  showSign = false,
  decimals = 2,
  color,
  size = 'lg',
  currency = true,
  className = '',
}) {
  const reducedMotion = useReducedMotion();

  const resolvedColor = useMemo(() => {
    if (color) return color;
    if (value > 0) return 'positif';
    if (value === 0) return 'zero';
    return 'negatif';
  }, [value, color]);

  const colorClass = {
    positif: 'signal-positif',
    zero: 'signal-zero',
    negatif: 'signal-negatif',
    neutre: 'signal-neutre',
  }[resolvedColor];

  const sizeClass = SIZE_CLASSES[size];

  const numberStr = formatNumber(value, decimals);
  const signPrefix = value < 0 ? '-' : showSign && value > 0 ? '+' : '';
  const fullStr = signPrefix + numberStr;

  const ariaLabel = `${value.toLocaleString('fr-BE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${currency ? ' euros' : ''}`;

  return (
    <span
      className={`${colorClass} ${className}`}
      style={{ display: 'inline-flex', alignItems: 'baseline', whiteSpace: 'nowrap', fontStyle: 'normal' }}
      role="img"
      aria-label={ariaLabel}
    >
      <span style={{ display: 'inline-flex' }} aria-hidden="true">
        {fullStr.split('').map((char, i) => (
          <Character
            key={/[0-9]/.test(char) ? i : `${i}-${char}`}
            char={char}
            sizeClass={sizeClass}
            reducedMotion={reducedMotion}
          />
        ))}
      </span>
      {currency && (
        <span
          className={sizeClass}
          style={{ marginLeft: '0.25em' }}
          aria-hidden="true"
        >
          €
        </span>
      )}
    </span>
  );
})
