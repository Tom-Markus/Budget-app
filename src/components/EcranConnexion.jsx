/**
 * EcranConnexion.jsx
 * ----------------------------------------------------------------------------
 * Premier écran que Tom voit en ouvrant l'app si non connecté.
 * Identité visuelle complète : monomark T orné, wordmark, bouton Google noble,
 * fond vélin granuleux.
 *
 * Props :
 *   onLogin     — async handler() qui déclenche supabase.auth.signInWithOAuth({ provider: 'google' })
 *   loading     — bool, true pendant que la redirection OAuth se met en place
 *   error       — string | null, message d'erreur éventuel
 * ----------------------------------------------------------------------------
 */
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

/**
 * Logo Google officiel (SVG simplifié multicolore).
 * Conservé en couleurs natives Google par convention de marque.
 */
function GoogleLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.5 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.2 5.2C42 35.4 44 30 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

/**
 * Monomark T orné — version statique pour cet écran.
 */
function MonomarkGrand() {
  return (
    <svg width="96" height="96" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M 12 50 Q 22 44, 28 50 Q 22 56, 12 50 Z" fill="var(--or)" opacity="0.85" />
      <path d="M 88 50 Q 78 44, 72 50 Q 78 56, 88 50 Z" fill="var(--or)" opacity="0.85" />
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
  );
}

export default function EcranConnexion({ onLogin, loading = false, error = null }) {
  return (
    <main
      className="
        min-h-[100dvh] flex flex-col items-center justify-center
        px-6 py-12
        relative
      "
      aria-labelledby="connexion-titre"
    >
      {/* ====== Bloc central ====== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
        className="w-full max-w-md flex flex-col items-center gap-8"
      >
        {/* Monomark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1], delay: 0.1 }}
        >
          <MonomarkGrand />
        </motion.div>

        {/* Titre wordmark */}
        <motion.h1
          id="connexion-titre"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay: 0.25 }}
          className="font-serif italic font-medium text-4xl md:text-5xl text-encre text-center"
          style={{ letterSpacing: '-0.015em' }}
        >
          Tom&rsquo;s <span style={{ color: 'var(--or)' }}>Cabinet</span>
        </motion.h1>

        {/* Tagline éditoriale */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="
            font-serif italic text-base md:text-lg
            text-center max-w-sm
          "
          style={{ color: 'var(--encre-secondaire)' }}
        >
          Un cabinet patrimonial pour gérer ton argent avec calme.
        </motion.p>

        {/* Liseré fin signature */}
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: '120px', opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1], delay: 0.5 }}
          className="h-px"
          style={{ background: 'var(--gradient-signature)' }}
          aria-hidden="true"
        />

        {/* Bouton Google */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay: 0.6 }}
          className="w-full flex flex-col items-center gap-3"
        >
          <button
            type="button"
            onClick={onLogin}
            disabled={loading}
            className={`
              w-full max-w-xs h-12 min-h-[48px] px-5 rounded-md
              inline-flex items-center justify-center gap-3
              bg-velin-clair text-encre
              border border-[rgba(31,24,16,0.12)]
              hover:bg-velin-fonce hover:shadow-md
              transition-all duration-300 ease-noble
              font-sans text-base font-medium
              ${loading ? 'opacity-60 cursor-wait' : ''}
              focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2
            `}
            aria-label="Se connecter avec Google"
          >
            {loading ? (
              <motion.span
                className="inline-block w-5 h-5 rounded-full border-2 border-or border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, ease: 'linear', repeat: Infinity }}
                aria-hidden="true"
              />
            ) : (
              <GoogleLogo size={20} />
            )}
            <span>{loading ? 'Connexion...' : 'Se connecter avec Google'}</span>
          </button>

          {/* Erreur éventuelle */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="
                flex items-center gap-2 px-4 py-2 rounded-md
                bg-rouge/10 border border-rouge/30
                text-rouge text-sm
                max-w-xs
              "
              role="alert"
            >
              <AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>{error}</span>
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* ====== Mention discrète en bas ====== */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1 }}
        className="
          absolute bottom-8 left-1/2 -translate-x-1/2
          font-serif italic text-xs
          text-center
        "
        style={{ color: 'var(--encre-tertiaire)' }}
      >
        Tes données restent privées et chiffrées.
      </motion.p>
    </main>
  );
}
