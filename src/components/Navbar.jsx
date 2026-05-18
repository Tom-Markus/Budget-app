import { motion } from 'framer-motion';
import { Home, PieChart, Settings } from 'lucide-react';
import { useMemo } from 'react';

const PAGES = [
  { id: 'accueil', label: 'Accueil', icon: Home },
  { id: 'graphes', label: 'Graphes & Dettes', icon: PieChart },
  { id: 'reglages', label: 'Réglages', icon: Settings },
];

const GLASS_MAP_B64 =
  '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';

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
      <path d="M 12 50 Q 22 44, 28 50 Q 22 56, 12 50 Z" fill="currentColor" opacity="0.7" />
      <path d="M 88 50 Q 78 44, 72 50 Q 78 56, 88 50 Z" fill="currentColor" opacity="0.7" />
      <text
        x="50" y="74"
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

function Wordmark({ className = '' }) {
  return (
    <span className={`font-serif italic text-[1.375rem] font-medium tracking-tight ${className}`}>
      Tom&rsquo;s <span className="text-or">Cabinet</span>
    </span>
  );
}

function ConnexionDot({ isOnline }) {
  return (
    <span className="inline-flex items-center gap-2" aria-label={isOnline ? 'Connecté' : 'Hors ligne'}>
      <span
        className={`h-2 w-2 rounded-full ${isOnline ? 'bg-vert' : 'bg-encre-tertiaire'}`}
        style={{ boxShadow: isOnline ? '0 0 8px rgba(14,163,113,0.5)' : 'none' }}
      />
    </span>
  );
}

const GLASS_BACKDROP = [
  `url("#liquid-glass-nav")`,
  'blur(0.5px)',
  'brightness(1.5)',
  'saturate(1.1)',
].join(' ');

const GLASS_SHADOW =
  'rgba(0,0,0,0.25) 0px 4px 8px, rgba(0,0,0,0.15) 0px -10px 25px inset, rgba(255,255,255,0.74) 0px -1px 4px 1px inset';

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
      {/* SVG filter — doit être dans le DOM pour que backdrop-filter url() fonctionne */}
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
      >
        <defs>
          <filter
            id="liquid-glass-nav"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
            x="0" y="0" width="425" height="97"
          >
            <feImage result="glass-map" width="425" height="97" href={`data:image/png;base64,${GLASS_MAP_B64}`} />
            <feDisplacementMap
              in="SourceGraphic"
              in2="glass-map"
              xChannelSelector="R"
              yChannelSelector="G"
              scale="114.52670980289733"
            />
          </filter>
        </defs>
      </svg>

      {/* =========================== TOP NAV =========================== */}
      <header
        className="relative w-full z-20"
        style={{
          background: 'rgba(14, 31, 58, 0.82)',
          backdropFilter: 'blur(16px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
          boxShadow: 'rgba(0,0,0,0.2) 0px 1px 6px, rgba(255,255,255,0.04) 0px -1px 1px 1px inset',
        }}
      >
        <span
          className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'var(--gradient-signature)' }}
          aria-hidden="true"
        />

        {/* Desktop (md+) */}
        <div className="hidden md:flex items-center justify-between container-page py-4">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onNavigate?.('accueil'); }}
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
                    transition-colors duration-300 ease-noble
                    ${isActive ? 'text-or' : 'text-velin-clair/70 hover:text-velin-clair'}
                    focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2 rounded-sm
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
            <span className="t-label-noble text-velin-clair/70">{formatDatePC(currentDate)}</span>
            <ConnexionDot isOnline={isOnline} />
          </div>
        </div>

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Monomark size={24} className="text-or" />
            <span className="font-serif italic font-medium text-base text-velin-clair">
              {pageActuelle.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="t-meta text-velin-clair/70 tabular-nums">
              {formatDateMobile(currentDate)}
            </span>
            <ConnexionDot isOnline={isOnline} />
          </div>
        </div>
      </header>

      {/* =========================== BOTTOM NAV — floating glass pill =========================== */}
      <nav
        className="md:hidden fixed z-20 flex items-stretch"
        aria-label="Navigation principale"
        style={{
          bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(425px, calc(100vw - 32px))',
          borderRadius: '9999px',
          overflow: 'hidden',
          backdropFilter: GLASS_BACKDROP,
          WebkitBackdropFilter: 'blur(0.5px) brightness(1.5) saturate(1.1)',
          boxShadow: GLASS_SHADOW,
        }}
      >
        {PAGES.map((page) => {
          const Icon = page.icon;
          const isActive = page.id === currentPage;
          return (
            <button
              key={page.id}
              onClick={() => onNavigate?.(page.id)}
              className={`
                flex-1 flex flex-col items-center justify-center gap-1
                py-3 relative
                transition-colors duration-300 ease-noble
                ${isActive ? 'text-or' : 'text-encre/50 hover:text-encre'}
              `}
              aria-current={isActive ? 'page' : undefined}
              aria-label={page.label}
            >
              <Icon size={22} strokeWidth={isActive ? 2 : 1.5} aria-hidden="true" />
              <span className="text-[10px] uppercase tracking-wider font-medium">
                {page.label.split(' ')[0]}
              </span>
              {isActive && (
                <motion.span
                  layoutId="active-bottom-bar"
                  className="absolute top-1 left-5 right-5 h-px"
                  style={{ background: 'var(--or)' }}
                  transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Spacer — compense la pill flottante + sa marge */}
      <div
        className="md:hidden"
        style={{ height: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}
        aria-hidden="true"
      />
    </>
  );
}
