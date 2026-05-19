// Vercel serverless — historique 7 jours Yahoo Finance pour indices boursiers
// Utilisé par GrapheModal quand item.indexSymbol est défini.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const { symbol } = req.query
  const ALLOWED = {
    '^FCHI': 'CAC 40', '^GSPC': 'S&P 500', '^BFX': 'BEL 20',
    'NVDA': 'NVIDIA', 'TSLA': 'Tesla', 'AAPL': 'Apple',
    'ORCL': 'Oracle', 'MSFT': 'Microsoft', 'META': 'Meta',
  }
  if (!symbol || !ALLOWED[symbol]) {
    return res.status(400).json({ error: 'symbole non autorisé' })
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&range=10d`

  let r
  try {
    r = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
  } catch (e) {
    return res.status(502).json({ error: 'Réseau inaccessible' })
  }

  if (!r.ok) return res.status(502).json({ error: `Yahoo ${r.status}` })

  let data
  try { data = await r.json() } catch { return res.status(502).json({ error: 'JSON invalide' }) }

  const result = data?.chart?.result?.[0]
  if (!result) return res.status(502).json({ error: 'format inattendu' })

  const timestamps = result.timestamp || []
  const closes    = result.indicators?.quote?.[0]?.close || []

  const points = timestamps
    .map((ts, i) => ({
      date:  new Date(ts * 1000).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric' }),
      price: closes[i] ?? null,
    }))
    .filter(p => p.price != null)
    .slice(-7) // 7 derniers jours de bourse

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  return res.json({ points })
}
