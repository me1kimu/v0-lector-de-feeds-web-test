import { NextRequest, NextResponse } from 'next/server'
import type { FeedSource, FeedItem, MediaAttachment } from '@/lib/types'

// Twitter/X doesn't have a public RSS feed anymore, so we use Nitter instances
// which provide RSS feeds for public profiles
const NITTER_INSTANCES = [
  'nitter.privacydev.net',
  'nitter.poast.org', 
  'nitter.woodland.cafe',
  'nitter.1d4.us'
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source } = body as { source: FeedSource }
    
    if (!source?.credentials?.handle) {
      return NextResponse.json(
        { error: 'Twitter username is required' },
        { status: 400 }
      )
    }
    
    const username = source.credentials.handle.replace('@', '')
    
    // Try different Nitter instances until one works
    let xmlText: string | null = null
    let lastError: Error | null = null
    
    for (const instance of NITTER_INSTANCES) {
      try {
        const nitterUrl = `https://${instance}/${username}/rss`
        
        const response = await fetch(nitterUrl, {
          headers: {
            'User-Agent': 'FeedReader/1.0',
            'Accept': 'application/rss+xml, application/xml, text/xml'
          },
          signal: AbortSignal.timeout(10000) // 10 second timeout per instance
        })
        
        if (response.ok) {
          xmlText = await response.text()
          break
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        continue
      }
    }
    
    if (!xmlText) {
      throw lastError || new Error('All Nitter instances failed')
    }
    
    const items = parseTwitterRss(xmlText, source)
    
    return NextResponse.json({ items })
  } catch (error) {
    console.error('Twitter fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Twitter feed' },
      { status: 500 }
    )
  }
}

function parseTwitterRss(xml: string, source: FeedSource): FeedItem[] {
  const items: FeedItem[] = []
  
  // Extract channel info
  const channelTitleMatch = xml.match(/<title>([^<]+)<\/title>/)
  const channelTitle = channelTitleMatch ? decodeHtmlEntities(channelTitleMatch[1]) : source.credentials?.handle || 'Twitter'
  
  // Extract avatar from channel image
  const avatarMatch = xml.match(/<url>([^<]*profile_images[^<]*)<\/url>/i)
  const avatar = avatarMatch ? avatarMatch[1] : undefined
  
  // Extract individual items
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1]
    
    // Extract fields
    const title = extractTag(itemXml, 'title')
    const description = extractTag(itemXml, 'description')
    const link = extractTag(itemXml, 'link')
    const pubDate = extractTag(itemXml, 'pubDate')
    const creator = extractTag(itemXml, 'dc:creator')
    
    // Parse content - Nitter wraps tweet content
    const content = description || title || ''
    
    // Extract media from description HTML
    const media: MediaAttachment[] = []
    
    // Extract images
    const imgMatches = content.matchAll(/<img[^>]*src="([^"]+)"[^>]*\/?>/g)
    for (const imgMatch of imgMatches) {
      const url = imgMatch[1]
      if (url && !url.includes('profile_images')) {
        media.push({
          type: url.includes('.gif') ? 'gif' : 'image',
          url: url,
          previewUrl: url
        })
      }
    }
    
    // Extract videos
    const videoMatches = content.matchAll(/<video[^>]*src="([^"]+)"[^>]*>/g)
    for (const videoMatch of videoMatches) {
      media.push({
        type: 'video',
        url: videoMatch[1],
        previewUrl: videoMatch[1]
      })
    }
    
    // Clean up content - strip HTML
    const cleanContent = decodeHtmlEntities(
      content
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    
    // Convert Nitter link back to Twitter
    const twitterLink = link?.replace(/nitter\.[^/]+/, 'twitter.com')
    
    const item: FeedItem = {
      id: `twitter-${source.id}-${link || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceId: source.id,
      sourceType: 'twitter',
      sourceName: source.name,
      content: cleanContent,
      contentHtml: description,
      author: {
        name: creator || channelTitle.split('/')[0]?.trim() || source.credentials?.handle || 'Twitter User',
        handle: source.credentials?.handle,
        avatar: avatar
      },
      url: twitterLink || link,
      publishedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
      media: media.length > 0 ? media : undefined
    }
    
    items.push(item)
  }
  
  return items
}

function extractTag(xml: string, tag: string): string | undefined {
  // Try CDATA first
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'))
  if (cdataMatch) return cdataMatch[1]
  
  // Then regular content
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return match ? match[1] : undefined
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}
