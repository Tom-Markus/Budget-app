/**
 * src/lib/newsApi.js
 * ----------------------------------------------------------------------------
 * Sources :
 *   News    : GNews /search (plan gratuit, activation email requise)
 *   Crypto  : CoinGecko — BTC, ETH, Or via PAXG (pas de cle)
 *   Indices : Stooq via /api/market-indices (Vercel proxy, pas de CORS)
 *   Forex   : Alpha Vantage FX_DAILY — EUR/USD avec variation 24h
 * ----------------------------------------------------------------------------
 */

const GNEWS_KEY = import.meta.env.VITE_GNEWS_KEY
const AV_KEY    = import.meta.env.VITE_ALPHA_VANTAGE_KEY
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
  ;['coingecko_markets', 'av_eurusd_daily', 'indices_stooq', 'indices_twelvedata', 'indices_yahoo'].forEach(k =>
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

// ── Indices boursiers — Stooq via Vercel serverless proxy ─────────────────
// Le proxy /api/market-indices fetch Stooq cote serveur (pas de CORS).
// Symbols Stooq : ^spx (S&P 500), ^cac (CAC 40), ^bel20 (BEL 20)
// Valeurs : open + close → variation intraday calculée localement.

async function fetchIndices() {
  const cacheKey = 'indices_stooq'
  const cached = getCached(cacheKey)
  if (cached) return cached

  let res
  try {
    res = await fetch('/api/market-indices')
  } catch {
    return null
  }
  if (!res.ok) return null

  try {
    const json = await res.json()
    if (json.error) return null

    const parse = (symbol) => {
      const s = (json.symbols || []).find(x => x.symbol === symbol)
      if (!s || s.close == null) return null
      const price  = s.close
      const change = s.open > 0 ? ((s.close - s.open) / s.open) * 100 : null
      return { price, change }
    }

    const bySymbol = {
      sp500: parse('^SPX'),
      cac40: parse('^CAC'),
      bel20: parse('^BEL20'),
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
