/**
 * Navbar.jsx
 * ----------------------------------------------------------------------------
 * Navigation principale de l'app.
 *
 *   PC (md+)    : barre en haut, contrastée bleu nuit + dégradé signature,
 *                 logo "Tom's Cabinet" wordmark, 3 liens, date du jour, indicateur connexion
 *   Mobile (<md): top minimaliste (monomark T + titre page + indicateur)
 *                 + bottom nav fixe avec 3 icônes pour Accueil / Graphes & Dettes / Réglages
 *
 * Props :
 *   currentPage    — 'accueil' | 'graphes' | 'reglages'
 *   onNavigate     — (page) => void
 *   isOnline       — bool (défaut: true)
 *   currentDate    — Date (défaut: now)
 *
 * Stack : Tailwind + Framer Motion + Lucide
 * ----------------------------------------------------------------------------
 */
import { motion } from 'framer-motion';
import { Dumbbell, Home, Newspaper, PieChart, Settings, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';

const PAGES = [
  { id: 'accueil', label: 'Accueil', icon: Home },
  { id: 'graphes', label: 'Graphes & Dettes', icon: PieChart },
  { id: 'news', label: 'News & Markets', icon: Newspaper },
  { id: 'investments', label: 'Investments', icon: TrendingUp },
  { id: 'sport', label: 'Sport', icon: Dumbbell },
  { id: 'reglages', label: 'Réglages', icon: Settings },
];

function formatDatePC(date) {
  return new Intl.DateTimeFormat('fr-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(date)
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatDateMobile(date) {
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

/**
 * Monomark : T orné, version compacte du logo.
 * Style : ornement de page de garde de livre ancien — T capital serif avec
 * deux fioritures latérales fines en or.
 */
function Monomark({ size = 28, className = '' }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Fioriture gauche */}
      <path
        d="M 12 50 Q 22 44, 28 50 Q 22 56, 12 50 Z"
        fill="currentColor"
        opacity="0.7"
      />
      {/* Fioriture droite */}
      <path
        d="M 88 50 Q 78 44, 72 50 Q 78 56, 88 50 Z"
        fill="currentColor"
        opacity="0.7"
      />
      {/* T capital serif */}
      <text
        x="50"
        y="74"
        textAnchor="middle"
        fontFamily="EB Garamond, Cormorant Garamond, Georgia, serif"
        fontStyle="italic"
        fontWeight="500"
        fontSize="68"
        fill="currentColor"
      >
        T
      </text>
    </svg>
  );
}

/**
 * Logo wordmark "Tom's Cabinet" — utilisé sur PC.
 */
function Wordmark({ className = '' }) {
  return (
    <span
      className={`font-serif italic text-[1.375rem] font-medium tracking-tight ${className}`}
    >
      Tom&rsquo;s <span className="text-or">Cabinet</span>
    </span>
  );
}

/**
 * Indicateur connexion : point coloré discret.
 */
function ConnexionDot({ isOnline }) {
  return (
    <span
      className="inline-flex items-center gap-2"
      aria-label={isOnline ? 'Connecté' : 'Hors ligne'}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isOnline ? 'bg-vert' : 'bg-encre-tertiaire'
        }`}
        style={{
          boxShadow: isOnline ? '0 0 8px rgba(14,163,113,0.5)' : 'none',
        }}
      />
    </span>
  );
}

export default function Navbar({
  currentPage = 'accueil',
  onNavigate,
  isOnline = true,
  currentDate = new Date(),
}) {
  const pageActuelle = useMemo(
    () => PAGES.find((p) => p.id === currentPage) || PAGES[0],
    [currentPage]
  );

  return (
    <>
      {/* =========================== TOP NAV =========================== */}
      <header
        className="
          relative w-full
          bg-nuit text-velin-clair
          z-20 shadow-md
        "
      >
        {/* Dégradé signature : fin liseré sous la barre */}
        <span
          className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'var(--gradient-signature)' }}
          aria-hidden="true"
        />

        {/* ========== Version desktop (md+) ========== */}
        <div className="hidden md:flex items-center justify-between container-page py-4">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.('accueil');
            }}
            className="flex items-center gap-3 group"
            aria-label="Tom's Cabinet — accueil"
          >
            <Monomark size={28} className="text-or" />
            <Wordmark className="text-velin-clair group-hover:text-or transition-colors duration-300 ease-noble" />
          </a>

          <nav className="flex items-center gap-1" aria-label="Navigation principale">
            {PAGES.map((page) => {
              const isActive = page.id === currentPage;
              return (
                <button
                  key={page.id}
                  onClick={() => onNavigate?.(page.id)}
                  className={`
                    relative px-4 py-2 t-label-noble text-[1rem]
                    transition-[color,opacity] duration-300 ease-noble
                    ${
                      isActive
                        ? 'text-or opacity-100'
                        : 'text-velin-clair opacity-75 hover:opacity-100'
                    }
                    focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2 rounded-md
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {page.label}
                  {isActive && (
                    <motion.span
                      layoutId="active-page-underline"
                      className="absolute left-4 right-4 bottom-1 h-px"
                      style={{ background: 'var(--or)' }}
                      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <span className="h-2.5 w-2.5 rounded-full bg-rouge" aria-hidden="true" />
            <span className="t-label-noble text-velin-clair opacity-70">
              {formatDatePC(currentDate)}
            </span>
            <ConnexionDot isOnline={isOnline} />
          </div>
        </div>

        {/* ========== Version mobile (<md) ========== */}
        <div className="md:hidden flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Monomark size={24} className="text-or" />
            <span className="font-serif italic font-medium text-base text-velin-clair">
              {pageActuelle.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="t-meta text-velin-clair opacity-70 tabular-nums">
              {formatDateMobile(currentDate)}
            </span>
            <ConnexionDot isOnline={isOnline} />
          </div>
        </div>
      </header>

      {/* =========================== BOTTOM NAV (mobile only) =========================== */}
      <nav
        className="
          md:hidden fixed bottom-0 left-0 right-0
          bg-nuit text-velin-clair
          border-t border-or/30
          flex items-stretch
          z-20
        "
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        aria-label="Navigation principale"
      >
        {/* Dégradé signature en haut de la bottom nav */}
        <span
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'var(--gradient-signature)' }}
          aria-hidden="true"
        />

        {PAGES.map((page) => {
          const Icon = page.icon;
          const isActive = page.id === currentPage;
          return (
            <button
              key={page.id}
              onClick={() => onNavigate?.(page.id)}
              className={`
                flex-1 flex flex-col items-center justify-center gap-1
                min-h-[60px] py-2
                transition-[color,opacity] duration-300 ease-noble
                relative
                ${isActive ? 'text-or opacity-100' : 'text-velin-clair opacity-70 hover:opacity-100'}
              `}
              aria-current={isActive ? 'page' : undefined}
              aria-label={page.label}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2 : 1.5}
                aria-hidden="true"
              />
              <span className="text-[10px] uppercase tracking-wider font-medium">
                {page.label.split(' ')[0]}
              </span>
              {isActive && (
                <motion.span
                  layoutId="active-bottom-bar"
                  className="absolute top-0 left-3 right-3 h-px"
                  style={{ background: 'var(--or)' }}
                  transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Spacer pour ne pas masquer le contenu derrière la bottom nav mobile */}
      <div className="md:hidden h-[60px]" aria-hidden="true" />
    </>
  );
}
