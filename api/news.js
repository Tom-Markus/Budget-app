// Vercel serverless — proxy RSS pour les actualités
// Fetche le flux côté serveur (pas de CORS), parse le XML, renvoie du JSON propre.
// Cache Vercel 15 min pour ne pas marteler les sources.

const FEEDS = {
  business:   'https://feeds.bbci.co.uk/news/business/rss.xml',
  technology: 'https://techcrunch.com/feed/',
  science:    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
  world:      'https://feeds.bbci.co.uk/news/world/rss.xml',
}

function extractTag(xml, tag) {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(xml)
  if (cdata) return cdata[1].trim()
  const plain = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i').exec(xml)
  return plain ? plain[1].trim() : null
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')

  const { category } = req.query
  const feedUrl = FEEDS[category]
  if (!feedUrl) return res.status(400).json({ error: 'Catégorie inconnue' })

  let xml
  try {
    const r = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSReader/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    })
    if (!r.ok) return res.status(502).json({ error: `Feed ${r.status}` })
    xml = await r.text()
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }

  // Titre du flux (premier <title> du document)
  const feedTitle = decodeEntities(extractTag(xml, 'title') || 'Source')

  // Extraction des items
  const items = []
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match
  while ((match = itemRe.exec(xml)) !== null && items.length < 3) {
    const chunk = match[1]
    const title = extractTag(chunk, 'title')
    // <link> en RSS 2.0 : contenu texte brut entre balises
    const link =
      (/<link>([^<]+)<\/link>/i.exec(chunk) || [])[1]?.trim() ||
      (/<link[^>]+href="([^"]+)"/i.exec(chunk) || [])[1]?.trim()
    const pubDate = extractTag(chunk, 'pubDate')
    if (title && link) {
      items.push({
        title:       decodeEntities(title),
        url:         link,
        publishedAt: pubDate || new Date().toISOString(),
      })
    }
  }

  res.json({ feedTitle, items })
}
