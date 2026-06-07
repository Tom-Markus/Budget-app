// Vercel serverless — proxy RSS multi-sources par catégorie
// Fetche tous les flux en parallèle, trie par date, renvoie les N plus récents.

const FEEDS = {
  business: [
    { url: 'https://feeds.bbci.co.uk/news/business/rss.xml',  source: 'BBC Business' },
    { url: 'https://www.theguardian.com/business/rss',        source: 'The Guardian' },
  ],
  technology: [
    { url: 'https://techcrunch.com/feed/',                    source: 'TechCrunch'     },
    { url: 'https://www.wired.com/feed/rss',                  source: 'Wired'          },
    { url: 'https://www.technologyreview.com/feed/',          source: 'MIT Tech Review' },
  ],
  ai: [
    { url: 'https://venturebeat.com/category/ai/feed/',                           source: 'VentureBeat AI'   },
    { url: 'https://the-decoder.com/feed/',                                       source: 'The Decoder'      },
    { url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', source: 'MIT Tech Review'  },
    { url: 'https://openai.com/news/rss.xml',                                     source: 'OpenAI'           },
    { url: 'https://blog.google/technology/ai/rss/',                              source: 'Google AI'        },
    { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',            source: 'Ars Technica'     },
  ],
  science: [
    { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', source: 'BBC Science'   },
    { url: 'https://www.sciencedaily.com/rss/top/science.xml',              source: 'Science Daily' },
  ],
  world: [
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',    source: 'BBC World'    },
    { url: 'https://www.theguardian.com/world/rss',          source: 'The Guardian' },
  ],
}

// Nombre d'articles à retourner par catégorie (défaut : 3)
const LIMITS = {
  ai: 5,
}

function extractTag(xml, tag) {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(xml)
  if (cdata) return cdata[1].trim()
  const plain = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i').exec(xml)
  return plain ? plain[1].trim() : null
}

// Précompilé au chargement du module — word boundary pour les termes ambigus
// \bwar\b évite "star wars" ; \bbanned\b évite "unbanned" ; etc.
const MAJOR_WORD_RE = /\b(war|crisis|collapse|recession|emergency|banned|leaked|hacked)\b/i

function scoreImportance(title, source, isAICategory = false) {
  // Strip possessives ('s) avant matching — évite que "Apple's" rate le match ' apple '
  const t = ' ' + title.toLowerCase().replace(/'s\b/g, '') + ' '

  const entities = [
    // Labs IA & modèles
    'openai', 'anthropic', ' deepmind', 'mistral', ' xai ', 'meta ai',
    'chatgpt', ' claude ', ' gemini', 'gpt-', 'deepseek',
    'hugging face', 'perplexity', 'midjourney', 'stability ai',
    // Big tech & hardware IA
    'nvidia', 'microsoft', ' apple ', 'samsung', 'tesla', ' google ', 'spacex',
    ' amazon ', ' meta ', ' amd ',
    // Marchés financiers
    'bitcoin', 'ethereum', 'stock market', 'interest rate',
    // Figures clés & institutions
    'elon musk', 'sam altman', 'trump',
    'federal reserve', ' the fed ', ' ecb ', 'european central bank', 'bank of england', 'european union',
    // Géopolitique & holdings
    ' nato ', 'alphabet',
  ]

  // Actions fortes : événement concret et immédiat (lancement effectif, sanction, acquisition…)
  const strongActions = [
    'releases ', 'released ', 'releasing ',
    'launches ', 'launched ', ' launch ',
    'unveils ', 'unveiled ',
    'introduces ', 'introduced ', 'introducing ',
    'open-sources ', 'open-weight', 'open weight',
    ' drops ', 'debuts ', 'crashes ',
    'acquired ', 'acquires ',
    'overtakes ', 'outperforms ', 'beats ',
    'raises ', 'raised ',
    'sues ', 'sued ',
    'bans ',
    ' fires ', ' fired ', ' cuts ',
    'recalls ', 'merges ',
    'surpasses ',
    ' fined ',
    'shuts down', 'shut down',
  ]

  // Actions douces : annonce ou révélation (peut être futur ou spéculatif)
  const softActions = [
    'announces ', 'announced ', 'announcing ',
    'reveals ', 'revealed ',
    'partners with',
  ]

  // Phrases non-ambiguës : substring suffit
  const majorPhrases = [
    'acquisition', 'merger', 'ipo',
    'bankrupt', 'layoff',
    ' agi ', 'superintelligence',
    'regulation', 'executive order', 'antitrust',
    ' billion', ' trillion',
    'ceasefire', 'sanctions',
    'data breach', 'market crash', 'crypto crash',
  ]

  // $1.75tn / $10bn / €2bn / £5tn — montants financiers abrégés
  const hasFinancialScale = /[$€£][\d.,]+\s*[bt]n\b/i.test(title)
  const hasMajorPhrase    = majorPhrases.some(p => t.includes(p))
  const hasMajorWord      = MAJOR_WORD_RE.test(title)
  const hasMajor          = hasMajorPhrase || hasMajorWord || hasFinancialScale

  const hasEntity  = entities.some(e => t.includes(e))
  const hasStrong  = strongActions.some(a => t.includes(a))
  const hasSoft    = softActions.some(a => t.includes(a))

  const isPrimary = ['OpenAI', 'Google AI'].includes(source)
  // Sources 100% IA : entité OU action forte suffit — seulement dans le contexte catégorie IA
  const isAISrc   = isAICategory && ['VentureBeat AI', 'The Decoder', 'OpenAI', 'Google AI', 'MIT Tech Review'].includes(source)

  // critical  = événement fort confirmé OU majeur + entité OU source primaire qui publie quoi que ce soit
  if ((hasEntity && hasStrong) || (hasMajor && hasEntity) || (isPrimary && (hasStrong || hasSoft))) return 'critical'
  // high      = entité + annonce douce OU signal majeur seul OU source IA spécialisée + entité/action forte
  if ((hasEntity && hasSoft) || hasMajor || (isAISrc && (hasEntity || hasStrong))) return 'high'
  return null
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

async function parseFeed({ url, source }, isAICategory = false) {
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
      const cleanTitle = decodeEntities(title)
      items.push({
        title:       cleanTitle,
        url:         link,
        source,
        publishedAt: pubDate || new Date().toISOString(),
        importance:  scoreImportance(cleanTitle, source, isAICategory),
      })
    }
  }
  return items
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=900')

  const { category } = req.query
  const feeds = FEEDS[category]
  if (!feeds) return res.status(400).json({ error: 'Catégorie inconnue' })

  const isAICategory = category === 'ai'
  const results = await Promise.allSettled(feeds.map(f => parseFeed(f, isAICategory)))

  const allItems = []
  results.forEach(r => { if (r.status === 'fulfilled') allItems.push(...r.value) })

  if (allItems.length === 0) return res.status(502).json({ error: 'Aucun flux disponible' })

  const limit = LIMITS[category] ?? 3
  const items = allItems
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, limit)

  res.json({ items })
}
