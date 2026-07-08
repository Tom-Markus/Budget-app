// Vercel serverless — proxy Frankfurter (Bundesbank) pour les taux EUR
// Frankfurter bloque les requêtes CORS depuis le navigateur.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200')

  try {
    const r = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,GBP,CHF')
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    res.json(data)
  } catch (e) {
    // Message générique côté client — le détail reste dans les logs Vercel
    console.error('fx:', e)
    res.status(502).json({ error: 'Source de données indisponible' })
  }
}
