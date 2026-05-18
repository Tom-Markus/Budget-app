/**
 * src/lib/newsApi.js
 * ----------------------------------------------------------------------------
 * Fetching news (GNews) + market data (CoinGecko + Alpha Vantage).
 * Cache sessionStorage 15 min.
 *
 * Sources marches :
 *   - BTC, ETH, Or  : CoinGecko (pas de cle, CORS-friendly)
 *                     Or = PAXG (PAX Gold, stablecoin 1:1 avec l'once d'or)
 *   - EUR/USD       : Alpha Vantage FX_DAILY (variation 24h incluse)
 *
 * GNews : sans country= ni lang= (non supportes sur plan gratuit).
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
  ;['coingecko_markets', 'av_eurusd_daily'].forEach(k =>
    sessionStorage.removeItem(k)
  )
}

// ── News — GNews API ───────────────────────────────────────────────────────
// Pas de country= ni lang= : parametres non supportes sur plan gratuit (-> 400)

export async function fetchNewsCategory(category, max = 8) {
  const cacheKey = `gnews_${category}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const url = `https://gnews.io/api/v4/top-headlines?category=${category}&max=${max}&apikey=${GNEWS_KEY}`
  let res
  try {
    res = await fetch(url)
  } catch {
    throw new Error('Reseau inaccessible (CORS ou hors ligne)')
  }

  if (res.status === 401) throw new Error('Cle GNews invalide (401)')
  if (res.status === 403) throw new Error('Quota GNews atteint (403)')
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

// ── Marches — CoinGecko (BTC + ETH + Or via PAXG) ─────────────────────────
// PAXG (PAX Gold) = stablecoin adosse 1:1 a l'once d'or physique.
// Prix PAXG en USD = prix spot Or/USD.

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

// ── Marches — Alpha Vantage EUR/USD (FX_DAILY → variation 24h) ────────────

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

  const close0 = parseFloat(series[dates[0]]['4. close'])
  const close1 = parseFloat(series[dates[1]]['4. close'])
  const data = {
    rate:   close0,
    change: ((close0 - close1) / close1) * 100,
  }
  setCache(cacheKey, data)
  return data
}

// ── Agregat marches ────────────────────────────────────────────────────────

export async function fetchMarkets() {
  const [cgRes, eurusdRes] = await Promise.allSettled([
    fetchCoinGecko(),
    fetchEURUSD(),
  ])

  const cg     = cgRes.status === 'fulfilled' ? cgRes.value : null
  const eurusd = eurusdRes.status === 'fulfilled' ? eurusdRes.value : null

  return {
    bitcoin:  cg?.bitcoin   ?? null,   // { eur, eur_24h_change }
    ethereum: cg?.ethereum  ?? null,   // { eur, eur_24h_change }
    gold:     cg?.['pax-gold'] ?? null, // { usd, usd_24h_change }
    eurusd,                            // { rate, change }
  }
}
