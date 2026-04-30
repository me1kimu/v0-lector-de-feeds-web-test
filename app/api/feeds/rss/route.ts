import { NextRequest, NextResponse } from 'next/server'
import Parser from 'rss-parser'
import type { FeedItem, FeedSource, MediaAttachment } from '@/lib/types'

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure']
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
      const rawItem = item as Record<string, unknown>
      if (rawItem.mediaContent) {
        const mc = rawItem.mediaContent as Record<string, unknown>
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
      
      if (rawItem.enclosure) {
        const enc = rawItem.enclosure as Record<string, string>
        if (enc.url && enc.type?.startsWith('image')) {
          media.push({ type: 'image', url: enc.url })
        } else if (enc.url && enc.type?.startsWith('video')) {
          media.push({ type: 'video', url: enc.url })
        } else if (enc.url && enc.type?.startsWith('audio')) {
          media.push({ type: 'audio', url: enc.url })
        }
      }
      
      // Extract images from content
      const contentHtml = item.content || item['content:encoded'] || ''
      const imgMatches = contentHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/gi)
      if (imgMatches && media.length === 0) {
        const srcMatch = imgMatches[0].match(/src="([^"]+)"/)
        if (srcMatch) {
          media.push({ type: 'image', url: srcMatch[1] })
        }
      }
      
      return {
        id: `${source.id}-${item.guid || item.link || item.title || Date.now()}`,
        sourceId: source.id,
        sourceType: 'rss',
        sourceName: source.name || feed.title || 'RSS Feed',
        title: item.title,
        content: item.contentSnippet || item.content || '',
        contentHtml: item.content || item['content:encoded'],
        author: {
          name: item.creator || item.author || feed.title || 'Desconocido',
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
