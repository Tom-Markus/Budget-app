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
  '24h': { range: '1d',  interval: '5m'  },
  '7j':  { range: '8d',  interval: '1h'  },
  '3M':  { range: '3mo', interval: '1d'  },
  '1A':  { range: '1y',  interval: '1d'  },
  '5A':  { range: '5y',  interval: '1mo' },
}

const round2 = v => v != null ? Math.round(v * 100) / 100 : null

export default async function handler(req, res) {

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
    // Agréger les données 5min en bougies/points de 20min
    const lineBuckets = new Map()
    const ohlcBuckets = new Map()
    timestamps.forEach((ts, i) => {
      const bucket = Math.floor(ts / (20 * 60))
      const c = closes[i]
      if (c != null) lineBuckets.set(bucket, { ts, price: c })
      const o = opens[i], h = highs[i], l = lows[i]
      const fb = c ?? o ?? h ?? l
      if (fb != null) {
        if (!ohlcBuckets.has(bucket)) {
          ohlcBuckets.set(bucket, { ts, open: o ?? fb, high: h ?? fb, low: l ?? fb, close: c ?? fb })
        } else {
          const e = ohlcBuckets.get(bucket)
          if (h != null) e.high  = Math.max(e.high, h)
          if (l != null) e.low   = Math.min(e.low, l)
          if (c != null) e.close = c
        }
      }
    })
    ;[...lineBuckets.entries()].sort((a, b) => a[0] - b[0]).forEach(([, { ts, price }]) => {
      const d         = new Date(ts * 1000)
      const timeLabel = d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
      const dayLabel  = d.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
      points.push({ date: timeLabel, ts: ts * 1000, price: round2(price), fullDate: `${dayLabel} · ${timeLabel}` })
    })
    ;[...ohlcBuckets.entries()].sort((a, b) => a[0] - b[0]).forEach(([, { ts, open, high, low, close }]) => {
      const label = new Date(ts * 1000).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
      ohlcDays.push({ date: label, ts: ts * 1000, open: round2(open), high: round2(high), low: round2(low), close: round2(close) })
    })

  } else if (tf === '7j') {
    // Tous les points horaires de marché (~6-9 pts/jour selon les horaires du marché)
    const raw = []
    timestamps.forEach((ts, i) => {
      const price = closes[i]
      if (price == null) return
      const d = new Date(ts * 1000)
      raw.push({
        dayStr:   d.toDateString(),
        dayLabel: d.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric' }),
        ts:       ts * 1000,
        price:    round2(price),
        fullDate: d.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }) +
                  ' · ' + d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }),
      })
    })
    // Garder les 7 derniers jours calendaires
    const uniqueDays = [...new Set(raw.map(p => p.dayStr))]
    const last7 = new Set(uniqueDays.slice(-7))
    const sliced = raw.filter(p => last7.has(p.dayStr))
    // Label axe X sur le premier point de chaque jour uniquement
    let lastDay = ''
    sliced.forEach(p => {
      p.date = p.dayStr !== lastDay ? p.dayLabel : ''
      if (p.dayStr !== lastDay) lastDay = p.dayStr
      delete p.dayStr
      delete p.dayLabel
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

  } else if (tf === '3M') {
    // 2 pts/jour (ouverture + clôture) depuis données journalières
    const fmt     = ts => new Date(ts * 1000).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })
    const fmtFull = ts => new Date(ts * 1000).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    timestamps.forEach((ts, i) => {
      const o = opens[i], h = highs[i], l = lows[i], c = closes[i]
      const label = fmt(ts), full = fmtFull(ts)
      if (o != null)
        points.push({ date: label, ts: ts * 1000, price: round2(o), isOpen: true,  fullDate: `${full} · ouverture` })
      if (c != null)
        points.push({ date: '',    ts: ts * 1000, price: round2(c), isOpen: false, fullDate: `${full} · clôture`  })
      const fb = c ?? o ?? h ?? l
      if (fb != null) ohlcDays.push({
        date: label, ts: ts * 1000,
        open: round2(o ?? fb), high: round2(h ?? fb), low: round2(l ?? fb), close: round2(c ?? fb),
      })
    })

  } else {
    // 1A, 5A — 1 pt/jour ou 1 pt/mois
    const fmtLabel = ts => {
      const d = new Date(ts * 1000)
      if (tf === '5A') return d.toLocaleDateString('fr-BE', { month: 'short', year: '2-digit' })
      return d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })
    }
    const fmtFull = ts => {
      const d = new Date(ts * 1000)
      if (tf === '5A') return d.toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' })
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
