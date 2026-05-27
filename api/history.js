// Vercel serverless — historique Yahoo Finance pour indices et actions
const YF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
}

const ALLOWED = {
  '^FCHI': 'CAC 40', '^GSPC': 'S&P 500', '^BFX': 'BEL 20',
  'NVDA': 'NVIDIA', 'TSLA': 'Tesla', 'AAPL': 'Apple',
  'ORCL': 'Oracle', 'MSFT': 'Microsoft', 'META': 'Meta',
  'CL=F': 'Pétrole WTI', 'BZ=F': 'Pétrole Brent',
}

const TF_YF = {
  '24h': { range: '1d',  interval: '1h'  },
  '7j':  { range: '8d',  interval: '1h'  },
  '3M':  { range: '3mo', interval: '1d'  },
  '1A':  { range: '1y',  interval: '1wk' },
  '10A': { range: '10y', interval: '1mo' },
}

const round2 = v => v != null ? Math.round(v * 100) / 100 : null

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const { symbol, tf = '7j' } = req.query

  if (!symbol || !ALLOWED[symbol])
    return res.status(400).json({ error: 'symbole non autorisé' })
  if (!TF_YF[tf])
    return res.status(400).json({ error: 'timeframe invalide' })

  const { range, interval } = TF_YF[tf]
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${interval}&range=${range}`

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

  let points   = []
  let ohlcDays = []

  if (tf === '24h') {
    // Un point/bougie par heure
    timestamps.forEach((ts, i) => {
      const c = closes[i]
      if (c == null) return
      const d         = new Date(ts * 1000)
      const timeLabel = d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
      const dayLabel  = d.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
      points.push({ date: timeLabel, ts: ts * 1000, price: round2(c), fullDate: `${dayLabel} · ${timeLabel}` })

      const o = opens[i], h = highs[i], l = lows[i]
      const fb = c ?? o ?? h ?? l
      if (fb == null) return
      ohlcDays.push({
        date: timeLabel, ts: ts * 1000,
        open: round2(o ?? fb), high: round2(h ?? fb),
        low:  round2(l ?? fb), close: round2(fb),
      })
    })

  } else if (tf === '7j') {
    // 2 pts/jour (ouverture + clôture) pour la courbe
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
    const rawPts = []
    dayMap.forEach(({ openTs, openPrice, closeTs, closePrice }) => {
      rawPts.push({ date: '', ts: openTs * 1000, isOpen: true,  price: openPrice  })
      if (closeTs !== openTs)
        rawPts.push({ date: '', ts: closeTs * 1000, isOpen: false, price: closePrice })
    })
    const sliced = rawPts.slice(-10)
    let lastDay = ''
    sliced.forEach(p => {
      const dayStr = new Date(p.ts).toDateString()
      if (p.isOpen && dayStr !== lastDay) {
        lastDay = dayStr
        p.date = new Date(p.ts).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric' })
      }
      p.fullDate = new Date(p.ts).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }) +
        (p.isOpen ? ' · ouverture' : ' · clôture')
    })
    points = sliced

    // OHLC journalier pour 7j (agrégation des bougies horaires)
    const ohlcMap = new Map()
    timestamps.forEach((ts, i) => {
      const o = opens[i], h = highs[i], l = lows[i], c = closes[i]
      if (o == null && h == null && l == null && c == null) return
      const dateKey = new Date(ts * 1000).toDateString()
      if (!ohlcMap.has(dateKey)) {
        const fb = c ?? o ?? h ?? l
        ohlcMap.set(dateKey, { ts, open: o ?? fb, high: h ?? fb, low: l ?? fb, close: c ?? fb })
      } else {
        const d = ohlcMap.get(dateKey)
        if (h != null) d.high  = Math.max(d.high, h)
        if (l != null) d.low   = Math.min(d.low, l)
        if (c != null) d.close = c
      }
    })
    ohlcMap.forEach(({ ts, open, high, low, close }) => {
      ohlcDays.push({
        date:  new Date(ts * 1000).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric' }),
        ts:    ts * 1000,
        open:  round2(open), high: round2(high), low: round2(low), close: round2(close),
      })
    })
    ohlcDays = ohlcDays.slice(-7)

  } else {
    // 3M, 1A, 10A — intervalle déjà correct (quotidien/hebdo/mensuel)
    const fmtLabel = ts => {
      const d = new Date(ts * 1000)
      if (tf === '10A') return d.toLocaleDateString('fr-BE', { month: 'short', year: '2-digit' })
      return d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })
    }
    const fmtFull = ts => {
      const d = new Date(ts * 1000)
      if (tf === '10A') return d.toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' })
      return d.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
    timestamps.forEach((ts, i) => {
      const c = closes[i]
      if (c != null)
        points.push({ date: fmtLabel(ts), ts: ts * 1000, price: round2(c), fullDate: fmtFull(ts) })

      const o = opens[i], h = highs[i], l = lows[i]
      const fb = c ?? o ?? h ?? l
      if (fb == null) return
      ohlcDays.push({
        date:  fmtLabel(ts), ts: ts * 1000,
        open:  round2(o ?? fb), high: round2(h ?? fb),
        low:   round2(l ?? fb), close: round2(c ?? fb),
      })
    })
  }

  const cache = tf === '24h' ? 300 : tf === '7j' ? 3600 : 86400
  res.setHeader('Cache-Control', `s-maxage=${cache}, stale-while-revalidate`)
  return res.json({ points, ohlcDays })
}
