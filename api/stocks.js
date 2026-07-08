// Vercel serverless — prix temps réel actions via Yahoo Finance
// NVDA, TSLA, AAPL, ORCL, MSFT, META
const YF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
}

const TICKERS = { nvda: 'NVDA', tsla: 'TSLA', aapl: 'AAPL', orcl: 'ORCL', msft: 'MSFT', meta: 'META' }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')

  const fetches = Object.entries(TICKERS).map(async ([key, ticker]) => {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}` +
      `?interval=1d&range=2d`
    const r = await fetch(url, { headers: YF_HEADERS })
    if (!r.ok) throw new Error(`${ticker}: HTTP ${r.status}`)
    const data = await r.json()
    const meta = data.chart?.result?.[0]?.meta
    if (!meta) throw new Error(`${ticker}: no meta`)
    const price  = meta.regularMarketPrice
    const prev   = meta.previousClose ?? meta.chartPreviousClose
    const change = prev != null && prev > 0 ? ((price - prev) / prev) * 100 : null
    return [key, { price, change }]
  })

  const results = await Promise.allSettled(fetches)
  const out = {}
  Object.keys(TICKERS).forEach((key, i) => {
    out[key] = results[i].status === 'fulfilled' ? results[i].value[1] : null
  })

  res.json(out)
}
