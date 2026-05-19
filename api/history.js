// Vercel serverless — historique Yahoo Finance pour indices et actions
// Renvoie 2 points par jour de bourse : ouverture (premier prix) + clôture (dernier prix).
const YF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
}

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

  // interval=1h pour avoir ouverture + clôture par jour de bourse
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1h&range=8d`

  let r
  try {
    r = await fetch(url, { headers: YF_HEADERS })
  } catch {
    return res.status(502).json({ error: 'Réseau inaccessible' })
  }

  if (!r.ok) return res.status(502).json({ error: `Yahoo ${r.status}` })

  let data
  try { data = await r.json() } catch { return res.status(502).json({ error: 'JSON invalide' }) }

  const result = data?.chart?.result?.[0]
  if (!result) return res.status(502).json({ error: 'format inattendu' })

  const timestamps = result.timestamp || []
  const quote      = result.indicators?.quote?.[0] || {}
  const opens      = quote.open  || []
  const highs      = quote.high  || []
  const lows       = quote.low   || []
  const closes     = quote.close || []

  // Grouper par date calendaire, garder premier (ouverture) + dernier (clôture)
  const dayMap = new Map()
  timestamps.forEach((ts, i) => {
    const price = closes[i]
    if (price == null) return
    const dateKey = new Date(ts * 1000).toDateString()
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, { openTs: ts, openPrice: price, closeTs: ts, closePrice: price })
    } else {
      const d = dayMap.get(dateKey)
      d.closeTs    = ts
      d.closePrice = price
    }
  })

  const points = []
  dayMap.forEach(({ openTs, openPrice, closeTs, closePrice }) => {
    // Point ouverture — affiche le nom du jour sur l'axe X
    points.push({ date: '', ts: openTs * 1000, isOpen: true,  price: openPrice  })
    // Point clôture — label vide sur l'axe X (même jour)
    if (closeTs !== openTs) {
      points.push({ date: '', ts: closeTs * 1000, isOpen: false, price: closePrice })
    }
  })

  // 5 derniers jours × 2 points = 10 points max
  const sliced = points.slice(-10)

  // Attribuer les labels de l'axe X : seulement sur le point d'ouverture de chaque jour
  let lastDay = ''
  sliced.forEach(p => {
    const dayStr = new Date(p.ts).toDateString()
    if (p.isOpen && dayStr !== lastDay) {
      lastDay = dayStr
      p.date = new Date(p.ts).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric' })
    }
  })

  // Agréger les données horaires en OHLC journalier pour le graphe en bougies
  const ohlcMap = new Map()
  timestamps.forEach((ts, i) => {
    const o = opens[i], h = highs[i], l = lows[i], c = closes[i]
    if (o == null && h == null && l == null && c == null) return
    const dateKey = new Date(ts * 1000).toDateString()
    if (!ohlcMap.has(dateKey)) {
      const fallback = c ?? o ?? h ?? l
      ohlcMap.set(dateKey, { ts, open: o ?? fallback, high: h ?? fallback, low: l ?? fallback, close: c ?? fallback })
    } else {
      const d = ohlcMap.get(dateKey)
      if (h != null) d.high  = Math.max(d.high, h)
      if (l != null) d.low   = Math.min(d.low, l)
      if (c != null) d.close = c
    }
  })

  const round2 = v => Math.round(v * 100) / 100
  const ohlcDays = []
  ohlcMap.forEach(({ ts, open, high, low, close }) => {
    ohlcDays.push({
      date:  new Date(ts * 1000).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric' }),
      ts:    ts * 1000,
      open:  round2(open),
      high:  round2(high),
      low:   round2(low),
      close: round2(close),
    })
  })

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  return res.json({ points: sliced, ohlcDays: ohlcDays.slice(-7) })
}
