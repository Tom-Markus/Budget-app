/**
 * src/lib/newsApi.js
 * ----------------------------------------------------------------------------
 * Sources :
 *   News    : RSS via rss2json.com (sans clé, 10k req/jour)
 *   Crypto  : CoinGecko — BTC, ETH, Or via PAXG (sans clé)
 *   Indices : Yahoo Finance via /api/markets (Vercel proxy, pas de CORS)
 *   Forex   : Alpha Vantage FX_DAILY via /api/fx-eurusd (Vercel proxy, clé côté serveur)
 * ----------------------------------------------------------------------------
 */

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
  ;['business', 'technology', 'science', 'world', 'ai'].forEach(c => {
    sessionStorage.removeItem(`rss_${c}`)
  })
  ;['coingecko_markets', 'av_eurusd_daily', 'indices_stooq', 'indices_twelvedata', 'indices_yahoo', 'stocks_yahoo'].forEach(k =>
    sessionStorage.removeItem(k)
  )
}

// ── News — RSS via proxy Vercel /api/news ──────────────────────────────────
// Le proxy fetch les flux BBC/TechCrunch côté serveur (pas de CORS),
// parse le XML et renvoie du JSON. Même domaine → zéro restriction navigateur.

export async function fetchNewsCategory(category) {
  const cacheKey = `rss_${category}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  let res
  try {
    res = await fetch(`/api/news?category=${encodeURIComponent(category)}`)
  } catch {
    throw new Error('Réseau inaccessible')
  }
  if (!res.ok) throw new Error(`Erreur flux ${res.status}`)

  const json = await res.json()
  if (json.error) throw new Error(json.error)

  const articles = (json.items || []).map(a => ({
    title:       a.title,
    url:         a.url,
    source:      a.source || 'Source',
    publishedAt: a.publishedAt,
    importance:  a.importance ?? null,
  }))

  setCache(cacheKey, articles)
  return articles
}

// ── Crypto + Or — CoinGecko ────────────────────────────────────────────────

async function fetchCoinGecko() {
  const cacheKey = 'coingecko_markets'
  const cached = getCached(cacheKey)
  if (cached) return cached

  let res
  try {
    res = await fetch('/api/cg-prices')
  } catch {
    return null
  }
  if (!res.ok) return null

  let data
  try { data = await res.json() } catch { return null }
  if (!data || data.error) return null

  setCache(cacheKey, data)
  return data
}

// ── Forex — Alpha Vantage via proxy Vercel /api/fx-eurusd ─────────────────

async function fetchEURUSD() {
  const cacheKey = 'av_eurusd_daily'
  const cached = getCached(cacheKey)
  if (cached) return cached

  let res
  try {
    res = await fetch('/api/fx-eurusd')
  } catch {
    return null
  }
  if (!res.ok) return null

  try {
    const data = await res.json()
    if (!data || data.error) return null
    setCache(cacheKey, data)
    return data
  } catch {
    return null
  }
}

// ── Indices boursiers — Yahoo Finance via Vercel proxy ────────────────────
// /api/markets renvoie { cac40, sp500, bel20 } chacun avec { price, change }

async function fetchIndices() {
  const cacheKey = 'indices_yahoo'
  const cached = getCached(cacheKey)
  if (cached) return cached

  let res
  try {
    res = await fetch('/api/markets')
  } catch {
    return null
  }
  if (!res.ok) return null

  try {
    const data = await res.json()
    if (!data || data.error) return null
    setCache(cacheKey, data)
    return data
  } catch {
    return null
  }
}

// ── Actions — Yahoo Finance via /api/stocks ───────────────────────────────

export async function fetchStocks() {
  const cacheKey = 'stocks_yahoo'
  const cached = getCached(cacheKey)
  if (cached) return cached
  let res
  try {
    res = await fetch('/api/stocks')
  } catch {
    return null
  }
  if (!res.ok) return null
  try {
    const data = await res.json()
    if (!data || data.error) return null
    setCache(cacheKey, data)
    return data
  } catch {
    return null
  }
}

// ── Agrégat marchés ────────────────────────────────────────────────────────

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
    bitcoin:     cg?.bitcoin          ?? null,
    ethereum:    cg?.ethereum         ?? null,
    solana:      cg?.solana           ?? null,
    ripple:      cg?.ripple           ?? null,
    binancecoin: cg?.binancecoin      ?? null,
    avalanche:   cg?.['avalanche-2']  ?? null,
    dogecoin:    cg?.dogecoin         ?? null,
    gold:        cg?.['pax-gold']     ?? null,
    eurusd,
    sp500: indices?.sp500 ?? null,
    cac40: indices?.cac40 ?? null,
    bel20: indices?.bel20 ?? null,
    oil:   indices?.oil   ?? null,
    brent: indices?.brent ?? null,
  }
}
