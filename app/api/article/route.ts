import { NextRequest, NextResponse } from 'next/server'
import { lookup } from 'node:dns/promises'
import { domainToASCII } from 'node:url'
import sanitizeHtml from 'sanitize-html'

// Simple article content extractor
// Attempts to extract main article content from a web page

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json() as { url: string }
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const validatedParsedUrl = validateExternalArticleUrl(url)
    const canonicalHost = getCanonicalAllowedArticleHost(validatedParsedUrl.hostname)
    await assertNoPrivateAddressTarget(canonicalHost)
    assertSafeArticlePathname(validatedParsedUrl.pathname)

    const safeFetchUrl = new URL(`https://${canonicalHost}`)
    safeFetchUrl.username = ''
    safeFetchUrl.password = ''
    safeFetchUrl.port = ''
    safeFetchUrl.pathname = validatedParsedUrl.pathname
    safeFetchUrl.search = validatedParsedUrl.search
    safeFetchUrl.hash = validatedParsedUrl.hash
    
    // Fetch the article page
    const response = await fetch(safeFetchUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FeedReader/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'error'
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.status}`)
    }
    
    const html = await response.text()
    
    // Extract article content using common patterns
    const content = extractArticleContent(html)
    
    return NextResponse.json({ 
      content,
      url: safeFetchUrl.toString(),
      fetchedAt: Date.now()
    })
  } catch (error) {
    console.error('Article fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch article', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

const ALLOWED_ARTICLE_HOSTS = [
  'example.com',
  'news.ycombinator.com',
  'medium.com'
]

function getCanonicalAllowedArticleHost(hostname: string): string {
  const asciiHostname = domainToASCII(hostname).toLowerCase()
  const isAllowed = ALLOWED_ARTICLE_HOSTS.some(
    (allowed) => asciiHostname === allowed || asciiHostname.endsWith(`.${allowed}`)
  )

  if (!isAllowed) {
    throw new Error('URL host is not allowed')
  }

  return asciiHostname
}

function validateExternalArticleUrl(input: string): URL {
  let parsed: URL

  try {
    parsed = new URL(input)
  } catch {
    throw new Error('Invalid URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP(S) URLs are allowed')
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs with credentials are not allowed')
  }

  const asciiHostname = domainToASCII(parsed.hostname).toLowerCase()
  if (!asciiHostname) {
    throw new Error('Invalid URL host')
  }

  if (!isAllowedArticleHostname(asciiHostname)) {
    throw new Error('URL host is not allowed')
  }

  if (isDisallowedHostname(asciiHostname)) {
    throw new Error('URL host is not allowed')
  }

  return parsed
}

function assertSafeArticlePathname(pathname: string): void {
  const decoded = decodeURIComponent(pathname).toLowerCase()
  if (
    decoded.includes('..') ||
    decoded.includes('%2e') ||
    decoded.includes('%2f') ||
    decoded.includes('%5c') ||
    decoded.includes('\\')
  ) {
    throw new Error('URL path is not allowed')
  }
}

async function assertNoPrivateAddressTarget(hostname: string): Promise<void> {
  const results = await lookup(hostname, { all: true })

  if (!results.length) {
    throw new Error('Unable to resolve URL host')
  }

  for (const result of results) {
    const address = result.address
    const family = result.family

    if ((family === 4 && isPrivateIpv4(address)) || (family === 6 && isPrivateIpv6(address))) {
      throw new Error('URL resolves to a disallowed network address')
    }
  }
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number.parseInt(part, 10))

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true
  }

  const [a, b] = parts

  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  )
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.trim().toLowerCase()

  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  )
}

function isAllowedArticleHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()

  if (!host) return false

  return ALLOWED_ARTICLE_HOSTS.some((allowedHost) => {
    const allowed = allowedHost.toLowerCase()
    return host === allowed || host.endsWith(`.${allowed}`)
  })
}

function isDisallowedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()

  if (!host) return true

  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '127.0.0.1' || host === '0.0.0.0') return true
  if (host === '::1') return true

  if (isPrivateIPv4(host)) return true
  if (isDisallowedIPv6(host)) return true

  return false
}

function isDisallowedIPv6(host: string): boolean {
  const normalized = normalizeIPv6Host(host)
  if (!normalized) return false

  if (normalized === '::1') return true // loopback
  if (normalized === '::') return true // unspecified
  if (normalized === '::ffff:127.0.0.1') return true // ipv4-mapped loopback

  const firstHextet = parseInt(normalized.split(':')[0] || '0', 16)

  // fc00::/7 unique local addresses
  if ((firstHextet & 0xfe00) === 0xfc00) return true

  // fe80::/10 link-local addresses
  if ((firstHextet & 0xffc0) === 0xfe80) return true

  return false
}

function normalizeIPv6Host(host: string): string | null {
  let value = host

  if (value.startsWith('[') && value.endsWith(']')) {
    value = value.slice(1, -1)
  }

  const zoneIndex = value.indexOf('%')
  if (zoneIndex !== -1) {
    value = value.slice(0, zoneIndex)
  }

  if (!value.includes(':')) return null

  return value.toLowerCase()
}

function isPrivateIPv4(hostname: string): boolean {
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!ipv4Match) return false

  const octets = ipv4Match.slice(1).map(Number)
  if (octets.some(o => Number.isNaN(o) || o < 0 || o > 255)) return false

  const [a, b] = octets

  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true

  return false
}

function extractArticleContent(html: string): string {
  // Try to find article content using common selectors/patterns
  
  // Use a vetted HTML sanitizer to avoid incomplete multi-character sanitization
  // and malformed-tag bypasses from regex-only stripping.
  let cleaned = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  })
  
  // Try to extract from common article containers
  const articlePatterns = [
    // JSON-LD structured data (best source)
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i,
    // Common article tags
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    // Common class patterns
    /<div[^>]*class="[^"]*(?:article-content|article-body|post-content|entry-content|content-body|story-body|article__body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    // ID patterns
    /<div[^>]*id="[^"]*(?:article|content|main-content|post-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ]
  
  // Try JSON-LD first for articleBody
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
  if (jsonLdMatch) {
    for (const match of jsonLdMatch) {
      try {
        let jsonContent = match
        while (true) {
          const next = jsonContent.replace(/<script[^>]*>|<\/script>/gi, '')
          if (next === jsonContent) break
          jsonContent = next
        }
        const data = JSON.parse(jsonContent)
        const articleBody = findArticleBody(data)
        if (articleBody && articleBody.length > 200) {
          return formatAsHtml(articleBody)
        }
      } catch {
        // Not valid JSON or no articleBody
      }
    }
  }
  
  // Try article patterns
  for (const pattern of articlePatterns.slice(1)) {
    const match = cleaned.match(pattern)
    if (match && match[1]) {
      const content = cleanArticleHtml(match[1])
      if (content.length > 200) {
        return content
      }
    }
  }
  
  // Fall back to extracting all paragraphs
  const paragraphs = cleaned.match(/<p[^>]*>([\s\S]*?)<\/p>/gi)
  if (paragraphs && paragraphs.length > 0) {
    // Filter out short paragraphs (likely navigation/footer)
    const goodParagraphs = paragraphs
      .map(p => escapeHtml(extractTextContent(p).trim()))
      .filter(p => p.length > 50)
    
    if (goodParagraphs.length >= 2) {
      return goodParagraphs.map(p => `<p>${p}</p>`).join('\n')
    }
  }
  
  return ''
}

function extractTextContent(fragment: string): string {
  const doc = new DOMParser().parseFromString(fragment, 'text/html')
  return doc.body.textContent || ''
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function findArticleBody(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  
  const obj = data as Record<string, unknown>
  
  // Direct articleBody
  if (typeof obj.articleBody === 'string') {
    return obj.articleBody
  }
  
  // Check @graph array (common in WordPress)
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      const body = findArticleBody(item)
      if (body) return body
    }
  }
  
  // Recursively check nested objects
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      const body = findArticleBody(value)
      if (body) return body
    }
  }
  
  return null
}

function formatAsHtml(text: string): string {
  // Split into paragraphs and wrap
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim())
  return paragraphs.map(p => `<p>${p.trim()}</p>`).join('\n')
}

function cleanArticleHtml(html: string): string {
  // Remove common non-content elements
  let cleaned = html
    // Remove social sharing buttons
    .replace(/<div[^>]*class="[^"]*(?:share|social|related|comments|sidebar|ad-|advertisement)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    // Remove nav elements
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    // Remove aside elements
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    // Remove figure captions but keep figures
    .replace(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/gi, '')
    // Clean up excessive whitespace
    .replace(/\s+/g, ' ')
    .trim()
  
  return cleaned
}
