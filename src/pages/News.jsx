/**
 * src/pages/News.jsx — Briefing du matin
 * ----------------------------------------------------------------------------
 * Terminal de veille : marchés en temps réel + actualités par catégorie.
 * Desktop : 4 colonnes. Mobile : tabs + colonne unique.
 * Cache sessionStorage 15 min pour préserver les quotas API.
 * ----------------------------------------------------------------------------
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, ExternalLink, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'
import { fetchNewsCategory, fetchMarkets, clearNewsCache } from '../lib/newsApi'

// ── Catégories ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'business',   label: 'Finance',   labelCourt: 'Finance' },
  { id: 'technology', label: 'Tech & IA', labelCourt: 'Tech' },
  { id: 'science',    label: 'Sciences',  labelCourt: 'Sciences' },
  { id: 'world',      label: 'Monde',     labelCourt: 'Monde' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function tempsRelatif(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h >= 48) return `${Math.floor(h / 24)}j`
  if (h >= 1) return `${h}h`
  if (m >= 1) return `${m}min`
  return 'À l\'instant'
}

function formatNombre(val, decimales = 0) {
  if (val == null) return null
  return val.toLocaleString('fr-BE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
}

// ── Widget marché ─────────────────────────────────────────────────────────────

function WidgetMarche({ label, prix, unite, change, loading }) {
  const pos = change != null && change > 0
  const neg = change != null && change < 0
  const Icon = pos ? TrendingUp : neg ? TrendingDown : Minus

  if (loading) {
    return (
      <div className="flex flex-col gap-1.5 px-5 py-4 border-r border-velin-clair/8 last:border-r-0 min-w-[120px]">
        <div className="h-2.5 w-14 bg-velin-clair/10 rounded animate-pulse" />
        <div className="h-5 w-20 bg-velin-clair/15 rounded animate-pulse" />
        <div className="h-2.5 w-10 bg-velin-clair/10 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 px-5 py-4 border-r border-velin-clair/8 last:border-r-0 min-w-[120px]">
      <span className="text-[9px] uppercase tracking-[0.18em] font-sans font-medium text-velin-clair/40">
        {label}
      </span>
      <span className="font-serif text-lg font-medium text-velin-clair tabular-nums leading-tight">
        {prix != null ? `${prix} ${unite}` : '—'}
      </span>
      {change != null ? (
        <span className={`flex items-center gap-1 text-[11px] font-sans font-medium tabular-nums ${
          pos ? 'text-vert' : neg ? 'text-rouge' : 'text-velin-clair/35'
        }`}>
          <Icon size={10} strokeWidth={2.5} aria-hidden="true" />
          {change >= 0 ? '+' : ''}{change.toFixed(2)} %
        </span>
      ) : (
        <span className="text-[11px] text-velin-clair/20 font-sans">—</span>
      )}
    </div>
  )
}

// ── Squelette article ─────────────────────────────────────────────────────────

function SqueletteArticle() {
  return (
    <div className="py-4 border-b border-encre/6 last:border-b-0 animate-pulse">
      <div className="h-4 bg-encre/8 rounded mb-1.5 w-full" />
      <div className="h-4 bg-encre/8 rounded mb-3 w-4/5" />
      <div className="h-3 bg-encre/5 rounded w-2/5" />
    </div>
  )
}

// ── Carte article ─────────────────────────────────────────────────────────────

function CarteArticle({ article, index }) {
  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block py-4 border-b border-encre/6 last:border-b-0 cursor-pointer"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.035, ease: [0.32, 0.72, 0, 1] }}
    >
      <h3 className="
        font-serif italic text-base leading-snug text-encre
        group-hover:text-or-fonce transition-colors duration-200
        line-clamp-3 mb-2.5
      ">
        {article.title}
      </h3>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-encre-tertiaire font-sans truncate">
          {article.source}
          <span className="mx-1.5 opacity-40">·</span>
          {tempsRelatif(article.publishedAt)}
        </span>
        <ExternalLink
          size={11}
          strokeWidth={1.75}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-or transition-opacity duration-200"
          aria-hidden="true"
        />
      </div>
    </motion.a>
  )
}

// ── Colonne news ──────────────────────────────────────────────────────────────

function ColonneNews({ category, articles, loading, error }) {
  return (
    <div className="surface-velin liserer-signature p-5 flex flex-col">
      {/* En-tête colonne */}
      <div className="flex items-baseline justify-between mb-3 pb-3 border-b border-or/20">
        <h2
          className="text-[10px] uppercase tracking-[0.2em] font-sans font-semibold text-encre-secondaire"
          style={{ letterSpacing: '0.18em' }}
        >
          {category.label}
        </h2>
        {!loading && !error && (
          <span className="text-[10px] text-encre-tertiaire font-sans tabular-nums">
            {articles.length}
          </span>
        )}
      </div>

      {/* Contenu */}
      {loading ? (
        Array.from({ length: 6 }).map((_, i) => <SqueletteArticle key={i} />)
      ) : error ? (
        <div className="flex items-center gap-2 py-5 text-rouge/60">
          <AlertCircle size={14} strokeWidth={1.75} aria-hidden="true" />
          <span className="text-sm font-serif italic">Source indisponible</span>
        </div>
      ) : articles.length === 0 ? (
        <p className="text-sm font-serif italic text-encre-tertiaire py-5">
          Aucun article disponible.
        </p>
      ) : (
        articles.map((a, i) => (
          <CarteArticle key={a.url} article={a} index={i} />
        ))
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function News() {
  const [activeTab,      setActiveTab]      = useState(0)
  const [markets,        setMarkets]        = useState(null)
  const [marketsLoading, setMarketsLoading] = useState(true)
  const [newsData,       setNewsData]       = useState({})
  const [newsLoading,    setNewsLoading]    = useState(
    Object.fromEntries(CATEGORIES.map(c => [c.id, true]))
  )
  const [newsError,      setNewsError]      = useState({})
  const [lastRefresh,    setLastRefresh]    = useState(null)
  const [refreshing,     setRefreshing]     = useState(false)

  // ── Chargement ──

  const chargerMarches = useCallback(async () => {
    setMarketsLoading(true)
    try {
      setMarkets(await fetchMarkets())
    } catch {
      setMarkets(null)
    } finally {
      setMarketsLoading(false)
    }
  }, [])

  const chargerNews = useCallback(async () => {
    const results = await Promise.allSettled(
      CATEGORIES.map(c => fetchNewsCategory(c.id))
    )
    const data = {}, errors = {}
    CATEGORIES.forEach((cat, i) => {
      if (results[i].status === 'fulfilled') data[cat.id] = results[i].value
      else errors[cat.id] = true
    })
    setNewsData(data)
    setNewsError(errors)
    setLastRefresh(new Date())
  }, [])

  useEffect(() => {
    const init = async () => {
      await Promise.all([chargerMarches(), chargerNews()])
      setNewsLoading({})
    }
    init()
  }, [chargerMarches, chargerNews])

  const handleRefresh = useCallback(async () => {
    if (refreshing) return
    clearNewsCache()
    setRefreshing(true)
    setNewsLoading(Object.fromEntries(CATEGORIES.map(c => [c.id, true])))
    await Promise.all([chargerMarches(), chargerNews()])
    setNewsLoading({})
    setRefreshing(false)
  }, [refreshing, chargerMarches, chargerNews])

  // ── Données marché formatées ──

  const btc = markets?.bitcoin
  const eth = markets?.ethereum

  const widgets = useMemo(() => [
    {
      label: 'Bitcoin',
      prix:  btc ? formatNombre(btc.eur) : null,
      unite: '€',
      change: btc?.eur_24h_change ?? null,
    },
    {
      label: 'Ethereum',
      prix:  eth ? formatNombre(eth.eur) : null,
      unite: '€',
      change: eth?.eur_24h_change ?? null,
    },
    {
      label: 'EUR / USD',
      prix:  markets?.eurusd != null ? formatNombre(markets.eurusd, 4) : null,
      unite: '$',
      change: null,
    },
    {
      label: 'Or (XAU)',
      prix:  markets?.gold != null ? formatNombre(markets.gold) : null,
      unite: '$ / oz',
      change: null,
    },
  ], [btc, eth, markets])

  const heureRefresh = useMemo(() =>
    lastRefresh
      ? lastRefresh.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
      : null,
    [lastRefresh]
  )

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── En-tête ── */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif italic text-2xl text-encre leading-tight">
            Briefing du matin
          </h1>
          <p className="text-[11px] text-encre-tertiaire font-sans mt-0.5">
            {heureRefresh
              ? `Actualisé à ${heureRefresh} · Cache 15 min`
              : 'Chargement…'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Actualiser les données"
          className="
            flex items-center gap-2 px-3.5 py-2 rounded-md
            border border-or/25 text-encre-secondaire text-xs font-sans
            hover:bg-velin-fonce hover:border-or/45
            transition-all duration-200
            disabled:opacity-35 disabled:cursor-not-allowed
          "
        >
          <RefreshCw
            size={12}
            strokeWidth={1.75}
            className={refreshing ? 'animate-spin' : ''}
            aria-hidden="true"
          />
          Actualiser
        </button>
      </div>

      {/* ── Barre marchés ── */}
      <div
        className="rounded-lg overflow-hidden relative"
        style={{ background: 'var(--nuit)' }}
      >
        {/* Liseré signature en bas */}
        <span
          className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'var(--gradient-signature)' }}
          aria-hidden="true"
        />

        <div
          className="px-5 pt-3 pb-2 border-b"
          style={{ borderColor: 'rgba(241,236,224,0.08)' }}
        >
          <span className="text-[9px] uppercase tracking-[0.22em] font-sans font-medium"
            style={{ color: 'rgba(241,236,224,0.35)' }}>
            Marchés — temps réel
          </span>
        </div>

        <div className="flex flex-wrap overflow-x-auto">
          {widgets.map(w => (
            <WidgetMarche key={w.label} loading={marketsLoading} {...w} />
          ))}
        </div>
      </div>

      {/* ── Tabs mobile ── */}
      <div
        className="md:hidden flex border-b"
        style={{ borderColor: 'rgba(31,24,16,0.08)' }}
        role="tablist"
        aria-label="Catégories d'actualités"
      >
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={activeTab === i}
            onClick={() => setActiveTab(i)}
            className={`
              flex-1 py-2.5 text-[11px] font-sans font-medium uppercase tracking-wider
              transition-colors duration-200 relative
              ${activeTab === i ? 'text-or' : 'text-encre-tertiaire hover:text-encre'}
            `}
          >
            {cat.labelCourt}
            {activeTab === i && (
              <motion.span
                layoutId="news-tab"
                className="absolute bottom-0 left-2 right-2 h-px"
                style={{ background: 'var(--or)' }}
                transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Grille desktop ── */}
      <div className="hidden md:grid grid-cols-4 gap-4 items-start">
        {CATEGORIES.map(cat => (
          <ColonneNews
            key={cat.id}
            category={cat}
            articles={newsData[cat.id] || []}
            loading={!!newsLoading[cat.id]}
            error={!!newsError[cat.id]}
          />
        ))}
      </div>

      {/* ── Colonne active mobile ── */}
      <div className="md:hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          >
            <ColonneNews
              category={CATEGORIES[activeTab]}
              articles={newsData[CATEGORIES[activeTab].id] || []}
              loading={!!newsLoading[CATEGORIES[activeTab].id]}
              error={!!newsError[CATEGORIES[activeTab].id]}
            />
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  )
}
