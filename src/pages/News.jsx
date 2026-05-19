/**
 * src/pages/News.jsx — Briefing du matin
 * ----------------------------------------------------------------------------
 * Terminal de veille : marchés en temps réel + actualités par catégorie.
 * Desktop : 4 colonnes. Mobile : tabs + colonne unique.
 * Cache sessionStorage 15 min pour préserver les quotas API.
 * ----------------------------------------------------------------------------
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, TrendingUp, TrendingDown, Minus,
  BarChart2, Cpu, FlaskConical, Globe2,
} from 'lucide-react'
import { fetchNewsCategory, fetchMarkets, clearNewsCache } from '../lib/newsApi'

const CATEGORIES = [
  { id: 'business',   label: 'Finance',   labelCourt: 'Finance',  Icon: BarChart2    },
  { id: 'technology', label: 'Tech & IA', labelCourt: 'Tech',     Icon: Cpu          },
  { id: 'science',    label: 'Sciences',  labelCourt: 'Sciences', Icon: FlaskConical },
  { id: 'world',      label: 'Monde',     labelCourt: 'Monde',    Icon: Globe2       },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function tempsRelatif(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h >= 48) return `${Math.floor(h / 24)}j`
  if (h >= 1)  return `${h}h`
  if (m >= 1)  return `${m}min`
  return "À l'instant"
}

function fmt(val, dec = 0) {
  if (val == null) return null
  return val.toLocaleString('fr-BE', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// ── Widget marché ─────────────────────────────────────────────────────────────

function WidgetMarche({ label, prix, unite, change, loading }) {
  const pos  = change != null && change > 0
  const neg  = change != null && change < 0
  const Icon = pos ? TrendingUp : neg ? TrendingDown : Minus

  if (loading) {
    return (
      <div className="flex flex-col gap-2 px-5 py-4 min-w-[130px] shrink-0">
        <div className="h-2 w-12 bg-velin-clair/10 rounded animate-pulse" />
        <div className="h-6 w-24 bg-velin-clair/15 rounded animate-pulse" />
        <div className="h-4 w-14 bg-velin-clair/10 rounded-full animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 px-5 py-4 min-w-[130px] shrink-0">
      <span className="text-[9px] uppercase tracking-[0.18em] font-sans font-medium text-velin-clair/40 whitespace-nowrap">
        {label}
      </span>

      <div className="flex items-baseline gap-1.5">
        <span
          className="font-serif text-[1.2rem] font-medium text-velin-clair leading-none"
          style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
        >
          {prix ?? '--'}
        </span>
        {prix != null && (
          <span className="text-[10px] text-velin-clair/40 font-sans leading-none">{unite}</span>
        )}
      </div>

      {change != null ? (
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-sans font-semibold
            px-1.5 py-0.5 rounded-full w-fit leading-none ${
            pos ? 'bg-vert/15 text-vert' : neg ? 'bg-rouge/15 text-rouge' : 'bg-velin-clair/8 text-velin-clair/35'
          }`}
          style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
        >
          <Icon size={8} strokeWidth={2.5} aria-hidden="true" />
          {change >= 0 ? '+' : ''}{change.toFixed(2)} %
        </span>
      ) : (
        <span className="text-[10px] text-velin-clair/20 font-sans">--</span>
      )}
    </div>
  )
}

// ── Séparateur de groupe ──────────────────────────────────────────────────────

function SepGroupe({ label }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-4 shrink-0 select-none">
      <div className="h-8 w-px bg-velin-clair/10" />
      {label && (
        <span className="text-[8px] uppercase tracking-[0.2em] font-sans text-velin-clair/20 mt-1.5 whitespace-nowrap">
          {label}
        </span>
      )}
    </div>
  )
}

// ── Squelette article ─────────────────────────────────────────────────────────

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

// ── Squelette erreur (sobre, velin-fonce) ─────────────────────────────────────

function SqueletteErreur() {
  return (
    <div className="py-2 space-y-4">
      {[90, 75, 60].map((w, i) => (
        <div key={i} className="animate-pulse space-y-1.5">
          <div className="h-3 bg-velin-fonce rounded" style={{ width: `${w}%` }} />
          <div className="h-3 bg-velin-fonce rounded" style={{ width: `${w - 15}%` }} />
          <div className="h-2.5 bg-velin-fonce/70 rounded w-1/3" />
        </div>
      ))}
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
      className="group flex gap-3.5 py-4 border-b border-encre/6 last:border-b-0 cursor-pointer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08, ease: [0.32, 0.72, 0, 1] }}
    >
      {/* Numéro éditorial */}
      <span className="text-[10px] font-sans font-medium tabular-nums text-encre-tertiaire/40
        group-hover:text-or/70 transition-colors duration-200 mt-0.5 w-4 shrink-0 leading-snug">
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="flex-1 min-w-0">
        <h3 className="font-serif italic text-[1.05rem] leading-snug text-encre
          group-hover:text-or-fonce transition-colors duration-200 line-clamp-4 mb-2">
          {article.title}
        </h3>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-encre-tertiaire font-sans font-medium truncate">
              {article.source}
            </span>
            <span className="text-encre-tertiaire/30 text-[10px]">·</span>
            <span className="text-[10px] text-encre-tertiaire/60 font-sans shrink-0">
              {tempsRelatif(article.publishedAt)}
            </span>
          </div>
          <span
            className="shrink-0 text-[11px] font-sans font-medium opacity-0
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

