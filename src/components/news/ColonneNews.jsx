import { motion } from 'framer-motion'

function tempsRelatif(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h >= 48) return `${Math.floor(h / 24)}j`
  if (h >= 1)  return `${h}h`
  if (m >= 1)  return `${m}min`
  return "À l'instant"
}

function SqueletteArticle() {
  return (
    <div className="py-4 border-b border-encre/6 last:border-b-0 animate-pulse flex gap-3">
      <div className="h-3 w-4 bg-encre/6 rounded mt-0.5 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-encre/8 rounded w-full" />
        <div className="h-3.5 bg-encre/8 rounded w-4/5" />
        <div className="h-2.5 bg-encre/5 rounded w-2/5 mt-3" />
      </div>
    </div>
  )
}

function EtatErreur() {
  return (
    <div className="py-8 flex flex-col items-center gap-2 text-center">
      <span className="text-[25px] leading-none opacity-40" aria-hidden="true">⚠</span>
      <p className="font-sans text-[13px] text-encre-tertiaire">
        Impossible de charger les articles
      </p>
      <p className="font-sans text-[12px] text-encre-tertiaire/45">
        Vérifiez la connexion ou actualisez
      </p>
    </div>
  )
}

function CarteArticle({ article, index }) {
  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex gap-3.5 py-3.5 border-b border-encre/6 last:border-b-0
        pl-3 -ml-3 pr-1 rounded-sm transition-colors duration-200 hover:bg-velin-fonce/30"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: [0.32, 0.72, 0, 1] }}
    >
      <span
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-full
          h-0 group-hover:h-8 transition-all duration-300 ease-out"
        style={{ background: 'var(--or)' }}
        aria-hidden="true"
      />

      <span className="text-[11px] font-sans font-medium tabular-nums text-encre-tertiaire/40
        group-hover:text-or/70 transition-colors duration-200 mt-0.5 w-4 shrink-0 leading-snug">
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="flex-1 min-w-0">
        <h3 className="font-serif font-medium text-[20px] leading-[1.35] text-encre
          group-hover:text-or-fonce transition-colors duration-200 line-clamp-3 mb-2">
          {article.title}
        </h3>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[12px] text-encre-tertiaire font-sans font-medium truncate">
              {article.source}
            </span>
            <span className="text-encre-tertiaire/30 text-[11px]">·</span>
            <span className="text-[12px] text-encre-tertiaire/60 font-sans shrink-0">
              {tempsRelatif(article.publishedAt)}
            </span>
          </div>
          <span
            className="shrink-0 text-[12px] font-sans font-medium opacity-0
              group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap"
            style={{ color: 'var(--bordeaux)' }}
          >
            Lire →
          </span>
        </div>
      </div>
    </motion.a>
  )
}

export function ColonneNews({ category, articles, loading, error }) {
  const { Icon } = category

  return (
    <div className="surface-velin liserer-signature p-5 flex flex-col relative">
      <span
        className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none rounded-t-xl"
        style={{ background: 'linear-gradient(90deg, transparent 0%, var(--bordeaux-clair) 50%, transparent 100%)' }}
        aria-hidden="true"
      />
      <div className="flex items-center mb-4 pb-3 border-b border-or/15">
        <Icon size={15} strokeWidth={1.75} className="text-or/70 shrink-0 mr-2.5" aria-hidden="true" />
        <h2 className="font-serif font-semibold text-[19px] text-encre leading-none">
          {category.label}
        </h2>
      </div>

      {loading ? (
        Array.from({ length: 5 }).map((_, i) => <SqueletteArticle key={i} />)
      ) : error ? (
        <EtatErreur />
      ) : articles.length === 0 ? (
        <p className="text-[15px] font-serif italic text-encre-tertiaire py-5">Aucun article disponible.</p>
      ) : (
        articles.map((a, i) => <CarteArticle key={a.url} article={a} index={i} />)
      )}
    </div>
  )
}
