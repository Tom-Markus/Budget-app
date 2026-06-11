// Vercel serverless — proxy Alpha Vantage FX_DAILY pour EUR/USD
// La clé API est dans ALPHA_VANTAGE_KEY (pas de préfixe VITE_) : jamais exposée au client.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')

  const key = process.env.ALPHA_VANTAGE_KEY
  if (!key) return res.status(500).json({ error: 'Missing API key' })

  try {
    const r = await fetch(
      `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=EUR&to_symbol=USD&outputsize=compact&apikey=${key}`
    )
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const json = await r.json()
    const series = json['Time Series FX (Daily)']
    if (!series) throw new Error('No series data')

    const dates = Object.keys(series).sort().reverse()
    if (dates.length < 2) throw new Error('Insufficient data')

    const c0 = parseFloat(series[dates[0]]['4. close'])
    const c1 = parseFloat(series[dates[1]]['4. close'])
    res.json({ rate: c0, change: ((c0 - c1) / c1) * 100 })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
}
