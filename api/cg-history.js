// Vercel serverless — proxy CoinGecko historique (market_chart + OHLC) avec cache
// Évite que les appels directs depuis le navigateur épuisent le rate-limit CoinGecko
// et cassent les compteurs de prix temps réel de la page.

const ALLOWED_COINS = new Set([
  'bitcoin', 'ethereum', 'solana', 'ripple', 'binancecoin', 'pax-gold', 'avalanche-2',
])

const TF_DAYS = { '24h': 1, '7j': 7, '3M': 90, '1A': 365, '5A': 1825 }

const CACHE_S = { '24h': 300, '7j': 3600, '3M': 86400, '1A': 86400, '5A': 86400 }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const { coinId, tf, type } = req.query

  if (!coinId || !ALLOWED_COINS.has(coinId))
    return res.status(400).json({ error: 'coinId non autorisé' })
  if (!tf || !TF_DAYS[tf])
    return res.status(400).json({ error: 'timeframe invalide' })
  if (type !== 'line' && type !== 'ohlc')
    return res.status(400).json({ error: 'type invalide' })

  const days = TF_DAYS[tf]
  const url = type === 'line'
    ? `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
    : `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`

  let r
  try {
    r = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    return res.status(502).json({ error: 'Réseau inaccessible' })
  }

  if (!r.ok) return res.status(502).json({ error: `CoinGecko ${r.status}` })

  let data
  try { data = await r.json() } catch { return res.status(502).json({ error: 'JSON invalide' }) }

  // Erreur CoinGecko dans le corps (ex : error_code 10012 = limite free tier 365 j)
  if (data.status?.error_code)
    return res.status(502).json({ error: 'CoinGecko limit', cgErrorCode: data.status.error_code })

  res.setHeader('Cache-Control', `s-maxage=${CACHE_S[tf]}, stale-while-revalidate`)
  return res.json(data)
}
