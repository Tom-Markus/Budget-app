/**
 * src/lib/newsApi.js
 * ----------------------------------------------------------------------------
 * Sources :
 *   News    : GNews /search (plan gratuit ne supporte pas category= en top-headlines)
 *   Crypto  : CoinGecko — BTC, ETH, Or via PAXG (pas de cle)
 *   Indices : Yahoo Finance via proxy allorigins.win — CAC40, S&P500, BEL20
 *   Forex   : Alpha Vantage FX_DAILY — EUR/USD avec variation 24h
 * ----------------------------------------------------------------------------
 */

const GNEWS_KEY = import.meta.env.VITE_GNEWS_KEY
const AV_KEY    = import.meta.env.VITE_ALPHA_VANTAGE_KEY
const TD_KEY    = import.meta.env.VITE_TWELVE_DATA_KEY
const CACHE_TTL = 15 * 60 * 1000

// ── Cache ──────────────────────────────────────────────────────────────────

function getCached(key) {
  try {
    const item = JSON.parse(sessionStorage.getItem(key) || 'null')
    if (item && Date.now() - item.ts < CACHE_TTL) return item.data
  } catch {}
  return null
}

function setCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }))
  } catch {}
}

export function clearNewsCache() {
  ;['business', 'technology', 'science', 'world'].forEach(c =>
    sessionStorage.removeItem(`gnews_${c}`)
  )
  ;['coingecko_markets', 'av_eurusd_daily', 'indices_twelvedata', 'indices_yahoo'].forEach(k =>
    sessionStorage.removeItem(k)
  )
}

// ── News — GNews /search ───────────────────────────────────────────────────
// Le plan gratuit ne supporte pas category= sur /top-headlines → on utilise
// /search avec des mots-cles thematiques.

const CATEGORY_QUERIES = {
  business:   'finance economie bourse marchés',
  technology: 'technologie intelligence artificielle innovation',
  science:    'science decouverte recherche',
  world:      'monde international geopolitique actualites',
}

export async function fetchNewsCategory(category, max = 8) {
  const cacheKey = `gnews_${category}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const q = encodeURIComponent(CATEGORY_QUERIES[category] || category)
  const url = `https://gnews.io/api/v4/search?q=${q}&max=${max}&apikey=${GNEWS_KEY}`

  let res
  try {
    res = await fetch(url)
  } catch {
    throw new Error('Reseau inaccessible (CORS ou hors ligne)')
  }

  if (res.status === 401) throw new Error('Cle GNews invalide — verifie VITE_GNEWS_KEY')
  if (res.status === 403) throw new Error('Compte GNews non verifie — confirme ton email sur gnews.io/dashboard')
  if (!res.ok) throw new Error(`Erreur GNews ${res.status}`)

  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0])

  const articles = (json.articles || []).map(a => ({
    title:       a.title,
    url:         a.url,
    source:      a.source?.name || 'Source',
    publishedAt: a.publishedAt,
  }))

  setCache(cacheKey, articles)
  return articles
}

// ── Crypto + Or — CoinGecko ────────────────────────────────────────────────

async function fetchCoinGecko() {
  const cacheKey = 'coingecko_markets'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price' +
    '?ids=bitcoin,ethereum,pax-gold' +
    '&vs_currencies=eur,usd' +
    '&include_24hr_change=true'
  )
  if (!res.ok) return null

  const data = await res.json()
  setCache(cacheKey, data)
  return data
}

// ── Forex — Alpha Vantage FX_DAILY ────────────────────────────────────────

async function fetchEURUSD() {
  const cacheKey = 'av_eurusd_daily'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const res = await fetch(
    `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=EUR&to_symbol=USD&outputsize=compact&apikey=${AV_KEY}`
  )
  if (!res.ok) return null

  const json = await res.json()
  const series = json['Time Series FX (Daily)']
  if (!series) return null

  const dates = Object.keys(series).sort().reverse()
  if (dates.length < 2) return null

  const c0 = parseFloat(series[dates[0]]['4. close'])
  const c1 = parseFloat(series[dates[1]]['4. close'])
  const data = { rate: c0, change: ((c0 - c1) / c1) * 100 }
  setCache(cacheKey, data)
  return data
}

// ── Indices boursiers — Twelve Data (CORS natif, plan gratuit 800 req/jour) ──
// Symbols : SPX (S&P 500), CAC40 (CAC 40), BEL20 (BEL 20)
// Cle gratuite : twelvedata.com/pricing → ajouter VITE_TWELVE_DATA_KEY dans .env.local

async function fetchIndices() {
  if (!TD_KEY) return null

  const cacheKey = 'indices_twelvedata'
  const cached = getCached(cacheKey)
  if (cached) return cached

  let res
  try {
    res = await fetch(
      `https://api.twelvedata.com/quote?symbol=SPX,CAC40,BEL20&apikey=${TD_KEY}`
    )
  } catch {
    return null
  }
  if (!res.ok) return null

  try {
    const json = await res.json()
    if (json.code === 401 || json.status === 'error') return null

    const parse = (sym) => {
      const d = json[sym]
      if (!d || d.status === 'error') return null
      const price  = parseFloat(d.close)
      const change = parseFloat(d.percent_change)
      return isNaN(price) ? null : { price, change: isNaN(change) ? null : change }
    }

    const bySymbol = {
      sp500: parse('SPX'),
      cac40: parse('CAC40'),
      bel20: parse('BEL20'),
    }
    setCache(cacheKey, bySymbol)
    return bySymbol
  } catch {
    return null
  }
}

// ── Agregat marches ────────────────────────────────────────────────────────

export async function fetchMarkets() {
  const [cgRes, eurusdRes, indicesRes] = await Promise.allSettled([
    fetchCoinGecko(),
    fetchEURUSD(),
    fetchIndices(),
  ])

  const cg      = cgRes.status      === 'fulfilled' ? cgRes.value      : null
  const eurusd  = eurusdRes.status  === 'fulfilled' ? eurusdRes.value  : null
  const indices = indicesRes.status === 'fulfilled' ? indicesRes.value : null

  return {
    bitcoin:  cg?.bitcoin       ?? null,
    ethereum: cg?.ethereum      ?? null,
    gold:     cg?.['pax-gold']  ?? null,
    eurusd,
    sp500: indices?.sp500 ?? null,
    cac40: indices?.cac40 ?? null,
    bel20: indices?.bel20 ?? null,
  }
}
