/**
 * src/lib/newsApi.js
 * ----------------------------------------------------------------------------
 * Fetching news (GNews) + market data (CoinGecko + Alpha Vantage).
 * Cache sessionStorage 15 min — économise le quota et évite les rate limits.
 * Toutes les fonctions retournent null sur erreur plutôt que de throw,
 * sauf fetchNewsCategory qui throw pour permettre l'affichage d'erreur par colonne.
 * ----------------------------------------------------------------------------
 */

const GNEWS_KEY = import.meta.env.VITE_GNEWS_KEY
const AV_KEY    = import.meta.env.VITE_ALPHA_VANTAGE_KEY
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

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

const NEWS_CACHE_KEYS  = ['business', 'technology', 'science', 'world'].map(c => `gnews_${c}`)
const MARKET_CACHE_KEYS = ['coingecko', 'av_EUR_USD', 'av_XAU_USD']

export function clearNewsCache() {
  ;[...NEWS_CACHE_KEYS, ...MARKET_CACHE_KEYS].forEach(k => sessionStorage.removeItem(k))
}

// ── News — GNews API ───────────────────────────────────────────────────────

/**
 * Récupère les titres d'une catégorie GNews en français.
 * @param {'business'|'technology'|'science'|'world'} category
 * @param {number} max  Nombre d'articles (max 10 sur plan gratuit)
 * @returns {Promise<Array>}
 */
export async function fetchNewsCategory(category, max = 8) {
  const cacheKey = `gnews_${category}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const url = `https://gnews.io/api/v4/top-headlines?category=${category}&lang=fr&max=${max}&apikey=${GNEWS_KEY}`
  const res = await fetch(url)

  if (res.status === 403) throw new Error('Quota GNews atteint')
  if (!res.ok) throw new Error(`GNews ${category}: ${res.status}`)

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

// ── Marchés — CoinGecko (pas de clé) ──────────────────────────────────────

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

// ── Marchés — Alpha Vantage (forex + commodités) ──────────────────────────

async function fetchAVFX(from, to) {
  const cacheKey = `av_${from}_${to}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const res = await fetch(
    `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${AV_KEY}`
  )
  if (!res.ok) return null

  const json = await res.json()
  const rate = json['Realtime Currency Exchange Rate']
  if (!rate) return null // quota dépassé ou clé invalide

  const data = { rate: parseFloat(rate['5. Exchange Rate']) }
  setCache(cacheKey, data)
  return data
}

// ── Agrégat marchés ────────────────────────────────────────────────────────

/**
 * Charge toutes les données marché en parallèle.
 * Chaque source est indépendante : une erreur n'en bloque pas une autre.
 * @returns {Promise<{ bitcoin, ethereum, eurusd, gold }>}
 */
export async function fetchMarkets() {
  const [cryptoRes, eurusdRes, xauRes] = await Promise.allSettled([
    fetchCrypto(),
    fetchAVFX('EUR', 'USD'),
    fetchAVFX('XAU', 'USD'),
  ])

  const crypto = cryptoRes.status === 'fulfilled' ? cryptoRes.value : null
  const eurusd = eurusdRes.status === 'fulfilled' ? eurusdRes.value : null
  const xau    = xauRes.status === 'fulfilled' ? xauRes.value : null

  return {
    bitcoin:  crypto?.bitcoin  ?? null,
    ethereum: crypto?.ethereum ?? null,
    eurusd:   eurusd?.rate     ?? null,
    gold:     xau?.rate        ?? null,
  }
}
