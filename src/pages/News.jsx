/**
 * src/pages/News.jsx — Salon & marchés
 * Terminal de veille & marchés : prix temps réel, météo, sentiment, actualités.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, Star } from 'lucide-react'
import { BarChart2, Cpu, FlaskConical, Globe2 } from 'lucide-react'
import { fetchNewsCategory, fetchMarkets, fetchStocks, clearNewsCache } from '../lib/newsApi'

import { GrapheModal }      from '../components/news/GrapheModal'
import { WidgetMeteo,      fetchWeather }    from '../components/news/WidgetMeteo'
import { WidgetFearGreed,  fetchFearGreed }  from '../components/news/WidgetFearGreed'
import { WidgetFx,         fetchFx }         from '../components/news/WidgetFx'
import { WidgetBceFed }    from '../components/news/WidgetBceFed'
import { WidgetPortfolio } from '../components/news/WidgetPortfolio'
import { WidgetMarche, SepGroupe } from '../components/news/BarreMarches'
import { ColonneNews, SectionFavoris } from '../components/news/ColonneNews'

// ── Constantes ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'business',   label: 'Finance',   labelCourt: 'Finance',  Icon: BarChart2    },
  { id: 'technology', label: 'Tech & IA', labelCourt: 'Tech',     Icon: Cpu          },
  { id: 'science',    label: 'Sciences',  labelCourt: 'Sciences', Icon: FlaskConical },
  { id: 'world',      label: 'Monde',     labelCourt: 'Monde',    Icon: Globe2       },
]

function fmt(val, dec = 0) {
  if (val == null) return null
  return val.toLocaleString('fr-BE', { minimumFractionDigits: dec, maximumFractionDigits: dec })
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
  const [chartItem,      setChartItem]      = useState(null)
  const [weather,        setWeather]        = useState(undefined)
  const [fg,             setFg]             = useState(undefined)
  const [fx,             setFx]             = useState(undefined)
  const [stocks,         setStocks]         = useState(null)

  // ── Favoris (localStorage) ──────────────────────────────────────────────────
  const [savedArticles, setSavedArticles] = useState(() => {
    try {
      const raw = localStorage.getItem('news_favoris')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  const savedUrls = useMemo(() => new Set(savedArticles.map(a => a.url)), [savedArticles])

  const toggleSave = useCallback((article) => {
    setSavedArticles(prev => {
      const next = prev.some(a => a.url === article.url)
        ? prev.filter(a => a.url !== article.url)
        : [...prev, article]
      try { localStorage.setItem('news_favoris', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const chargerMarches = useCallback(async () => {
    setMarketsLoading(true)
    try {
      const [m, s] = await Promise.all([fetchMarkets(), fetchStocks()])
      setMarkets(m)
      setStocks(s)
    } catch {
      setMarkets(null)
    } finally {
      setMarketsLoading(false)
    }
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

  const chargerWidgets = useCallback(async () => {
    setWeather(undefined)
    setFg(undefined)
    setFx(undefined)
    const [w, f, x] = await Promise.all([fetchWeather(), fetchFearGreed(), fetchFx()])
    setWeather(w)
    setFg(f)
    setFx(x)
  }, [])

  useEffect(() => {
    const init = async () => {
      await Promise.all([chargerMarches(), chargerNews(), chargerWidgets()])
      setNewsLoading({})
    }
    init()
  }, [chargerMarches, chargerNews, chargerWidgets])

  const handleRefresh = useCallback(async () => {
    if (refreshing) return
    clearNewsCache()
    setRefreshing(true)
    setNewsLoading(Object.fromEntries(CATEGORIES.map(c => [c.id, true])))
    await Promise.all([chargerMarches(), chargerNews(), chargerWidgets()])
    setNewsLoading({})
    setRefreshing(false)
  }, [refreshing, chargerMarches, chargerNews, chargerWidgets])

  const widgetRows = useMemo(() => {
    const btc  = markets?.bitcoin
    const eth  = markets?.ethereum
    const sol  = markets?.solana
    const xrp  = markets?.ripple
    const bnb  = markets?.binancecoin
    const avax = markets?.avalanche
    const fmtS = (v, d = 2) => v != null ? fmt(v, d) : null
    return [
      // ── Ligne 1 : Crypto + Indices ───────────────────────────────────────
      [
        {
          key: 'crypto', label: 'Crypto',
          items: [
            { label: 'Bitcoin',  prix: fmtS(btc?.usd),  unite: '$', change: btc?.usd_24h_change  ?? null, coinId: 'bitcoin',     indexSymbol: null },
            { label: 'Ethereum', prix: fmtS(eth?.usd),  unite: '$', change: eth?.usd_24h_change  ?? null, coinId: 'ethereum',    indexSymbol: null },
            { label: 'Solana',   prix: fmtS(sol?.usd),  unite: '$', change: sol?.usd_24h_change  ?? null, coinId: 'solana',      indexSymbol: null },
            { label: 'XRP',      prix: fmtS(xrp?.usd),  unite: '$', change: xrp?.usd_24h_change  ?? null, coinId: 'ripple',      indexSymbol: null },
            { label: 'BNB',      prix: fmtS(bnb?.usd),  unite: '$', change: bnb?.usd_24h_change  ?? null, coinId: 'binancecoin', indexSymbol: null },
            { label: 'AVAX',     prix: fmtS(avax?.usd), unite: '$', change: avax?.usd_24h_change ?? null, coinId: 'avalanche-2', indexSymbol: null },
          ],
        },
        {
          key: 'indices', label: 'Indices',
          items: [
            { label: 'CAC 40',  prix: fmtS(markets?.cac40?.price), unite: 'pts', change: markets?.cac40?.change ?? null, coinId: null, indexSymbol: '^FCHI' },
            { label: 'S&P 500', prix: fmtS(markets?.sp500?.price), unite: 'pts', change: markets?.sp500?.change ?? null, coinId: null, indexSymbol: '^GSPC' },
            { label: 'BEL 20',  prix: fmtS(markets?.bel20?.price), unite: 'pts', change: markets?.bel20?.change ?? null, coinId: null, indexSymbol: '^BFX'  },
          ],
        },
      ],
      // ── Ligne 2 : Or + Actions ────────────────────────────────────────────
      [
        {
          key: 'or', label: 'Or',
          items: [
            { label: 'Or (XAU)', prix: fmtS(markets?.gold?.usd), unite: '$', change: markets?.gold?.usd_24h_change ?? null, coinId: 'pax-gold', indexSymbol: null },
          ],
        },
        {
          key: 'actions', label: 'Actions',
          items: [
            { label: 'NVIDIA',    prix: fmtS(stocks?.nvda?.price), unite: '$', change: stocks?.nvda?.change ?? null, coinId: null, indexSymbol: 'NVDA' },
            { label: 'Tesla',     prix: fmtS(stocks?.tsla?.price), unite: '$', change: stocks?.tsla?.change ?? null, coinId: null, indexSymbol: 'TSLA' },
            { label: 'Apple',     prix: fmtS(stocks?.aapl?.price), unite: '$', change: stocks?.aapl?.change ?? null, coinId: null, indexSymbol: 'AAPL' },
            { label: 'Oracle',    prix: fmtS(stocks?.orcl?.price), unite: '$', change: stocks?.orcl?.change ?? null, coinId: null, indexSymbol: 'ORCL' },
            { label: 'Microsoft', prix: fmtS(stocks?.msft?.price), unite: '$', change: stocks?.msft?.change ?? null, coinId: null, indexSymbol: 'MSFT' },
            { label: 'Meta',      prix: fmtS(stocks?.meta?.price), unite: '$', change: stocks?.meta?.change ?? null, coinId: null, indexSymbol: 'META' },
          ],
        },
      ],
    ]
  }, [markets, stocks])

  const heureRefresh = useMemo(() =>
    lastRefresh ? lastRefresh.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }) : null,
    [lastRefresh]
  )

  return (
    <div className="space-y-5">

      {/* ── En-tête ── */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif font-medium text-[31px] text-encre leading-none tracking-tight">
            Salon & marchés
          </h1>
          <p className="font-sans mt-1 text-[14px]" style={{ color: 'var(--encre-tertiaire)' }}>
            {heureRefresh ? `Actualisé à ${heureRefresh} · Cache 15 min` : 'Chargement…'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Actualiser les données"
          className="group flex items-center gap-2 px-3.5 py-2 rounded-md border border-or/25
            text-encre-secondaire text-[13px] font-sans hover:bg-velin-fonce hover:border-or/45 hover:text-encre
            transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed"
        >
          <RefreshCw size={12} strokeWidth={1.75} className={refreshing ? 'animate-spin' : 'group-hover:text-or/80 transition-colors duration-200'} aria-hidden="true" />
          Actualiser
        </button>
      </div>

      {/* ── Barre marchés ── */}
      <div className="rounded-xl overflow-hidden relative" style={{ background: 'var(--nuit)' }}>
        <span
          className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'var(--gradient-signature)' }}
          aria-hidden="true"
        />

        <div className="px-5 pt-3 pb-2 border-b flex items-center gap-2" style={{ borderColor: 'rgba(241,236,224,0.08)' }}>
          <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: 'var(--vert)' }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: 'var(--vert)' }} />
          </span>
          <span className="text-[10px] uppercase tracking-[0.22em] font-sans font-medium" style={{ color: 'rgba(241,236,224,0.35)' }}>
            Marchés — temps réel
          </span>
        </div>

        {widgetRows.map((groups, rowIdx) => (
          <div key={rowIdx} className={`relative ${rowIdx > 0 ? 'border-t' : ''}`} style={rowIdx > 0 ? { borderColor: 'rgba(241,236,224,0.08)' } : {}}>
            <div
              className="absolute left-0 top-0 bottom-0 w-6 pointer-events-none z-10"
              style={{ background: 'linear-gradient(to right, var(--nuit), transparent)' }}
              aria-hidden="true"
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none z-10"
              style={{ background: 'linear-gradient(to left, var(--nuit), transparent)' }}
              aria-hidden="true"
            />
            <div className="overflow-x-auto scrollbar-none flex">
              <div className="flex min-w-max px-4 mx-auto">
                {groups.map((group, gi) => (
                  <div key={group.key} className="flex shrink-0">
                    {gi > 0 && <SepGroupe label={group.label} />}
                    {group.items.map(w => (
                      <WidgetMarche
                        key={w.label}
                        loading={marketsLoading}
                        {...w}
                        onChartClick={setChartItem}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Widgets — ligne 1 : 3 petits (même hauteur) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <WidgetMeteo weather={weather} />
        <WidgetBceFed />
        <WidgetFearGreed fg={fg} />
      </div>

      {/* ── Widgets — ligne 2 : convertisseur pleine largeur ── */}
      <WidgetPortfolio markets={markets} loading={marketsLoading} />

      {/* ── Widgets — ligne 3 : taux de change pleine largeur ── */}
      <WidgetFx fx={fx} />

      {/* ── Tabs mobile ── */}
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
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-sans font-medium
                uppercase tracking-wider transition-colors duration-200 relative
                ${active ? 'text-or' : 'text-encre-tertiaire hover:text-encre hover:bg-encre/5 rounded-sm'}`}
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

      {/* ── Grille desktop ── */}
      <div className="hidden md:grid grid-cols-2 gap-4 items-start">
        {CATEGORIES.map(cat => (
          <ColonneNews
            key={cat.id}
            category={cat}
            articles={newsData[cat.id] || []}
            loading={!!newsLoading[cat.id]}
            error={newsError[cat.id] || null}
            savedUrls={savedUrls}
            onToggleSave={toggleSave}
          />
        ))}
      </div>

      {/* ── Section favoris desktop (en dessous de la grille) ── */}
      {savedArticles.length > 0 && (
        <div className="hidden md:block">
          <SectionFavoris articles={savedArticles} onToggleSave={toggleSave} />
        </div>
      )}

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
              error={newsError[CATEGORIES[activeTab].id] || null}
              savedUrls={savedUrls}
              onToggleSave={toggleSave}
            />
          </motion.div>
        </AnimatePresence>

        {/* Favoris mobile — en dessous de l'onglet actif */}
        {savedArticles.length > 0 && (
          <div className="mt-6">
            <SectionFavoris articles={savedArticles} onToggleSave={toggleSave} />
          </div>
        )}
      </div>

      {/* ── Modal graphe prix ── */}
      <AnimatePresence>
        {chartItem && (
          <GrapheModal
            key="chart-modal"
            item={chartItem}
            onClose={() => setChartItem(null)}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
