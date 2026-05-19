// Vercel serverless function — proxy Stooq pour éviter les restrictions CORS
// Appelée par le front via /api/market-indices (même domaine, pas de CORS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')

  try {
    const r = await fetch(
      'https://stooq.com/q/l/?s=^spx,^cac,^bel20&f=sd2t2ohlcv&e=json',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!r.ok) return res.status(502).json({ error: 'upstream error', status: r.status })
    const data = await r.json()
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
