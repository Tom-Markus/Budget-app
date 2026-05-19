// Vercel serverless — proxy RSS multi-sources par catégorie
// Fetche tous les flux en parallèle, trie par date, renvoie les 3 plus récents.

const FEEDS = {
  business: [
    { url: 'https://feeds.bbci.co.uk/news/business/rss.xml',  source: 'BBC Business' },
    { url: 'https://www.theguardian.com/business/rss',        source: 'The Guardian' },
  ],
  technology: [
    { url: 'https://techcrunch.com/feed/',                    source: 'TechCrunch' },
    { url: 'https://www.wired.com/feed/rss',                  source: 'Wired' },
    { url: 'https://www.technologyreview.com/feed/',          source: 'MIT Tech Review' },
  ],
  science: [
    { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', source: 'BBC Science' },
    { url: 'https://www.sciencedaily.com/rss/top/science.xml',              source: 'Science Daily' },
  ],
  world: [
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',    source: 'BBC World' },
    { url: 'https://www.theguardian.com/world/rss',          source: 'The Guardian' },
  ],
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

async function parseFeed({ url, source }) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RSSReader/1.0)',
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
  })
  if (!r.ok) throw new Error(`${source}: HTTP ${r.status}`)
  const xml = await r.text()

  const items = []
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match
  while ((match = itemRe.exec(xml)) !== null && items.length < 10) {
    const chunk = match[1]
    const title = extractTag(chunk, 'title')
    const link =
      (/<link>([^<]+)<\/link>/i.exec(chunk) || [])[1]?.trim() ||
      (/<link[^>]+href="([^"]+)"/i.exec(chunk) || [])[1]?.trim()
    const pubDate = extractTag(chunk, 'pubDate')
    if (title && link) {
      items.push({
        title:       decodeEntities(title),
        url:         link,
        source,
        publishedAt: pubDate || new Date().toISOString(),
      })
    }
  }
  return items
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')

  const { category } = req.query
  const feeds = FEEDS[category]
  if (!feeds) return res.status(400).json({ error: 'Catégorie inconnue' })

  const results = await Promise.allSettled(feeds.map(parseFeed))

  const allItems = []
  results.forEach(r => { if (r.status === 'fulfilled') allItems.push(...r.value) })

  if (allItems.length === 0) return res.status(502).json({ error: 'Aucun flux disponible' })

  const items = allItems
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 3)

  res.json({ items })
}
