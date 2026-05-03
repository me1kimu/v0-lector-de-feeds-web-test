import { NextRequest, NextResponse } from 'next/server'
import Parser from 'rss-parser'
import type { FeedItem, FeedSource, MediaAttachment } from '@/lib/types'

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'dcCreator'],
    ]
  }
})

export async function POST(request: NextRequest) {
  try {
    const { source } = await request.json() as { source: FeedSource }
    
    if (!source.url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }
    
    const feed = await parser.parseURL(source.url)
    
    const items: FeedItem[] = feed.items.map((item) => {
      const media: MediaAttachment[] = []
      
      // Extract media from various RSS formats
      const itemRecord = item as Record<string, unknown>
      if (itemRecord.mediaContent) {
        const mc = itemRecord.mediaContent as Record<string, unknown>
        const attrs = (mc.$ || mc) as Record<string, string>
        if (attrs.url) {
          media.push({
            type: attrs.medium === 'video' ? 'video' : 'image',
            url: attrs.url,
            width: attrs.width ? parseInt(attrs.width) : undefined,
            height: attrs.height ? parseInt(attrs.height) : undefined
          })
        }
      }
      
      if (itemRecord.enclosure) {
        const enc = itemRecord.enclosure as Record<string, string>
        if (enc.url && enc.type?.startsWith('image')) {
          media.push({ type: 'image', url: enc.url })
        } else if (enc.url && enc.type?.startsWith('video')) {
          media.push({ type: 'video', url: enc.url })
        } else if (enc.url && enc.type?.startsWith('audio')) {
          media.push({ type: 'audio', url: enc.url })
        }
      }
      
      // Get full content - prefer content:encoded over content over description
      const fullContentHtml = (itemRecord.contentEncoded as string) || item.content || item['content:encoded'] || ''
      // Use summary or contentSnippet for description
      const descriptionHtml = (itemRecord.summary as string) || item.contentSnippet || ''
      
      // Use full content if available, otherwise use description
      const contentHtml = fullContentHtml || descriptionHtml
      
      // Extract images from content
      const imgMatches = contentHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/gi)
      if (imgMatches && media.length === 0) {
        // Extract all images, not just the first
        for (const imgMatch of imgMatches.slice(0, 4)) {
          const srcMatch = imgMatch.match(/src="([^"]+)"/)
          if (srcMatch && !media.some(m => m.url === srcMatch[1])) {
            media.push({ type: 'image', url: srcMatch[1] })
          }
        }
      }
      
      // Create a snippet for preview (first ~300 chars of plain text)
      const plainText = contentHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const snippet = plainText.length > 300 
        ? plainText.substring(0, 300).trim() + '...' 
        : plainText
      
      // Determine if this has full content or just a summary
      const hasFullContent = fullContentHtml.length > 500 || 
        (descriptionHtml.length > 500 && !fullContentHtml)
      
      return {
        id: `${source.id}-${item.guid || item.link || item.title || Date.now()}`,
        sourceId: source.id,
        sourceType: 'rss',
        sourceName: source.name || feed.title || 'RSS Feed',
        title: item.title,
        content: snippet || item.contentSnippet || '',
        contentHtml: hasFullContent ? undefined : contentHtml,
        fullContent: hasFullContent ? contentHtml : undefined,
        fullContentLoaded: hasFullContent,
        author: {
          name: (itemRecord.dcCreator as string) || item.creator || item.author || feed.title || 'Desconocido',
          url: feed.link
        },
        url: item.link,
        publishedAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
        media: media.length > 0 ? media : undefined,
        raw: item
      }
    })
    
    return NextResponse.json({ items, feedTitle: feed.title })
  } catch (error) {
    console.error('RSS fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RSS feed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