// ── Colonne news ──────────────────────────────────────────────────────────────

function ColonneNews({ category, articles, loading, error }) {
  const { Icon } = category

  return (
    <div
      className="surface-velin liserer-signature p-5 flex flex-col"
      style={{ borderTop: '2px solid var(--bordeaux)' }}
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-or/15">
        <div className="flex items-center gap-2">
          <Icon
            size={12}
            strokeWidth={1.75}
            className="text-or/60 shrink-0"
            aria-hidden="true"
          />
          <h2 className="font-serif italic text-[0.875rem] text-encre-secondaire leading-none">
            {category.label}
          </h2>
        </div>
        {!loading && !error && articles.length > 0 && (
          <span className="text-[9px] font-sans tabular-nums bg-encre/5 text-encre-tertiaire
            px-1.5 py-0.5 rounded-full leading-none">
            {articles.length}
          </span>
        )}
      </div>

      {loading ? (
        Array.from({ length: 5 }).map((_, i) => <SqueletteArticle key={i} />)
      ) : error ? (
        <SqueletteErreur />
      ) : articles.length === 0 ? (
        <p className="text-sm font-serif italic text-encre-tertiaire py-5">Aucun article disponible.</p>
      ) : (
        articles.map((a, i) => <CarteArticle key={a.url} article={a} index={i} />)
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
  const [newsLoading,    setNewsLoading]    = useState(Object.fromEntries(CATEGORIES.map(c => [c.id, true])))
  const [newsError,      setNewsError]      = useState({})
  const [lastRefresh,    setLastRefresh]    = useState(null)
  const [refreshing,     setRefreshing]     = useState(false)

  const chargerMarches = useCallback(async () => {
    setMarketsLoading(true)
    try { setMarkets(await fetchMarkets()) }
    catch { setMarkets(null) }
    finally { setMarketsLoading(false) }
  }, [])

  const chargerNews = useCallback(async () => {
    const results = await Promise.allSettled(CATEGORIES.map(c => fetchNewsCategory(c.id)))
    const data = {}, errors = {}
    CATEGORIES.forEach((cat, i) => {
      if (results[i].status === 'fulfilled') data[cat.id] = results[i].value
      else errors[cat.id] = results[i].reason?.message || 'Erreur inconnue'
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

  // ── Groupes de widgets marchés ──

  const widgetGroups = useMemo(() => {
    const btc = markets?.bitcoin
    const eth = markets?.ethereum
    return [
      {
        key: 'crypto',
        label: 'Crypto',
        items: [
          { label: 'Bitcoin',  prix: btc ? fmt(btc.usd) : null,       unite: '$', change: btc?.usd_24h_change ?? null },
          { label: 'Ethereum', prix: eth ? fmt(eth.usd) : null,       unite: '$', change: eth?.usd_24h_change ?? null },
        ],
      },
      {
        key: 'forex',
        label: 'Forex & Or',
        items: [
          {
            label: 'EUR / USD',
            prix:  markets?.eurusd?.rate != null ? fmt(markets.eurusd.rate, 4) : null,
            unite: '$',
            change: markets?.eurusd?.change ?? null,
          },
          {
            label:  'Or (XAU)',
            prix:   markets?.gold?.usd != null ? fmt(markets.gold.usd) : null,
            unite:  '$',
            change: markets?.gold?.usd_24h_change ?? null,
          },
        ],
      },
      {
        key: 'indices',
        label: 'Indices',
        items: [
          { label: 'CAC 40',  prix: markets?.cac40?.price != null ? fmt(markets.cac40.price) : null, unite: 'pts', change: markets?.cac40?.change ?? null },
          { label: 'S&P 500', prix: markets?.sp500?.price != null ? fmt(markets.sp500.price) : null, unite: 'pts', change: markets?.sp500?.change ?? null },
          { label: 'BEL 20',  prix: markets?.bel20?.price != null ? fmt(markets.bel20.price) : null, unite: 'pts', change: markets?.bel20?.change ?? null },
        ],
      },
    ]
  }, [markets])

  const heureRefresh = useMemo(() =>
    lastRefresh ? lastRefresh.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }) : null,
    [lastRefresh]
  )

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes liquid-morph {
          0%   { border-radius: 14px 20px 16px 10px / 10px 14px 20px 16px; }
          25%  { border-radius: 20px 10px 18px 14px / 16px 10px 14px 20px; }
          50%  { border-radius: 10px 16px 14px 20px / 20px 16px 10px 14px; }
          75%  { border-radius: 18px 14px 10px 16px / 12px 20px 16px 10px; }
          100% { border-radius: 14px 20px 16px 10px / 10px 14px 20px 16px; }
        }
        @keyframes liquid-breathe {
          0%, 100% { box-shadow: 0 10px 40px rgba(14,31,58,0.55), 0 3px 10px rgba(14,31,58,0.3); }
          50%       { box-shadow: 0 16px 52px rgba(14,31,58,0.65), 0 6px 18px rgba(14,31,58,0.35); }
        }
      `}</style>

      {/* En-tête */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif italic text-2xl text-encre leading-tight">Briefing du matin</h1>
          <p className="font-sans mt-0.5" style={{ fontSize: '0.75rem', color: 'var(--encre-tertiaire)' }}>
            {heureRefresh ? `Actualisé à ${heureRefresh} · Cache 15 min` : 'Chargement…'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Actualiser les données"
          className="flex items-center gap-2 px-3.5 py-2 rounded-md border border-or/25
            text-encre-secondaire text-xs font-sans hover:bg-velin-fonce hover:border-or/45
            transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed"
        >
          <RefreshCw size={12} strokeWidth={1.75} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          Actualiser
        </button>
      </div>

      {/* Barre marchés — bulle liquide */}
      <div
        className="overflow-hidden relative"
        style={{
          background: 'var(--nuit)',
          animation: 'liquid-morph 16s ease-in-out infinite, liquid-breathe 8s ease-in-out infinite',
          willChange: 'border-radius, box-shadow',
        }}
      >
        {/* Reflet de surface — simule la courbure d'une membrane liquide */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 28% 12%, rgba(241,236,224,0.06) 0%, transparent 50%)',
            zIndex: 1,
          }}
          aria-hidden="true"
        />

        {/* Trait signature bas */}
        <span
          className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'var(--gradient-signature)', zIndex: 2 }}
          aria-hidden="true"
        />

        {/* En-tête barre */}
        <div className="px-5 pt-3 pb-2 border-b flex items-center gap-2" style={{ borderColor: 'rgba(241,236,224,0.08)' }}>
          {/* Dot live */}
          <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
              style={{ background: 'var(--vert)' }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5"
              style={{ background: 'var(--vert)' }} />
          </span>
          <span className="text-[9px] uppercase tracking-[0.22em] font-sans font-medium"
            style={{ color: 'rgba(241,236,224,0.35)' }}>
            Marchés — temps réel
          </span>
        </div>

        {/* Widgets avec groupes */}
        <div className="flex overflow-x-auto scrollbar-none">
          {widgetGroups.map((group, gi) => (
            <div key={group.key} className="flex shrink-0">
              {gi > 0 && <SepGroupe label={group.label} />}
              {group.items.map(w => (
                <WidgetMarche key={w.label} loading={marketsLoading} {...w} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs mobile */}
      <div
        className="md:hidden flex border-b"
        style={{ borderColor: 'rgba(31,24,16,0.08)' }}
        role="tablist"
      >
        {CATEGORIES.map((cat, i) => {
          const { Icon } = cat
          const active = activeTab === i
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(i)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-sans font-medium
                uppercase tracking-wider transition-colors duration-200 relative
                ${active ? 'text-or' : 'text-encre-tertiaire hover:text-encre'}`}
            >
              <Icon size={13} strokeWidth={active ? 2 : 1.5} aria-hidden="true" />
              {cat.labelCourt}
              {active && (
                <motion.span
                  layoutId="news-tab"
                  className="absolute bottom-0 left-2 right-2 h-px"
                  style={{ background: 'var(--or)' }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Grille desktop */}
      <div className="hidden md:grid grid-cols-2 gap-4 items-start">
        {CATEGORIES.map(cat => (
          <ColonneNews
            key={cat.id}
            category={cat}
            articles={newsData[cat.id] || []}
            loading={!!newsLoading[cat.id]}
            error={newsError[cat.id] || null}
          />
        ))}
      </div>

      {/* Colonne active mobile */}
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
              error={newsError[CATEGORIES[activeTab].id] || null}
            />
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  )
}
