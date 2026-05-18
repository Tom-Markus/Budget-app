/**
 * src/lib/newsApi.js
 * ----------------------------------------------------------------------------
 * Fetching news (GNews) + market data (CoinGecko + Alpha Vantage).
 * Cache sessionStorage 15 min.
 *
 * Alpha Vantage notes :
 *   - XAU non supporté en CURRENCY_EXCHANGE_RATE sur plan gratuit → on utilise GLD ETF
 *   - EUR/USD : FX_DAILY pour avoir la variation 24h
 *   - Appels AV séquentiels (évite le rate limit 5 req/min)
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
  ['business', 'technology', 'science', 'world'].forEach(c =>
    sessionStorage.removeItem(`gnews_${c}`)
  )
  ;['coingecko', 'av_eurusd_daily', 'av_gold_gld'].forEach(k =>
    sessionStorage.removeItem(k)
  )
}

// ── News — GNews API ───────────────────────────────────────────────────────

export async function fetchNewsCategory(category, max = 8) {
  const cacheKey = `gnews_${category}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const url = `https://gnews.io/api/v4/top-headlines?category=${category}&country=fr&max=${max}&apikey=${GNEWS_KEY}`
  let res
  try {
    res = await fetch(url)
  } catch (e) {
    throw new Error('Réseau inaccessible (CORS ou hors ligne)')
  }

  if (res.status === 401) throw new Error('Clé API invalide (401)')
  if (res.status === 403) throw new Error('Quota GNews atteint (403)')
  if (!res.ok) throw new Error(`Erreur GNews ${res.status}`)

  const json = await res.json()
  if (json.errors?.length)   throw new Error(json.errors[0])
  if (json.status === 'error') throw new Error(json.message || 'Erreur GNews')

  const articles = (json.articles || []).map(a => ({
    title:       a.title,
    url:         a.url,
    source:      a.source?.name || 'Source',
    publishedAt: a.publishedAt,
  }))

  setCache(cacheKey, articles)
  return articles
}

// ── Marchés — CoinGecko ────────────────────────────────────────────────────

async function fetchCrypto() {
  const cacheKey = 'coingecko'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur&include_24hr_change=true'
  )
  if (!res.ok) return null

  const data = await res.json()
  setCache(cacheKey, data)
  return data
}

// ── Marchés — Alpha Vantage EUR/USD (FX_DAILY → variation 24h) ────────────

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

// ── Marchés — Alpha Vantage Or via ETF GLD (GLOBAL_QUOTE) ─────────────────
// XAU n'est pas supporté en CURRENCY_EXCHANGE_RATE sur plan gratuit.
// GLD (SPDR Gold Trust) ≈ 1/10 d'once d'or → price * 10 ≈ prix spot XAU/USD.

async function fetchGold() {
  const cacheKey = 'av_gold_gld'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const res = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=GLD&apikey=${AV_KEY}`
  )
  if (!res.ok) return null

  const json = await res.json()
  const q = json['Global Quote']
  if (!q || !q['05. price']) return null

  const data = {
    price:  parseFloat(q['05. price']) * 10, // approximation prix spot $/oz
    change: parseFloat((q['10. change percent'] || '0%').replace('%', '')),
  }
  setCache(cacheKey, data)
  return data
}

// ── Agrégat marchés ────────────────────────────────────────────────────────

export async function fetchMarkets() {
  // CoinGecko en parallèle, AV en séquentiel (rate limit 5 req/min)
  const [cryptoRes] = await Promise.allSettled([fetchCrypto()])
  const eurusd = await fetchEURUSD()
  const gold   = await fetchGold()

  const crypto = cryptoRes.status === 'fulfilled' ? cryptoRes.value : null

  return {
    bitcoin:  crypto?.bitcoin  ?? null,
    ethereum: crypto?.ethereum ?? null,
    eurusd,
    gold,
  }
}
