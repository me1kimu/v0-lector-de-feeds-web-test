import { NextRequest, NextResponse } from 'next/server'
import type { FeedSource, FeedItem, MediaAttachment } from '@/lib/types'

interface InstagramBridgeItem {
  title?: string
  description?: string
  link?: string
  pubDate?: string
  author?: string
  'media:content'?: {
    $?: {
      url?: string
      medium?: string
      type?: string
    }
  }
  'media:thumbnail'?: {
    $?: {
      url?: string
    }
  }
  enclosure?: {
    $?: {
      url?: string
      type?: string
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source } = body as { source: FeedSource }
    
    let handle = source?.credentials?.handle
    if (!handle && source?.url) {
      try {
        const urlObj = new URL(source.url)
        const parts = urlObj.pathname.split('/').filter(Boolean)
        if (parts.length > 0) handle = parts[0]
      } catch (e) {
        handle = source.url
      }
    }

    if (!handle) {
      return NextResponse.json(
        { error: 'Instagram username is required' },
        { status: 400 }
      )
    }
    
    const username = handle.replace('@', '')
    
    // Use the RSS Bridge endpoint provided
    const bridgeUrl = `https://wtf.roflcopter.fr/rss-bridge/?action=display&bridge=InstagramBridge&context=Username&u=${encodeURIComponent(username)}&media_type=all&direct_links=on&format=Mrss`
    
    const response = await fetch(bridgeUrl, {
      headers: {
        'User-Agent': 'FeedReader/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Instagram feed: ${response.status}`)
    }
    
    const xmlText = await response.text()
    const items = parseInstagramMrss(xmlText, source)
    
    return NextResponse.json({ items })
  } catch (error) {
    console.error('Instagram fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Instagram feed' },
      { status: 500 }
    )
  }
}

function parseInstagramMrss(xml: string, source: FeedSource): FeedItem[] {
  const items: FeedItem[] = []
  
  // Extract channel title for author info
  const channelTitleMatch = xml.match(/<title>([^<]+)<\/title>/)
  const channelTitle = channelTitleMatch ? decodeHtmlEntities(channelTitleMatch[1]) : source.credentials?.handle || 'Instagram'
  
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
    const author = extractTag(itemXml, 'author') || extractTag(itemXml, 'dc:creator')
    
    // Extract media content
    const media: MediaAttachment[] = []
    
    // Media RSS content
    const mediaContentMatches = itemXml.matchAll(/<media:content[^>]*url="([^"]+)"[^>]*(?:medium="([^"]*)")?[^>]*(?:type="([^"]*)")?[^>]*\/?>/g)
    for (const mediaMatch of mediaContentMatches) {
      const rawUrl = mediaMatch[1]
      const medium = mediaMatch[2]
      const type = mediaMatch[3]
      
      if (rawUrl) {
        const url = decodeHtmlEntities(rawUrl)
        media.push({
          type: determineMediaType(medium, type, url),
          url: url,
          previewUrl: url
        })
      }
    }
    
    // Also check enclosures
    const enclosureMatches = itemXml.matchAll(/<enclosure[^>]*url="([^"]+)"[^>]*(?:type="([^"]*)")?[^>]*\/?>/g)
    for (const encMatch of enclosureMatches) {
      const rawUrl = encMatch[1]
      const type = encMatch[2]
      
      if (rawUrl) {
        const url = decodeHtmlEntities(rawUrl)
        if (!media.some(m => m.url === url)) {
          media.push({
            type: determineMediaType(undefined, type, url),
            url: url,
            previewUrl: url
          })
        }
      }
    }
    
    // Extract images from description HTML (need to decode entities first)
    const decodedDesc = description ? decodeHtmlEntities(description) : ''
    const imgMatches = decodedDesc.matchAll(/<img[^>]*src="([^"]+)"[^>]*\/?>/gi)
    if (imgMatches) {
      for (const imgMatch of imgMatches) {
        const url = imgMatch[1]
        if (url && !media.some(m => m.url === url)) {
          media.push({
            type: 'image',
            url: decodeHtmlEntities(url),
            previewUrl: decodeHtmlEntities(url)
          })
        }
      }
    }
    
    // Clean up content - decode HTML entities first, then strip HTML tags for plain text
    const decodedDescription = description ? decodeHtmlEntities(description) : ''
    
    // Remove <img> tags since we extract media separately
    const descriptionWithoutImages = decodedDescription
      .replace(/<img[^>]*\/?>/gi, '')
      .replace(/<a[^>]*><\/a>/gi, '') // Remove empty anchor tags left after removing images
    
    // Extract plain text content (for accessibility and search)
    const cleanContent = descriptionWithoutImages
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    // Create clean HTML content without raw img tags (images come from media array)
    const cleanHtml = descriptionWithoutImages
      .replace(/<br\s*\/?>/gi, '<br />')
      .trim()
    
    const item: FeedItem = {
      id: `instagram-${source.id}-${link || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceId: source.id,
      sourceType: 'instagram',
      sourceName: source.name,
      title: title ? decodeHtmlEntities(title) : undefined,
      content: cleanContent || title || '',
      contentHtml: cleanHtml || undefined,
      author: {
        name: author || channelTitle.replace(' - Instagram', '') || source.credentials?.handle || 'Instagram User',
        handle: source.credentials?.handle,
        avatar: undefined
      },
      url: link,
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
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function determineMediaType(medium?: string, mimeType?: string, url?: string): 'image' | 'video' | 'audio' | 'gif' {
  if (medium === 'video' || mimeType?.includes('video') || url?.includes('.mp4') || url?.includes('.webm')) {
    return 'video'
  }
  if (medium === 'audio' || mimeType?.includes('audio')) {
    return 'audio'
  }
  if (url?.includes('.gif') || mimeType?.includes('gif')) {
    return 'gif'
  }
  return 'image'
}
