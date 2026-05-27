// Vercel serverless — proxy CoinGecko simple/price avec cache 60 s
// Élimine les appels directs navigateur → CoinGecko pour éviter le rate-limit partagé

const COINS = 'bitcoin,ethereum,solana,ripple,binancecoin,pax-gold,avalanche-2,dogecoin'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')

  let r
  try {
    r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${COINS}&vs_currencies=eur,usd&include_24hr_change=true`,
      { headers: { Accept: 'application/json' } }
    )
  } catch {
    return res.status(502).json({ error: 'Réseau inaccessible' })
  }

  if (!r.ok) return res.status(502).json({ error: `CoinGecko ${r.status}` })

  let data
  try { data = await r.json() } catch { return res.status(502).json({ error: 'JSON invalide' }) }

  return res.json(data)
}
