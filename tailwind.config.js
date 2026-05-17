/** @type {import('tailwindcss').Config} */

// Permet d'utiliser l'opacité Tailwind (bg-or/60, ring-or/60…) avec des
// couleurs définies en variables CSS. Sans ça, "ring-or/60" produit du CSS
// invalide et le ring retombe sur le bleu par défaut de Tailwind.
function withOpacity(varName) {
  return ({ opacityValue }) => {
    if (opacityValue === undefined || opacityValue === null) {
      return `var(${varName})`
    }
    return `color-mix(in srgb, var(${varName}) calc(${opacityValue} * 100%), transparent)`
  }
}

export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        velin: withOpacity('--velin'),
        'velin-clair': withOpacity('--velin-clair'),
        'velin-fonce': withOpacity('--velin-fonce'),
        encre: withOpacity('--encre'),
        'encre-secondaire': withOpacity('--encre-secondaire'),
        'encre-tertiaire': withOpacity('--encre-tertiaire'),
        nuit: withOpacity('--nuit'),
        'nuit-clair': withOpacity('--nuit-clair'),
        'nuit-tres-fonce': withOpacity('--nuit-tres-fonce'),
        bordeaux: withOpacity('--bordeaux'),
        'bordeaux-clair': withOpacity('--bordeaux-clair'),
        or: withOpacity('--or'),
        'or-clair': withOpacity('--or-clair'),
        'or-fonce': withOpacity('--or-fonce'),
        vert: withOpacity('--vert'),
        'vert-clair': withOpacity('--vert-clair'),
        rouge: withOpacity('--rouge'),
        'rouge-clair': withOpacity('--rouge-clair'),
        graphite: withOpacity('--graphite'),
      },
      fontFamily: {
        serif: ['EB Garamond', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Outfit', 'Manrope', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        or: 'var(--shadow-or)',
        'or-fort': 'var(--shadow-or-fort)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      transitionTimingFunction: {
        noble: 'cubic-bezier(0.32, 0.72, 0, 1)',
        liquide: 'cubic-bezier(0.65, 0, 0.35, 1)',
        'bounce-doux': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        300: '300ms',
        500: '500ms',
        700: '700ms',
        1400: '1400ms',
      },
      backgroundImage: {
        'gradient-signature': 'var(--gradient-signature)',
      },
    },
  },
  plugins: [],
}